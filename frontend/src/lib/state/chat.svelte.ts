import { supabase } from '$lib/supabase';
import { parseSSEStream } from '$lib/utils/sseParser';
import type {
    AgentRouteType,
    ContentBlock,
    ToolCallStatus,
    PlanBlock
} from '$lib/types/contentBlock';

export type AgentMode = 'coach' | 'recovery' | 'analyst' | 'pinescript' | 'gold' | 'macro' | 'portfolio';
export type ChatMode = 'normal' | 'agent';
export type ChatChannel = 'web' | 'telegram';

export type Message = {
    id?: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    contentBlocks?: ContentBlock[];
    toolCalls?: ToolCallStatus[];
    image_url?: string;
    mode?: AgentMode;
    channel?: ChatChannel;
    runId?: string | null;
    routeType?: AgentRouteType;
    feedback?: 'up' | 'down' | null;
};

export type Chat = {
    id: string;
    title: string;
    created_at: string;
};

export type TelegramLinkStatus = {
    linked: boolean;
    displayName?: string;
    linkedAt?: string;
};

type LinkTokenResponse = {
    deepLink: string;
    expiresAt: string;
};

async function readApiError(response: Response, fallback: string): Promise<string> {
    try {
        const body = await response.clone().json();
        if (body && typeof body.error === 'string' && body.error.trim().length > 0) {
            return body.error;
        }
    } catch {
        // ignore JSON parse error and fallback to text
    }

    try {
        const text = (await response.text()).trim();
        if (text.length > 0) return text;
    } catch {
        // ignore text read error
    }

    return fallback;
}

class ChatState {
    messages = $state<Message[]>([]);
    allChats = $state<Chat[]>([]);
    currentChatId = $state<string | null>(null);
    isLoading = $state(false);
    selectedImage = $state<string | null>(null);
    agentMode = $state<AgentMode>('coach');
    chatMode = $state<ChatMode>('normal');
    lastDbError = $state<string | null>(null);

    biglotUserId = $state<string>('anonymous');

    telegramLinkStatus = $state<TelegramLinkStatus>({ linked: false });
    isTelegramLinkLoading = $state(false);
    telegramError = $state<string | null>(null);

    private static readonly AGENT_MODE_STORAGE_KEY = 'biglot.agentMode';
    private static readonly CHAT_MODE_STORAGE_KEY = 'biglot.chatMode';
    private static readonly USER_ID_STORAGE_KEY = 'biglot.userId';

    constructor() {
        if (typeof localStorage === 'undefined') return;

        const savedMode = localStorage.getItem(ChatState.AGENT_MODE_STORAGE_KEY);
        if (savedMode === 'coach' || savedMode === 'recovery' || savedMode === 'analyst' || savedMode === 'pinescript' || savedMode === 'gold' || savedMode === 'macro' || savedMode === 'portfolio') {
            this.agentMode = savedMode;
        }

        const savedChatMode = localStorage.getItem(ChatState.CHAT_MODE_STORAGE_KEY);
        if (savedChatMode === 'normal' || savedChatMode === 'agent') {
            this.chatMode = savedChatMode;
        }

        const savedUserId = localStorage.getItem(ChatState.USER_ID_STORAGE_KEY);
        if (savedUserId && savedUserId.length >= 8) {
            this.biglotUserId = savedUserId;
        } else {
            const generated = this.generateBrowserUserId();
            this.biglotUserId = generated;
            localStorage.setItem(ChatState.USER_ID_STORAGE_KEY, generated);
        }
    }

    setAgentMode(mode: AgentMode) {
        this.agentMode = mode;
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem(ChatState.AGENT_MODE_STORAGE_KEY, mode);
    }

    setChatMode(mode: ChatMode) {
        this.chatMode = mode;
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem(ChatState.CHAT_MODE_STORAGE_KEY, mode);
    }

    private generateBrowserUserId(): string {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }

        const randomPart = Math.random().toString(36).slice(2, 12);
        const timestamp = Date.now().toString(36);
        return `u_${timestamp}_${randomPart}`;
    }

    async refreshTelegramLinkStatus() {
        this.isTelegramLinkLoading = true;
        this.telegramError = null;

        try {
            const url = `/api/telegram/link?biglotUserId=${encodeURIComponent(this.biglotUserId)}`;
            const response = await fetch(url, { method: 'GET' });
            if (!response.ok) {
                const message = await readApiError(response, 'Failed to load Telegram link status');
                throw new Error(message);
            }

            const data = (await response.json()) as {
                linked?: unknown;
                displayName?: unknown;
                linkedAt?: unknown;
            };

            this.telegramLinkStatus = {
                linked: data.linked === true,
                displayName: typeof data.displayName === 'string' ? data.displayName : undefined,
                linkedAt: typeof data.linkedAt === 'string' ? data.linkedAt : undefined
            };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to load Telegram link status';
            this.telegramError = message;
        } finally {
            this.isTelegramLinkLoading = false;
        }
    }

    async createTelegramLink(): Promise<LinkTokenResponse | null> {
        this.isTelegramLinkLoading = true;
        this.telegramError = null;

        try {
            const response = await fetch('/api/telegram/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ biglotUserId: this.biglotUserId })
            });

            if (!response.ok) {
                const message = await readApiError(response, 'Failed to create Telegram link');
                throw new Error(message);
            }

            const data = (await response.json()) as {
                deepLink?: unknown;
                expiresAt?: unknown;
            };

            if (typeof data.deepLink !== 'string' || typeof data.expiresAt !== 'string') {
                throw new Error('Invalid response from Telegram link API');
            }

            return { deepLink: data.deepLink, expiresAt: data.expiresAt };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to create Telegram link';
            this.telegramError = message;
            return null;
        } finally {
            this.isTelegramLinkLoading = false;
        }
    }

    async unlinkTelegram(): Promise<boolean> {
        this.isTelegramLinkLoading = true;
        this.telegramError = null;

        try {
            const response = await fetch('/api/telegram/unlink', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ biglotUserId: this.biglotUserId })
            });

            if (!response.ok) {
                const message = await readApiError(response, 'Failed to unlink Telegram account');
                throw new Error(message);
            }

            const data = (await response.json()) as { ok?: unknown };
            void data;

            await this.refreshTelegramLinkStatus();
            return true;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to unlink Telegram account';
            this.telegramError = message;
            return false;
        } finally {
            this.isTelegramLinkLoading = false;
        }
    }

    // Load list of chats for sidebar
    async loadAllChats() {
        let data: Chat[] | null = null;
        let error: { message: string } | null = null;

        ({ data, error } = await supabase
            .from('chats')
            .select('*')
            .eq('biglot_user_id', this.biglotUserId)
            .order('created_at', { ascending: false }));

        // Backward compatibility for older schema without biglot_user_id.
        if (error && typeof error.message === 'string' && /biglot_user_id/i.test(error.message)) {
            ({ data, error } = await supabase
                .from('chats')
                .select('*')
                .order('created_at', { ascending: false }));
        }

        if (error && typeof error.message === 'string' && error.message.includes('created_at')) {
            ({ data, error } = await supabase
                .from('chats')
                .select('*')
                .eq('biglot_user_id', this.biglotUserId));

            if (error && /biglot_user_id/i.test(error.message)) {
                ({ data, error } = await supabase
                    .from('chats')
                    .select('*'));
            }
        }

        if (error) {
            console.error('Error loading chats:', error);
            this.lastDbError = error.message ?? 'Failed to load chats';
            return;
        }

        if (data) {
            this.allChats = data;
            this.lastDbError = null;
        }
    }

    // Load messages for a specific chat
    async loadChat(chatId: string) {
        this.isLoading = true;
        this.lastDbError = null;

        try {
            let data: any[] | null = null;
            let error: { message: string } | null = null;

            ({ data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('chat_id', chatId)
                .order('created_at', { ascending: true }));

            if (error && typeof error.message === 'string' && error.message.includes('created_at')) {
                ({ data, error } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('chat_id', chatId));
            }

            if (error) {
                console.error('Error loading chat messages:', error);
                this.lastDbError = error.message ?? 'Failed to load chat';
                throw new Error(this.lastDbError ?? 'Failed to load chat');
            }

            this.currentChatId = chatId;
            this.messages = (data ?? []).map((row: any) => {
                const msg: Message = {
                    id: typeof row.id === 'string' ? row.id : undefined,
                    role: row.role,
                    content: row.content ?? '',
                    image_url: typeof row.image_url === 'string' ? row.image_url : undefined,
                    channel: row.channel === 'web' || row.channel === 'telegram' ? row.channel : undefined,
                    runId: typeof row.run_id === 'string' ? row.run_id : undefined,
                    mode:
                        row.mode === 'coach' || row.mode === 'recovery' || row.mode === 'analyst' || row.mode === 'pinescript' || row.mode === 'gold' || row.mode === 'macro' || row.mode === 'portfolio'
                            ? row.mode
                            : undefined
                };
                // Restore content blocks from DB if available
                if (row.content_blocks && Array.isArray(row.content_blocks)) {
                    msg.contentBlocks = row.content_blocks;
                }
                return msg;
            });
        } finally {
            this.isLoading = false;
        }
    }

    async newChat() {
        this.messages = [];
        this.currentChatId = null;
    }

    async deleteChat(chatId: string) {
        const { error } = await supabase.from('chats').delete().eq('id', chatId);

        if (error) {
            console.error('Error deleting chat:', error);
            return;
        }

        this.allChats = this.allChats.filter((c) => c.id !== chatId);

        if (this.currentChatId === chatId) {
            this.newChat();
        }
    }

    async sendMessage(content: string, imageUrl?: string) {
        if (!content.trim() && !imageUrl) return;
        const modeUsed = this.agentMode;

        // 1. Create chat session in Supabase if it doesn't exist.
        if (!this.currentChatId) {
            const titleText = content || 'Image Analysis';
            let data: Chat | null = null;
            let error: { message: string } | null = null;

            ({ data, error } = await supabase
                .from('chats')
                .insert({
                    title: titleText.slice(0, 30) + (titleText.length > 30 ? '...' : ''),
                    biglot_user_id: this.biglotUserId
                })
                .select()
                .single());

            if (error && typeof error.message === 'string' && /biglot_user_id/i.test(error.message)) {
                ({ data, error } = await supabase
                    .from('chats')
                    .insert({ title: titleText.slice(0, 30) + (titleText.length > 30 ? '...' : '') })
                    .select()
                    .single());
            }

            if (error || !data) {
                console.error('Error creating chat:', error);
                return;
            }

            this.currentChatId = data.id;
            this.allChats = [data, ...this.allChats];
        }

        const chatId = this.currentChatId;

        // 2. Add and save user message.
        const userMsg: Message = { role: 'user', content, image_url: imageUrl, mode: modeUsed, channel: 'web' };
        this.messages.push(userMsg);
        this.selectedImage = null;

        {
            const basePayload: Record<string, unknown> = {
                chat_id: chatId,
                role: 'user',
                content,
                channel: 'web'
            };
            if (imageUrl) basePayload.image_url = imageUrl;
            basePayload.mode = modeUsed;

            let payload = { ...basePayload };
            let insertError: { message: string } | null = null;

            for (let i = 0; i < 4; i += 1) {
                const { error } = await supabase.from('messages').insert(payload);
                if (!error) {
                    insertError = null;
                    break;
                }

                insertError = error;

                if (/image_url/i.test(error.message)) {
                    delete payload.image_url;
                    continue;
                }
                if (/\bmode\b/i.test(error.message)) {
                    delete payload.mode;
                    continue;
                }
                if (/\bchannel\b/i.test(error.message)) {
                    delete payload.channel;
                    continue;
                }

                break;
            }

            if (insertError) {
                console.error('Error saving user message:', insertError);
                this.lastDbError = insertError.message ?? 'Failed to save message';
            } else {
                this.lastDbError = null;
            }
        }

        this.isLoading = true;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId,
                    biglotUserId: this.biglotUserId,
                    messages: this.messages,
                    mode: this.agentMode,
                    chatMode: this.chatMode
                })
            });

            if (!response.ok) throw new Error('Failed to fetch');
            if (!response.body) throw new Error('No response body');

            // Add empty assistant message
            this.messages.push({
                role: 'assistant',
                content: '',
                contentBlocks: [],
                toolCalls: [],
                mode: modeUsed,
                channel: 'web'
            });
            const msgIdx = this.messages.length - 1;

            let fullText = '';
            const allBlocks: ContentBlock[] = [];

            // Parse SSE stream
            for await (const event of parseSSEStream(response.body)) {
                try {
                    const data = JSON.parse(event.data);

                    switch (event.event) {
                        case 'run_start': {
                            this.messages[msgIdx].runId =
                                typeof data.runId === 'string' ? data.runId : null;
                            this.messages[msgIdx].routeType =
                                data.routeType === 'direct_answer' ||
                                data.routeType === 'single_tool' ||
                                data.routeType === 'plan_then_execute'
                                    ? data.routeType
                                    : undefined;
                            break;
                        }
                        case 'run_id': {
                            if (typeof data.runId === 'string') {
                                this.messages[msgIdx].runId = data.runId;
                            }
                            break;
                        }
                        case 'text_delta': {
                            fullText += data.content || '';
                            this.messages[msgIdx].content = fullText;
                            break;
                        }
                        case 'tool_start': {
                            const toolCall: ToolCallStatus = {
                                id: data.toolCallId,
                                name: data.tool,
                                args: data.args,
                                status: 'running',
                                startedAt: Date.now()
                            };
                            this.messages[msgIdx].toolCalls = [
                                ...(this.messages[msgIdx].toolCalls || []),
                                toolCall
                            ];
                            break;
                        }
                        case 'tool_result': {
                            // Mark tool as complete
                            const toolCalls = this.messages[msgIdx].toolCalls || [];
                            const tc = toolCalls.find(
                                (t) => t.id === data.toolCallId
                            );
                            if (tc) {
                                tc.status = data.success ? 'complete' : 'error';
                                tc.latencyMs = Date.now() - tc.startedAt;
                                tc.resultSummary =
                                    typeof data.textSummary === 'string' ? data.textSummary : undefined;
                            }
                            this.messages[msgIdx].toolCalls = [...toolCalls];

                            // Add content blocks
                            if (Array.isArray(data.blocks)) {
                                allBlocks.push(...data.blocks);
                                this.messages[msgIdx].contentBlocks = [...allBlocks];
                            }
                            break;
                        }
                        case 'error': {
                            // Mark any running tools as error
                            const runningTools = this.messages[msgIdx].toolCalls || [];
                            for (const t of runningTools) {
                                if (t.status === 'running') t.status = 'error';
                            }
                            this.messages[msgIdx].toolCalls = [...runningTools];
                            break;
                        }
                        case 'plan_create': {
                            const plan = data.plan as PlanBlock;
                            allBlocks.push(plan);
                            this.messages[msgIdx].contentBlocks = [...allBlocks];
                            break;
                        }
                        case 'plan_update': {
                            const planBlock = allBlocks.find(
                                (b): b is PlanBlock => b.type === 'plan' && (b as PlanBlock).planId === data.planId
                            );
                            if (planBlock) {
                                const step = planBlock.steps.find((s: any) => s.id === data.stepId);
                                if (step) {
                                    step.status = data.status;
                                    if (data.result) step.result = data.result;
                                    if (data.status === 'running') step.startedAt = Date.now();
                                    if (data.status === 'complete' || data.status === 'error') step.completedAt = Date.now();
                                }
                                planBlock.updatedAt = Date.now();
                                this.messages[msgIdx].contentBlocks = [...allBlocks];
                            }
                            break;
                        }
                        case 'plan_complete': {
                            const completedPlan = allBlocks.find(
                                (b): b is PlanBlock => b.type === 'plan' && (b as PlanBlock).planId === data.planId
                            );
                            if (completedPlan) {
                                completedPlan.status = data.status;
                                completedPlan.updatedAt = Date.now();
                                this.messages[msgIdx].contentBlocks = [...allBlocks];
                            }
                            break;
                        }
                        case 'done': {
                            // Final content blocks from server
                            if (typeof data.runId === 'string') {
                                this.messages[msgIdx].runId = data.runId;
                            }
                            if (
                                data.routeType === 'direct_answer' ||
                                data.routeType === 'single_tool' ||
                                data.routeType === 'plan_then_execute'
                            ) {
                                this.messages[msgIdx].routeType = data.routeType;
                            }
                            if (Array.isArray(data.contentBlocks) && data.contentBlocks.length > 0) {
                                this.messages[msgIdx].contentBlocks = data.contentBlocks;
                            }
                            break;
                        }
                    }
                } catch {
                    // Skip malformed SSE events
                }
            }

            // 3. Save assistant message after stream finishes.
            {
                const finalBlocks = this.messages[msgIdx].contentBlocks;
                let payload: Record<string, unknown> = {
                    chat_id: chatId,
                    role: 'assistant',
                    content: fullText,
                    mode: modeUsed,
                    channel: 'web'
                };

                // Include content_blocks if we have structured data
                if (finalBlocks && finalBlocks.length > 0) {
                    payload.content_blocks = finalBlocks;
                }
                if (this.messages[msgIdx].runId) {
                    payload.run_id = this.messages[msgIdx].runId;
                }

                let insertError: { message: string } | null = null;
                let insertedId: string | undefined;

                for (let i = 0; i < 4; i += 1) {
                    const { data, error } = await supabase
                        .from('messages')
                        .insert(payload)
                        .select('id')
                        .single();
                    if (!error) {
                        insertedId = typeof data?.id === 'string' ? data.id : undefined;
                        insertError = null;
                        break;
                    }

                    insertError = error;
                    if (/content_blocks/i.test(error.message)) {
                        delete payload.content_blocks;
                        continue;
                    }
                    if (/\bmode\b/i.test(error.message)) {
                        delete payload.mode;
                        continue;
                    }
                    if (/\bchannel\b/i.test(error.message)) {
                        delete payload.channel;
                        continue;
                    }
                    if (/run_id/i.test(error.message)) {
                        delete payload.run_id;
                        continue;
                    }
                    break;
                }

                if (insertError) {
                    console.error('Error saving assistant message:', insertError);
                    this.lastDbError = insertError.message ?? 'Failed to save assistant message';
                } else {
                    if (insertedId) {
                        this.messages[msgIdx].id = insertedId;
                    }
                    this.lastDbError = null;
                }
            }
        } catch (error) {
            console.error(error);
            const last = this.messages[this.messages.length - 1];
            if (last?.role === 'assistant' && last.content === '') {
                last.content = 'Sorry, I encountered an error.';
            } else {
                this.messages.push({ role: 'assistant', content: 'Sorry, I encountered an error.', channel: 'web' });
            }
        } finally {
            this.isLoading = false;
        }
    }

    clearSelectedImage() {
        this.selectedImage = null;
    }

    async submitFeedback(messageIndex: number, feedback: 'up' | 'down'): Promise<boolean> {
        const message = this.messages[messageIndex];
        if (!message || message.role !== 'assistant' || !message.id) return false;

        try {
            const response = await fetch('/api/chat/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messageId: message.id,
                    runId: message.runId,
                    biglotUserId: this.biglotUserId,
                    feedback
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save feedback');
            }

            this.messages[messageIndex].feedback = feedback;
            this.messages = [...this.messages];
            return true;
        } catch (error) {
            console.error('Feedback error:', error);
            return false;
        }
    }
}

export const chatState = new ChatState();
