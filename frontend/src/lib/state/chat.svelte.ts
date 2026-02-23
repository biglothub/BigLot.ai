import { supabase } from '$lib/supabase';

export type AgentMode = 'coach' | 'recovery' | 'analyst' | 'pinescript';
export type ChatChannel = 'web' | 'telegram';

export type Message = {
    role: 'user' | 'assistant' | 'system';
    content: string;
    image_url?: string;
    mode?: AgentMode;
    channel?: ChatChannel;
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
    lastDbError = $state<string | null>(null);

    biglotUserId = $state<string>('anonymous');

    telegramLinkStatus = $state<TelegramLinkStatus>({ linked: false });
    isTelegramLinkLoading = $state(false);
    telegramError = $state<string | null>(null);

    private static readonly AGENT_MODE_STORAGE_KEY = 'biglot.agentMode';
    private static readonly USER_ID_STORAGE_KEY = 'biglot.userId';

    constructor() {
        if (typeof localStorage === 'undefined') return;

        const savedMode = localStorage.getItem(ChatState.AGENT_MODE_STORAGE_KEY);
        if (savedMode === 'coach' || savedMode === 'recovery' || savedMode === 'analyst' || savedMode === 'pinescript') {
            this.agentMode = savedMode;
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
            this.messages = (data ?? []).map((row: any) => ({
                role: row.role,
                content: row.content ?? '',
                image_url: typeof row.image_url === 'string' ? row.image_url : undefined,
                channel: row.channel === 'web' || row.channel === 'telegram' ? row.channel : undefined,
                mode:
                    row.mode === 'coach' || row.mode === 'recovery' || row.mode === 'analyst' || row.mode === 'pinescript'
                        ? row.mode
                        : undefined
            })) as Message[];
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
                body: JSON.stringify({ messages: this.messages, mode: this.agentMode })
            });

            if (!response.ok) throw new Error('Failed to fetch');

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No reader');

            this.messages.push({ role: 'assistant', content: '', mode: modeUsed, channel: 'web' });
            const currentMessageIndex = this.messages.length - 1;

            const decoder = new TextDecoder();
            let fullAssistantContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                fullAssistantContent += chunk;
                this.messages[currentMessageIndex].content = fullAssistantContent;
            }

            // 3. Save assistant message after stream finishes.
            {
                let payload: Record<string, unknown> = {
                    chat_id: chatId,
                    role: 'assistant',
                    content: fullAssistantContent,
                    mode: modeUsed,
                    channel: 'web'
                };

                let insertError: { message: string } | null = null;

                for (let i = 0; i < 3; i += 1) {
                    const { error } = await supabase.from('messages').insert(payload);
                    if (!error) {
                        insertError = null;
                        break;
                    }

                    insertError = error;
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
                    console.error('Error saving assistant message:', insertError);
                    this.lastDbError = insertError.message ?? 'Failed to save assistant message';
                } else {
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
}

export const chatState = new ChatState();
