import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getSupabaseAdminClient } from '$lib/server/supabaseAdmin.server';
import { getClientForModel, resolveDefaultAIModel } from '$lib/server/aiProvider.server';
import { getSystemPrompt } from '$lib/agent/systemPrompts';
import {
    getTelegramWebhookSecret,
    hashLinkToken,
    sendTelegramMessage,
    toDisplayName,
    type TelegramLinkRecord
} from '$lib/server/telegram.server';

type TelegramUser = {
    id: number;
    is_bot?: boolean;
    first_name?: string;
    last_name?: string;
    username?: string;
    language_code?: string;
};

type TelegramChat = {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
};

type TelegramMessage = {
    message_id: number;
    date: number;
    text?: string;
    chat: TelegramChat;
    from?: TelegramUser;
};

type TelegramUpdate = {
    update_id: number;
    message?: TelegramMessage;
};

type LinkTokenRecord = {
    id: string;
    biglot_user_id: string;
    expires_at: string;
    used_at: string | null;
};

type ChatRecord = {
    id: string;
    title: string;
    created_at: string;
};

const MAX_TELEGRAM_CHARS = 3800;
const MAX_CONTEXT_MESSAGES = 30;
const MAX_TELEGRAM_RAW_CHARS = 3000;

export const GET: RequestHandler = async () => {
    return json({ ok: true });
};

export const POST: RequestHandler = async ({ request }) => {
    const expectedSecret = getTelegramWebhookSecret();
    if (expectedSecret) {
        const actualSecret = request.headers.get('x-telegram-bot-api-secret-token');
        if (actualSecret !== expectedSecret) {
            return json({ error: 'Unauthorized webhook request' }, { status: 401 });
        }
    }

    let update: TelegramUpdate;
    try {
        update = (await request.json()) as TelegramUpdate;
    } catch {
        return json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const message = update.message;
    if (!message?.chat?.id || !message.from?.id) {
        return json({ ok: true, ignored: true, reason: 'No message payload' });
    }

    if (message.chat.type !== 'private') {
        return json({ ok: true, ignored: true, reason: 'Only private chat is supported' });
    }

    const incomingText = typeof message.text === 'string' ? message.text.trim() : '';
    const sender = message.from;

    try {
        if (incomingText.startsWith('/start')) {
            await handleStartCommand(message, sender, incomingText);
            return json({ ok: true, action: 'link' });
        }

        await handleConversationMessage(message, sender, incomingText);
        return json({ ok: true, action: 'chat' });
    } catch (error) {
        console.error('[Telegram Webhook Error]', error);
        try {
            await sendTelegramMessage(message.chat.id, 'BigLot.ai มีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้งในอีกสักครู่');
        } catch (sendError) {
            console.error('[Telegram send fallback error]', sendError);
        }
        return json({ ok: false }, { status: 500 });
    }
};

async function handleStartCommand(message: TelegramMessage, sender: TelegramUser, incomingText: string): Promise<void> {
    const token = parseStartToken(incomingText);
    if (!token) {
        await sendTelegramMessage(
            message.chat.id,
            'ยังไม่มี token สำหรับเชื่อมบัญชี BigLot.ai\n\nให้กด Add Telegram Bot จากหน้าเว็บก่อน แล้วค่อยกลับมาที่นี่'
        );
        return;
    }

    const supabase = getSupabaseAdminClient();
    const tokenHash = hashLinkToken(token);
    const nowIso = new Date().toISOString();

    const { data: tokenRecord, error: tokenError } = await supabase
        .from('telegram_link_tokens')
        .select('id, biglot_user_id, expires_at, used_at')
        .eq('token_hash', tokenHash)
        .is('used_at', null)
        .gt('expires_at', nowIso)
        .maybeSingle();

    if (tokenError) {
        throw new Error(tokenError.message);
    }

    if (!tokenRecord) {
        await sendTelegramMessage(
            message.chat.id,
            'ลิงก์เชื่อมบัญชีหมดอายุหรือไม่ถูกต้อง\n\nกลับไปหน้าเว็บแล้วกด Add Telegram Bot ใหม่อีกครั้ง'
        );
        return;
    }

    const safeToken = tokenRecord as LinkTokenRecord;

    // Keep only one active Telegram link per BigLot account.
    const { error: deactivateError } = await supabase
        .from('telegram_links')
        .update({ is_active: false, unlinked_at: nowIso, updated_at: nowIso })
        .eq('biglot_user_id', safeToken.biglot_user_id)
        .eq('is_active', true)
        .neq('telegram_user_id', sender.id);

    if (deactivateError) {
        throw new Error(deactivateError.message);
    }

    const { error: linkError } = await supabase.from('telegram_links').upsert(
        {
            biglot_user_id: safeToken.biglot_user_id,
            telegram_user_id: sender.id,
            telegram_chat_id: message.chat.id,
            telegram_username: sender.username ?? null,
            telegram_first_name: sender.first_name ?? null,
            telegram_last_name: sender.last_name ?? null,
            is_active: true,
            linked_at: nowIso,
            unlinked_at: null,
            updated_at: nowIso
        },
        { onConflict: 'telegram_user_id' }
    );

    if (linkError) {
        throw new Error(linkError.message);
    }

    const { error: markUsedError } = await supabase
        .from('telegram_link_tokens')
        .update({ used_at: nowIso })
        .eq('id', safeToken.id);

    if (markUsedError) {
        throw new Error(markUsedError.message);
    }

    await sendTelegramMessage(
        message.chat.id,
        'เชื่อมบัญชีสำเร็จแล้ว\n\nจากนี้ข้อความที่ส่งใน Telegram จะคุยผ่าน BigLot.ai ได้ทันที'
    );
}

async function handleConversationMessage(message: TelegramMessage, sender: TelegramUser, incomingText: string): Promise<void> {
    if (!incomingText) {
        await sendTelegramMessage(message.chat.id, 'พิมพ์ข้อความที่ต้องการถาม BigLot.ai ได้เลย');
        return;
    }

    const supabase = getSupabaseAdminClient();
    const { data: linkData, error: linkError } = await supabase
        .from('telegram_links')
        .select('*')
        .eq('telegram_user_id', sender.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

    if (linkError) {
        throw new Error(linkError.message);
    }

    const link = linkData as TelegramLinkRecord | null;
    if (!link) {
        await sendTelegramMessage(
            message.chat.id,
            'บัญชีนี้ยังไม่เชื่อมกับ BigLot.ai\n\nเข้าเว็บ BigLot.ai แล้วกด Add Telegram Bot ก่อน'
        );
        return;
    }

    const chatId = await getOrCreateTelegramChat(link, message.chat.id);
    await insertMessageWithFallback({
        chatId,
        role: 'user',
        content: incomingText,
        mode: 'coach',
        channel: 'telegram',
        externalMessageId: String(message.message_id)
    });

    const model = resolveDefaultAIModel();
    const { client, apiModel, provider } = getClientForModel(model);

    const { data: contextRows, error: contextError } = await supabase
        .from('messages')
        .select('role,content')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(MAX_CONTEXT_MESSAGES);

    if (contextError) {
        throw new Error(contextError.message);
    }

    const orderedContext = [...(contextRows ?? [])].reverse();
    const safeContext = orderedContext
        .filter((row) => row && (row.role === 'user' || row.role === 'assistant' || row.role === 'system'))
        .map((row) => {
            const content = typeof row.content === 'string' ? row.content : '';
            return { role: row.role as 'user' | 'assistant' | 'system', content: content.slice(0, 8000) };
        })
        .filter((row) => row.content.trim().length > 0);

    const systemPrompt = getSystemPrompt('coach');

    const completion = await client.chat.completions.create({
        model: apiModel,
        messages: [{ role: 'system', content: systemPrompt }, ...safeContext],
        temperature: 0.5,
        max_tokens: 1200
    });

    const assistantContentRaw = completion.choices[0]?.message?.content;
    const assistantContent =
        typeof assistantContentRaw === 'string' && assistantContentRaw.trim().length > 0
            ? assistantContentRaw
            : `(${provider}) didn't return a text response.`;

    await insertMessageWithFallback({
        chatId,
        role: 'assistant',
        content: assistantContent,
        mode: 'coach',
        channel: 'telegram'
    });

    const chunks = chunkTelegramText(assistantContent, MAX_TELEGRAM_RAW_CHARS);
    for (const chunk of chunks) {
        const pretty = formatTelegramOutput(chunk);
        try {
            await sendTelegramMessage(message.chat.id, pretty, { parseMode: 'HTML' });
        } catch (error) {
            console.error('[Telegram format fallback]', error);
            await sendTelegramMessage(message.chat.id, chunk);
        }
    }
}

async function getOrCreateTelegramChat(link: TelegramLinkRecord, externalChatId: number): Promise<string> {
    const supabase = getSupabaseAdminClient();
    const externalChatIdAsText = String(externalChatId);

    const { data: mapping, error: mappingError } = await supabase
        .from('chat_channels')
        .select('chat_id')
        .eq('biglot_user_id', link.biglot_user_id)
        .eq('channel', 'telegram')
        .eq('external_chat_id', externalChatIdAsText)
        .limit(1)
        .maybeSingle();

    if (mappingError) {
        throw new Error(mappingError.message);
    }

    const mappedChatId = mapping?.chat_id;
    if (typeof mappedChatId === 'string' && mappedChatId.length > 0) {
        return mappedChatId;
    }

    const title = `Telegram • ${toDisplayName(link)}`;

    let data: ChatRecord | null = null;
    let error: { message: string } | null = null;

    ({ data, error } = await supabase
        .from('chats')
        .insert({ title, biglot_user_id: link.biglot_user_id })
        .select('id, title, created_at')
        .single());

    if (error && /biglot_user_id/i.test(error.message)) {
        ({ data, error } = await supabase
            .from('chats')
            .insert({ title })
            .select('id, title, created_at')
            .single());
    }

    if (error || !data) {
        throw new Error(error?.message ?? 'Failed to create chat');
    }

    const { error: channelError } = await supabase.from('chat_channels').upsert(
        {
            chat_id: data.id,
            biglot_user_id: link.biglot_user_id,
            channel: 'telegram',
            external_chat_id: externalChatIdAsText,
            updated_at: new Date().toISOString()
        },
        { onConflict: 'channel,external_chat_id' }
    );

    if (channelError) {
        throw new Error(channelError.message);
    }

    return data.id;
}

async function insertMessageWithFallback(input: {
    chatId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    mode?: 'coach' | 'recovery' | 'analyst' | 'pinescript';
    channel?: 'web' | 'telegram';
    externalMessageId?: string;
}): Promise<void> {
    const supabase = getSupabaseAdminClient();

    const basePayload: Record<string, unknown> = {
        chat_id: input.chatId,
        role: input.role,
        content: input.content
    };

    if (input.mode) basePayload.mode = input.mode;
    if (input.channel) basePayload.channel = input.channel;
    if (input.externalMessageId) basePayload.external_message_id = input.externalMessageId;

    let payload = { ...basePayload };

    for (let i = 0; i < 4; i += 1) {
        const { error } = await supabase.from('messages').insert(payload);
        if (!error) return;

        const errorMessage = error.message ?? 'Unknown insert error';

        if (/external_message_id/i.test(errorMessage)) {
            delete payload.external_message_id;
            continue;
        }
        if (/\bchannel\b/i.test(errorMessage)) {
            delete payload.channel;
            continue;
        }
        if (/\bmode\b/i.test(errorMessage)) {
            delete payload.mode;
            continue;
        }

        throw new Error(errorMessage);
    }

    throw new Error('Failed to persist message with fallback retries');
}

function parseStartToken(text: string): string | null {
    const parts = text.trim().split(/\s+/);
    if (parts.length < 2) return null;
    const token = parts[1]?.trim();
    if (!token) return null;
    return token;
}

function chunkTelegramText(rawText: string, limit: number): string[] {
    const text = rawText.trim();
    if (!text) return ['(empty response)'];
    if (text.length <= limit) return [text];

    const chunks: string[] = [];
    let cursor = 0;

    while (cursor < text.length) {
        const maxEnd = Math.min(cursor + limit, text.length);
        let splitAt = text.lastIndexOf('\n', maxEnd);

        if (splitAt <= cursor) {
            splitAt = text.lastIndexOf(' ', maxEnd);
        }

        if (splitAt <= cursor) {
            splitAt = maxEnd;
        }

        const piece = text.slice(cursor, splitAt).trim();
        if (piece.length > 0) chunks.push(piece);
        cursor = splitAt;
    }

    return chunks.length > 0 ? chunks : [text.slice(0, limit)];
}

function formatTelegramOutput(rawText: string): string {
    const trimmed = rawText.trim();
    if (!trimmed) return '(empty response)';

    const sections: string[] = [];
    const codeBlockPattern = /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g;
    let cursor = 0;

    while (true) {
        const match = codeBlockPattern.exec(trimmed);
        if (!match) break;

        const plainPart = trimmed.slice(cursor, match.index);
        if (plainPart.trim().length > 0) {
            sections.push(formatPlainMarkdownLikeText(plainPart));
        }

        const language = typeof match[1] === 'string' ? match[1].trim() : '';
        const code = typeof match[2] === 'string' ? match[2].trimEnd() : '';
        const escapedCode = escapeTelegramHtml(code);
        if (language) {
            sections.push(`<b>${escapeTelegramHtml(language.toUpperCase())}</b>\n<pre><code>${escapedCode}</code></pre>`);
        } else {
            sections.push(`<pre><code>${escapedCode}</code></pre>`);
        }

        cursor = match.index + match[0].length;
    }

    const tail = trimmed.slice(cursor);
    if (tail.trim().length > 0) {
        sections.push(formatPlainMarkdownLikeText(tail));
    }

    const formatted = sections
        .join('\n\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return formatted.length > 0 ? formatted : escapeTelegramHtml(trimmed);
}

function formatPlainMarkdownLikeText(input: string): string {
    const lines = input.split('\n');
    const mappedLines = lines.map((line) => {
        const heading = line.match(/^#{1,6}\s+(.+)$/);
        if (heading) {
            return `<b>${escapeTelegramHtml(heading[1].trim())}</b>`;
        }

        const bullet = line.match(/^\s*[-*]\s+(.+)$/);
        if (bullet) {
            return `• ${escapeTelegramHtml(bullet[1])}`;
        }

        const numbered = line.match(/^\s*(\d+)\.\s+(.+)$/);
        if (numbered) {
            return `${numbered[1]}. ${escapeTelegramHtml(numbered[2])}`;
        }

        return escapeTelegramHtml(line);
    });

    let formatted = mappedLines.join('\n');

    // Inline code
    formatted = formatted.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    // Bold
    formatted = formatted.replace(/\*\*([^*\n][\s\S]*?[^*\n])\*\*/g, '<b>$1</b>');
    // Italic with single *
    formatted = formatted.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1<i>$2</i>');
    // Linkify plain URLs
    formatted = formatted.replace(
        /(^|[\s(])(https?:\/\/[^\s<]+)/g,
        (_, prefix: string, url: string) => `${prefix}<a href="${url}">${url}</a>`
    );

    return formatted;
}

function escapeTelegramHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
