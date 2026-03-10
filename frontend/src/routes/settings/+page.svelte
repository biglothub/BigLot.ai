<script lang="ts">
    import Sidebar from "$lib/components/Sidebar.svelte";
    import { chatState } from "$lib/state/chat.svelte";
    import type { AIModel } from "$lib/server/aiProvider.server";
    const AI_MODEL_LIST: AIModel[] = ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'deepseek', 'deepseek-r1', 'claude-sonnet', 'claude-haiku', 'gemini-2.5-flash', 'gemini-2.5-pro'];
    import { Settings2, Bot, Moon, Sun, Keyboard, Download, Trash2, Check, Loader2, AlertTriangle } from "lucide-svelte";
    import { onMount } from "svelte";

    let sidebarOpen = $state(true);
    
    // Settings state
    let currentModel = $state<AIModel>('gpt-4o');
    let isSaving = $state(false);
    let saveSuccess = $state(false);
    let showKeyboardShortcuts = $state(false);
    
    // Theme
    let theme = $state<'dark' | 'light'>('dark');
    
    // Export state
    let isExporting = $state(false);
    let exportFormat = $state<'markdown' | 'json'>('markdown');

    onMount(() => {
        // Load current model from environment
        // Note: This is server-configured, but we show current status
        const saved = localStorage.getItem('biglot.agentMode');
        if (saved) {
            chatState.setAgentMode(saved as any);
        }
    });

    function handleModelChange(event: Event) {
        const select = event.target as HTMLSelectElement;
        // Note: Model switching requires server restart
        // This is informational display
        alert('AI Model is configured server-side via AI_MODEL environment variable. Restart the server after changing .env to apply.');
    }

    function toggleTheme() {
        theme = theme === 'dark' ? 'light' : 'dark';
        // TODO: Implement theme toggle
        document.documentElement.classList.toggle('light', theme === 'light');
    }

    async function handleExportChats() {
        if (chatState.allChats.length === 0) {
            alert('No chats to export');
            return;
        }
        
        isExporting = true;
        
        try {
            // Export all chats with messages
            const exportData = {
                exportedAt: new Date().toISOString(),
                chats: await Promise.all(
                    chatState.allChats.map(async (chat) => {
                        await chatState.loadChat(chat.id);
                        return {
                            title: chat.title,
                            created_at: chat.created_at,
                            messages: chatState.messages
                        };
                    })
                )
            };

            let content: string;
            let filename: string;
            let mimeType: string;

            if (exportFormat === 'markdown') {
                content = exportData.chats.map(chat => {
                    return `# ${chat.title}\n\nCreated: ${new Date(chat.created_at).toLocaleString()}\n\n` +
                        chat.messages.map(m => `**${m.role}:** ${m.content}`).join('\n\n');
                }).join('\n\n---\n\n');
                filename = `biglot-chats-${Date.now()}.md`;
                mimeType = 'text/markdown';
            } else {
                content = JSON.stringify(exportData, null, 2);
                filename = `biglot-chats-${Date.now()}.json`;
                mimeType = 'application/json';
            }

            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export chats');
        } finally {
            isExporting = false;
        }
    }

    async function handleClearAllChats() {
        if (!confirm('Are you sure you want to delete ALL chats? This cannot be undone.')) {
            return;
        }

        for (const chat of chatState.allChats) {
            await chatState.deleteChat(chat.id);
        }
        await chatState.loadAllChats();
    }

    // Keyboard shortcuts
    const shortcuts = [
        { key: 'Ctrl + Enter', action: 'Send message' },
        { key: 'Ctrl + K', action: 'New chat' },
        { key: 'Escape', action: 'Close sidebar' },
        { key: '/', action: 'Focus input' },
    ];
</script>

<div class="flex h-full overflow-hidden bg-background text-foreground font-sans">
    <Sidebar bind:isOpen={sidebarOpen} />

    <main 
        class="flex-1 flex flex-col overflow-hidden h-full transition-all duration-300"
        class:ml-64={sidebarOpen}
        class:ml-0={!sidebarOpen}
    >
        <!-- Header -->
        <div class="flex items-center gap-3 px-6 py-4 border-b border-border/50">
            <div class="flex-1">
                <h1 class="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-white">
                    Settings
                </h1>
                <p class="text-xs text-muted-foreground">
                    Configure your BigLot.ai preferences
                </p>
            </div>
        </div>

        <!-- Settings Content -->
        <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            <!-- AI Model Section -->
            <div class="glass-panel p-5">
                <div class="flex items-center gap-3 mb-4">
                    <div class="p-2 rounded-lg bg-primary/20 text-primary">
                        <Bot size={20} />
                    </div>
                    <div>
                        <h2 class="text-base font-semibold">AI Model</h2>
                        <p class="text-xs text-muted-foreground">Configure the AI model used for chat and indicators</p>
                    </div>
                </div>

                <div class="space-y-3">
                    <div>
                        <label for="current-model" class="block text-sm text-muted-foreground mb-2">Current Model</label>
                        <select 
                            id="current-model"
                            class="w-full max-w-xs bg-secondary/50 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary/40"
                            onchange={handleModelChange}
                            disabled
                        >
                            {#each AI_MODEL_LIST as model}
                                <option value={model} selected={model === currentModel}>
                                    {model === 'gpt-4o' ? 'GPT-4o (Default)' :
                                     model === 'gpt-4o-mini' ? 'GPT-4o Mini' :
                                     model === 'o3-mini' ? 'o3 Mini' :
                                     model === 'deepseek' ? 'DeepSeek Chat' :
                                     model === 'deepseek-r1' ? 'DeepSeek R1' :
                                     model === 'claude-sonnet' ? 'Claude Sonnet 4' :
                                     model === 'claude-haiku' ? 'Claude Haiku 4.5' :
                                     model === 'gemini-2.5-flash' ? 'Gemini 2.5 Flash' :
                                     model === 'gemini-2.5-pro' ? 'Gemini 2.5 Pro' : model}
                                </option>
                            {/each}
                        </select>
                        <p class="text-xs text-muted-foreground mt-2">
                            Model is configured via <code class="bg-secondary px-1 rounded">AI_MODEL</code> environment variable.
                            Restart server after changing.
                        </p>
                    </div>
                </div>
            </div>

            <!-- Theme Section -->
            <div class="glass-panel p-5">
                <div class="flex items-center gap-3 mb-4">
                    <div class="p-2 rounded-lg bg-primary/20 text-primary">
                        {#if theme === 'dark'}<Moon size={20} />{:else}<Sun size={20} />{/if}
                    </div>
                    <div>
                        <h2 class="text-base font-semibold">Appearance</h2>
                        <p class="text-xs text-muted-foreground">Customize the look and feel</p>
                    </div>
                </div>

                <div class="flex items-center gap-4">
                    <button 
                        onclick={toggleTheme}
                        class="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                    >
                        {#if theme === 'dark'}<Moon size={16} />{:else}<Sun size={16} />{/if}
                        <span class="text-sm">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                    </button>
                </div>
            </div>

            <!-- Keyboard Shortcuts Section -->
            <div class="glass-panel p-5">
                <div class="flex items-center gap-3 mb-4">
                    <div class="p-2 rounded-lg bg-primary/20 text-primary">
                        <Keyboard size={20} />
                    </div>
                    <div>
                        <h2 class="text-base font-semibold">Keyboard Shortcuts</h2>
                        <p class="text-xs text-muted-foreground">Quick actions using keyboard</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3 max-w-md">
                    {#each shortcuts as shortcut}
                        <div class="flex items-center justify-between py-2 px-3 bg-secondary/30 rounded-lg">
                            <span class="text-sm text-muted-foreground">{shortcut.action}</span>
                            <kbd class="px-2 py-1 bg-secondary rounded text-xs font-mono">{shortcut.key}</kbd>
                        </div>
                    {/each}
                </div>
            </div>

            <!-- Data Management Section -->
            <div class="glass-panel p-5">
                <div class="flex items-center gap-3 mb-4">
                    <div class="p-2 rounded-lg bg-primary/20 text-primary">
                        <Download size={20} />
                    </div>
                    <div>
                        <h2 class="text-base font-semibold">Data Management</h2>
                        <p class="text-xs text-muted-foreground">Export or delete your data</p>
                    </div>
                </div>

                <div class="space-y-4">
                    <div class="flex items-center gap-3">
                        <select 
                            bind:value={exportFormat}
                            class="bg-secondary/50 border border-white/10 rounded-lg px-3 py-2 text-sm"
                        >
                            <option value="markdown">Markdown</option>
                            <option value="json">JSON</option>
                        </select>
                        <button 
                            onclick={handleExportChats}
                            disabled={isExporting || chatState.allChats.length === 0}
                            class="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-colors disabled:opacity-50"
                        >
                            {#if isExporting}
                                <Loader2 size={16} class="animate-spin" />
                            {:else}
                                <Download size={16} />
                            {/if}
                            <span class="text-sm">Export Chats ({chatState.allChats.length})</span>
                        </button>
                    </div>

                    <div class="pt-4 border-t border-white/5">
                        <button 
                            onclick={handleClearAllChats}
                            class="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                        >
                            <Trash2 size={16} />
                            <span class="text-sm">Delete All Chats</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- About Section -->
            <div class="glass-panel p-5">
                <div class="flex items-center gap-3 mb-4">
                    <div class="p-2 rounded-lg bg-primary/20 text-primary">
                        <AlertTriangle size={20} />
                    </div>
                    <div>
                        <h2 class="text-base font-semibold">About</h2>
                        <p class="text-xs text-muted-foreground">Version and system info</p>
                    </div>
                </div>

                <div class="space-y-2 text-sm text-muted-foreground">
                    <p><span class="text-foreground">BigLot.ai</span> v1.0.0</p>
                    <p>Built with SvelteKit + Supabase + OpenAI</p>
                    <p class="text-xs pt-2">
                        <a href="https://github.com/biglothub/BigLot.ai" class="text-primary hover:underline">
                            GitHub Repository
                        </a>
                    </p>
                </div>
            </div>
        </div>
    </main>
</div>
