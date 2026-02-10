export type Message = {
    role: 'user' | 'assistant' | 'system';
    content: string;
};

class ChatState {
    messages = $state<Message[]>([]);
    isLoading = $state(false);

    async sendMessage(content: string) {
        if (!content.trim()) return;

        // Add user message
        this.messages.push({ role: 'user', content });
        this.isLoading = true;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ messages: this.messages })
            });

            if (!response.ok) throw new Error('Failed to fetch');

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No reader');

            this.messages.push({ role: 'assistant', content: '' });
            const currentMessageIndex = this.messages.length - 1;

            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                this.messages[currentMessageIndex].content += chunk;
            }

        } catch (error) {
            console.error(error);
            this.messages.push({ role: 'assistant', content: "Sorry, I encountered an error." });
        } finally {
            this.isLoading = false;
        }
    }
}

export const chatState = new ChatState();
