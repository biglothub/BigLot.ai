import { supabase } from '$lib/supabase';

export type AgentMode = 'coach' | 'recovery' | 'analyst' | 'pinescript';

export type Message = {
    role: 'user' | 'assistant' | 'system';
    content: string;
    image_url?: string;
    mode?: AgentMode;
};

export type Chat = {
    id: string;
    title: string;
    created_at: string;
};

class ChatState {
    messages = $state<Message[]>([]);
    allChats = $state<Chat[]>([]);
    currentChatId = $state<string | null>(null);
    isLoading = $state(false);
    selectedImage = $state<string | null>(null);
    agentMode = $state<AgentMode>('coach');
    lastDbError = $state<string | null>(null);

    private static readonly AGENT_MODE_STORAGE_KEY = 'biglot.agentMode';

    constructor() {
        // Best-effort persistence (no auth yet). Safe-guard for SSR.
        if (typeof localStorage === 'undefined') return;
        const saved = localStorage.getItem(ChatState.AGENT_MODE_STORAGE_KEY);
        if (saved === 'coach' || saved === 'recovery' || saved === 'analyst' || saved === 'pinescript') {
            this.agentMode = saved;
        }
    }

    setAgentMode(mode: AgentMode) {
        this.agentMode = mode;
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem(ChatState.AGENT_MODE_STORAGE_KEY, mode);
    }

    // Load list of chats for sidebar
    async loadAllChats() {
        let data: any[] | null = null;
        let error: any = null;

        ({ data, error } = await supabase
            .from('chats')
            .select('*')
            .order('created_at', { ascending: false }));

        if (error && typeof error.message === 'string' && error.message.includes('created_at')) {
            ({ data, error } = await supabase
                .from('chats')
                .select('*'));
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
            let error: any = null;

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
                mode: row.mode === 'coach' || row.mode === 'recovery' || row.mode === 'analyst' || row.mode === 'pinescript'
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

        // Remove from local state
        this.allChats = this.allChats.filter(c => c.id !== chatId);

        // If deleted current chat, reset
        if (this.currentChatId === chatId) {
            this.newChat();
        }
    }

    async sendMessage(content: string, imageUrl?: string) {
        if (!content.trim() && !imageUrl) return;
        const modeUsed = this.agentMode;

        // 1. Create chat session in Supabase if it doesn't exist
        if (!this.currentChatId) {
            const titleText = content || "Image Analysis";
            const { data, error } = await supabase
                .from('chats')
                .insert({ title: titleText.slice(0, 30) + (titleText.length > 30 ? '...' : '') })
                .select()
                .single();

            if (error || !data) {
                console.error('Error creating chat:', error);
                return;
            }
            this.currentChatId = data.id;
            this.allChats = [data, ...this.allChats];
        }

        const chatId = this.currentChatId;

        // 2. Add and Save user message
        const userMsg: Message = { role: 'user', content, image_url: imageUrl, mode: modeUsed };
        this.messages.push(userMsg);
        this.selectedImage = null; // Clear after sending

        // Persist user message (best-effort). Be backward compatible with schemas
        // missing newer columns (image_url, mode).
        {
            const basePayload: any = { chat_id: chatId, role: 'user', content };
            const withImage = imageUrl ? { ...basePayload, image_url: imageUrl } : basePayload;
            const payload = { ...withImage, mode: modeUsed };

            let { error } = await supabase.from('messages').insert(payload);

            if (error && typeof error.message === 'string' && /image_url/i.test(error.message)) {
                ({ error } = await supabase.from('messages').insert({ ...basePayload, mode: modeUsed }));
            }
            if (error && typeof error.message === 'string' && /\bmode\b/i.test(error.message)) {
                ({ error } = await supabase.from('messages').insert(withImage));
            }
            if (error && typeof error.message === 'string' && (/image_url/i.test(error.message) || /\bmode\b/i.test(error.message))) {
                ({ error } = await supabase.from('messages').insert(basePayload));
            }

            if (error) {
                console.error('Error saving user message:', error);
                this.lastDbError = error.message ?? 'Failed to save message';
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

            this.messages.push({ role: 'assistant', content: '', mode: modeUsed });
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

            // 3. Save assistant message after stream finishes
            {
                const { error } = await supabase.from('messages').insert({
                    chat_id: chatId,
                    role: 'assistant',
                    content: fullAssistantContent,
                    mode: modeUsed
                });
                if (error) {
                    // Retry without mode if column doesn't exist
                    if (typeof error.message === 'string' && /\bmode\b/i.test(error.message)) {
                        const retry = await supabase.from('messages').insert({
                            chat_id: chatId,
                            role: 'assistant',
                            content: fullAssistantContent
                        });
                        if (retry.error) {
                            console.error('Error saving assistant message:', retry.error);
                            this.lastDbError = retry.error.message ?? 'Failed to save assistant message';
                        } else {
                            this.lastDbError = null;
                        }
                    } else {
                        console.error('Error saving assistant message:', error);
                        this.lastDbError = error.message ?? 'Failed to save assistant message';
                    }
                } else {
                    this.lastDbError = null;
                }
            }

        } catch (error) {
            console.error(error);
            // If we already created an assistant placeholder, update it; otherwise add a new message.
            const last = this.messages[this.messages.length - 1];
            if (last?.role === 'assistant' && last.content === '') {
                last.content = "Sorry, I encountered an error.";
            } else {
                this.messages.push({ role: 'assistant', content: "Sorry, I encountered an error." });
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
