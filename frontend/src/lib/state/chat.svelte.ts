import { supabase } from '$lib/supabase';

export type AgentMode = 'coach' | 'analyst' | 'pinescript';

export type Message = {
    role: 'user' | 'assistant' | 'system';
    content: string;
    image_url?: string;
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

    private static readonly AGENT_MODE_STORAGE_KEY = 'biglot.agentMode';

    constructor() {
        // Best-effort persistence (no auth yet). Safe-guard for SSR.
        if (typeof localStorage === 'undefined') return;
        const saved = localStorage.getItem(ChatState.AGENT_MODE_STORAGE_KEY);
        if (saved === 'coach' || saved === 'analyst' || saved === 'pinescript') {
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
        const { data, error } = await supabase
            .from('chats')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            this.allChats = data;
        }
    }

    // Load messages for a specific chat
    async loadChat(chatId: string) {
        this.currentChatId = chatId;
        const { data, error } = await supabase
            .from('messages')
            .select('role, content, image_url')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true });

        if (!error && data) {
            this.messages = data as Message[];
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
        const userMsg: Message = { role: 'user', content, image_url: imageUrl };
        this.messages.push(userMsg);
        this.selectedImage = null; // Clear after sending

        await supabase.from('messages').insert({
            chat_id: chatId,
            role: 'user',
            content: content,
            image_url: imageUrl // Assuming column exists or will be added
        });

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

            this.messages.push({ role: 'assistant', content: '' });
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
            await supabase.from('messages').insert({
                chat_id: chatId,
                role: 'assistant',
                content: fullAssistantContent
            });

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
