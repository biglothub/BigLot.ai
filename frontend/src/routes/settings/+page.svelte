<script lang="ts">
    import Sidebar from "$lib/components/Sidebar.svelte";
    import { chatState } from "$lib/state/chat.svelte";
    import type { AIModel, AIProvider } from "$lib/server/aiProvider.server";
    import type { PageData } from "./$types";
    import { Settings2, Bot, Moon, Sun, Keyboard, Download, Trash2, Loader2, AlertTriangle, MessageSquareText, Sparkles, Users, Layers3, Check } from "lucide-svelte";
    import { onMount } from "svelte";

    let { data }: { data: PageData } = $props();

    const AI_MODEL_LIST: AIModel[] = ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'deepseek', 'deepseek-r1', 'claude-sonnet', 'claude-haiku', 'gemini-2.5-flash', 'gemini-2.5-pro', 'minimax-text-01', 'minimax-m1', 'minimax-m2.5', 'minimax-m2.5-highspeed'];

    let sidebarOpen = $state(true);
    
    // Settings state
    let isSaving = $state(false);
    let saveSuccess = $state(false);
    let showKeyboardShortcuts = $state(false);
    let activeModelSection = $state<'normal' | 'agent' | 'discussion' | 'fallback'>('discussion');
    
    // Theme
    let theme = $state<'dark' | 'light'>('dark');
    
    // Export state
    let isExporting = $state(false);
    let exportFormat = $state<'markdown' | 'json'>('markdown');

    function isStoredAgentMode(value: string | null): value is typeof chatState.agentMode {
        return value === 'coach' || value === 'recovery' || value === 'analyst' || value === 'pinescript' || value === 'gold' || value === 'macro' || value === 'portfolio';
    }

    onMount(() => {
        // Load current model from environment
        // Note: This is server-configured, but we show current status
        const saved = localStorage.getItem('biglot.agentMode');
        if (isStoredAgentMode(saved)) {
            chatState.setAgentMode(saved);
        }
    });

    type ModelSectionId = 'normal' | 'agent' | 'discussion' | 'fallback';
    type ModelOptionMeta = {
        id: AIModel;
        label: string;
        note: string;
        provider: AIProvider;
    };

    type PanelistCard = {
        id: 'bull' | 'bear' | 'moderator';
        title: string;
        subtitle: string;
        emoji: string;
        model: AIModel;
        provider: AIProvider;
        temperature: number;
    };

    const MODEL_META: Record<AIModel, ModelOptionMeta> = {
        'gpt-4o': { id: 'gpt-4o', label: 'GPT-4o', note: 'Strong general reasoning and multimodal balance', provider: 'openai' },
        'gpt-4o-mini': { id: 'gpt-4o-mini', label: 'GPT-4o Mini', note: 'Faster, cheaper general-purpose responses', provider: 'openai' },
        'o3-mini': { id: 'o3-mini', label: 'o3 Mini', note: 'Compact reasoning-first model', provider: 'openai' },
        'deepseek': { id: 'deepseek', label: 'DeepSeek Chat', note: 'Fast text model with strong value for analysis', provider: 'deepseek' },
        'deepseek-r1': { id: 'deepseek-r1', label: 'DeepSeek R1', note: 'Heavier reasoning path for judgment and synthesis', provider: 'deepseek' },
        'claude-sonnet': { id: 'claude-sonnet', label: 'Claude Sonnet', note: 'Long-form writing and nuanced reasoning', provider: 'anthropic' },
        'claude-haiku': { id: 'claude-haiku', label: 'Claude Haiku', note: 'Fast Claude tier for lightweight tasks', provider: 'anthropic' },
        'gemini-2.5-flash': { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'Speed-optimized Gemini variant', provider: 'google' },
        'gemini-2.5-pro': { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', note: 'Higher-capability Gemini for complex jobs', provider: 'google' },
        'minimax-text-01': { id: 'minimax-text-01', label: 'MiniMax Text 01', note: 'MiniMax text generation baseline', provider: 'minimax' },
        'minimax-m1': { id: 'minimax-m1', label: 'MiniMax M1', note: 'MiniMax reasoning-oriented model', provider: 'minimax' },
        'minimax-m2.5': { id: 'minimax-m2.5', label: 'MiniMax M2.5', note: 'Balanced MiniMax flagship', provider: 'minimax' },
        'minimax-m2.5-highspeed': { id: 'minimax-m2.5-highspeed', label: 'MiniMax M2.5 Highspeed', note: 'Speed-tuned MiniMax variant', provider: 'minimax' }
    };

    const sectionMeta: Record<ModelSectionId, {
        title: string;
        description: string;
        icon: typeof MessageSquareText;
        eyebrow: string;
    }> = {
        normal: {
            title: 'Normal',
            description: 'Direct replies for the standard chat flow.',
            icon: MessageSquareText,
            eyebrow: 'One model, low ceremony'
        },
        agent: {
            title: 'Agent',
            description: 'Tool-using mode for planning, research, and structured execution.',
            icon: Sparkles,
            eyebrow: 'Higher capability, more orchestration'
        },
        discussion: {
            title: 'Discussion',
            description: 'Bull, bear, and moderator each get their own seat in the panel.',
            icon: Users,
            eyebrow: 'Multi-model lineup'
        },
        fallback: {
            title: 'Shared Fallback',
            description: 'Baseline model used when a mode-specific override is not set.',
            icon: Layers3,
            eyebrow: 'Safety net'
        }
    };

    const discussionPanelistMeta: Record<PanelistCard['id'], Omit<PanelistCard, 'model' | 'provider' | 'temperature'>> = {
        bull: { id: 'bull', title: 'Bull Analyst', subtitle: 'Optimistic case', emoji: '🐂' },
        bear: { id: 'bear', title: 'Bear Analyst', subtitle: 'Risk-aware case', emoji: '🐻' },
        moderator: { id: 'moderator', title: 'Moderator', subtitle: 'Final ruling', emoji: '⚖️' }
    };

    function handleModelSelectionAttempt() {
        alert('Models are configured server-side via AI_MODEL, NORMAL_AI_MODEL, AGENT_AI_MODEL, and DISCUSSION_* environment variables. Restart the server after changing .env to apply.');
    }

    function formatModelLabel(model: AIModel): string {
        return MODEL_META[model]?.label ?? model;
    }

    function formatProvider(provider: AIProvider): string {
        if (provider === 'openai') return 'OpenAI';
        if (provider === 'deepseek') return 'DeepSeek';
        if (provider === 'anthropic') return 'Anthropic';
        if (provider === 'google') return 'Google';
        return 'MiniMax';
    }

    function getProviderTone(provider: AIProvider): string {
        if (provider === 'openai') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
        if (provider === 'deepseek') return 'bg-sky-500/10 text-sky-300 border-sky-500/20';
        if (provider === 'anthropic') return 'bg-orange-500/10 text-orange-300 border-orange-500/20';
        if (provider === 'google') return 'bg-blue-500/10 text-blue-300 border-blue-500/20';
        return 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20';
    }

    const currentSection = $derived(sectionMeta[activeModelSection]);
    const CurrentSectionIcon = $derived(currentSection.icon);
    const normalRuntime = $derived(data.modelRuntime.normal);
    const agentRuntime = $derived(data.modelRuntime.agent);
    const sharedFallbackRuntime = $derived(data.modelRuntime.sharedFallback);
    const discussionCards = $derived(
        data.modelRuntime.discussion.panelists.map((panelist) => ({
            ...discussionPanelistMeta[panelist.id],
            model: panelist.model,
            provider: panelist.provider,
            temperature: panelist.temperature
        }))
    );

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
            <div class="glass-panel p-5 md:p-6">
                <div class="flex items-start gap-3 mb-5">
                    <div class="p-2 rounded-lg bg-primary/20 text-primary">
                        <Bot size={20} />
                    </div>
                    <div>
                        <h2 class="text-base font-semibold">AI Model</h2>
                        <p class="text-xs text-muted-foreground">Server-configured runtime map, redesigned like a Claude-style picker</p>
                    </div>
                </div>

                <div class="rounded-2xl border border-white/10 bg-black/15 p-2 md:p-3">
                    <div class="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
                        <div class="space-y-1.5 rounded-2xl border border-white/6 bg-white/[0.02] p-2">
                            {#each Object.entries(sectionMeta) as [sectionId, meta]}
                                {@const sectionKey = sectionId as ModelSectionId}
                                {@const Icon = meta.icon}
                                <button
                                    type="button"
                                    onclick={() => activeModelSection = sectionKey}
                                    class={`w-full rounded-2xl border px-3 py-3 text-left transition-all ${
                                        activeModelSection === sectionKey
                                            ? 'border-primary/30 bg-primary/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                                            : 'border-white/5 bg-transparent'
                                    }`}
                                >
                                    <div class="flex items-center gap-2.5">
                                        <div class={`rounded-xl p-2 ${activeModelSection === sectionKey ? 'bg-primary/15' : 'bg-white/5'}`}>
                                            <Icon size={16} />
                                        </div>
                                        <div class="min-w-0">
                                            <div class="flex items-center gap-2">
                                                <span class="text-sm font-medium">{meta.title}</span>
                                                {#if activeModelSection === sectionKey}
                                                    <span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary">
                                                        <Check size={12} />
                                                    </span>
                                                {/if}
                                            </div>
                                            <p class="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
                                        </div>
                                    </div>
                                </button>
                            {/each}
                        </div>

                        <div class="rounded-2xl border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 md:p-5">
                            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <p class="text-[11px] uppercase tracking-[0.22em] text-primary/70">{currentSection.eyebrow}</p>
                                    <div class="mt-2 flex items-center gap-2.5">
                                        <div class="rounded-xl bg-primary/10 p-2 text-primary">
                                            <CurrentSectionIcon size={18} />
                                        </div>
                                        <div>
                                            <h3 class="text-lg font-semibold">{currentSection.title}</h3>
                                            <p class="text-sm text-muted-foreground">{currentSection.description}</p>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onclick={handleModelSelectionAttempt}
                                    class="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-white/8"
                                >
                                    Read-only from <code class="rounded bg-black/30 px-1.5 py-0.5">.env</code>
                                </button>
                            </div>

                            {#if activeModelSection === 'discussion'}
                                <div class="mt-5 grid gap-3 xl:grid-cols-3">
                                    {#each discussionCards as card}
                                        <div class="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                                            <div class="flex items-start justify-between gap-3">
                                                <div>
                                                    <div class="text-lg">{card.emoji}</div>
                                                    <h4 class="mt-2 text-sm font-semibold">{card.title}</h4>
                                                    <p class="text-xs text-muted-foreground">{card.subtitle}</p>
                                                </div>
                                                <span class={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] ${getProviderTone(card.provider)}`}>
                                                    {formatProvider(card.provider)}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onclick={handleModelSelectionAttempt}
                                                class="mt-4 w-full rounded-xl border border-primary/25 bg-primary/8 px-3 py-3 text-left transition-colors hover:bg-primary/12"
                                            >
                                                <div class="flex items-start justify-between gap-3">
                                                    <div>
                                                        <div class="text-sm font-medium text-foreground">{formatModelLabel(card.model)}</div>
                                                        <div class="mt-1 text-xs text-muted-foreground">{MODEL_META[card.model].note}</div>
                                                    </div>
                                                    <span class="rounded-full bg-white/6 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                                                        T={card.temperature.toFixed(1)}
                                                    </span>
                                                </div>
                                            </button>
                                        </div>
                                    {/each}
                                </div>

                                <div class="mt-5 rounded-2xl border border-white/8 bg-black/15 p-4">
                                    <div class="flex items-center justify-between gap-3">
                                        <div>
                                            <h4 class="text-sm font-semibold">Discussion Presets</h4>
                                            <p class="text-xs text-muted-foreground">Each role is configured independently for the debate panel.</p>
                                        </div>
                                        <div class="flex flex-wrap justify-end gap-2">
                                            {#each data.modelRuntime.discussion.envKeys as envKey}
                                                <code class="rounded-lg bg-white/5 px-2 py-1 text-[11px] text-muted-foreground">{envKey}</code>
                                            {/each}
                                        </div>
                                    </div>
                                </div>
                            {:else}
                                {@const runtime = activeModelSection === 'normal' ? normalRuntime : activeModelSection === 'agent' ? agentRuntime : sharedFallbackRuntime}
                                <div class="mt-5 rounded-2xl border border-primary/20 bg-primary/7 p-4">
                                    <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <p class="text-[11px] uppercase tracking-[0.22em] text-primary/75">Active Model</p>
                                            <h4 class="mt-2 text-xl font-semibold">{formatModelLabel(runtime.model)}</h4>
                                            <p class="mt-1 text-sm text-muted-foreground">{MODEL_META[runtime.model].note}</p>
                                        </div>
                                        <div class="flex flex-wrap gap-2">
                                            <span class={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${getProviderTone(runtime.provider)}`}>
                                                {formatProvider(runtime.provider)}
                                            </span>
                                            {#each runtime.envKeys as envKey}
                                                <code class="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-muted-foreground">{envKey}</code>
                                            {/each}
                                        </div>
                                    </div>
                                </div>

                                <div class="mt-5 space-y-2">
                                    <div class="flex items-center justify-between gap-3">
                                        <h4 class="text-sm font-semibold">Available Models</h4>
                                        <p class="text-xs text-muted-foreground">Clicking any option shows where to change it in <code class="rounded bg-black/30 px-1.5 py-0.5">.env</code>.</p>
                                    </div>
                                    <div class="space-y-2">
                                        {#each AI_MODEL_LIST as model}
                                            {@const meta = MODEL_META[model]}
                                            <button
                                                type="button"
                                                onclick={handleModelSelectionAttempt}
                                                class={`flex w-full items-start justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition-all ${
                                                    runtime.model === model
                                                        ? 'border-primary/30 bg-primary/8'
                                                        : 'border-white/8 bg-white/[0.02]'
                                                }`}
                                            >
                                                <div class="min-w-0">
                                                    <div class="flex items-center gap-2">
                                                        <span class="text-sm font-medium">{meta.label}</span>
                                                        <span class={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${getProviderTone(meta.provider)}`}>
                                                            {formatProvider(meta.provider)}
                                                        </span>
                                                    </div>
                                                    <p class="mt-1 text-xs text-muted-foreground">{meta.note}</p>
                                                </div>
                                                {#if runtime.model === model}
                                                    <span class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/18 text-primary">
                                                        <Check size={14} />
                                                    </span>
                                                {/if}
                                            </button>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        </div>
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
