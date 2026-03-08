<script lang="ts">
    import Sidebar from "$lib/components/Sidebar.svelte";
    import { chatState } from "$lib/state/chat.svelte";
    import { 
        BarChart3, 
        MessageSquare, 
        Bot, 
        TrendingUp, 
        Calendar,
        Loader2,
        RefreshCw
    } from "lucide-svelte";
    import { onMount } from "svelte";

    type AnalyticsResponse = {
        stats: {
            totalChats: number;
            totalMessages: number;
            totalIndicators: number;
            recentChatsLast7Days: number;
        };
        agentModes: Record<string, number>;
        recentIndicators: Array<{
            name: string;
            created_at: string;
        }>;
        period: string;
    };

    let sidebarOpen = $state(true);
    let isLoading = $state(true);
    let analytics = $state<AnalyticsResponse | null>(null);
    let error = $state<string | null>(null);

    onMount(() => {
        loadAnalytics();
    });

    async function loadAnalytics() {
        isLoading = true;
        error = null;
        
        try {
            const url = `/api/analytics?biglotUserId=${encodeURIComponent(chatState.biglotUserId)}`;
            const res = await fetch(url);
            
            if (!res.ok) {
                throw new Error('Failed to load analytics');
            }
            
            analytics = await res.json() as AnalyticsResponse;
        } catch (e: any) {
            error = e.message || 'Failed to load analytics';
            console.error('Analytics error:', e);
        } finally {
            isLoading = false;
        }
    }

    function getModeLabel(mode: string): string {
        const labels: Record<string, string> = {
            'coach': 'Trading Coach',
            'recovery': 'Recovery',
            'analyst': 'Market Analyst',
            'pinescript': 'PineScript Engineer'
        };
        return labels[mode] || mode;
    }

    function getModeColor(mode: string): string {
        const colors: Record<string, string> = {
            'coach': 'bg-green-500',
            'recovery': 'bg-red-500',
            'analyst': 'bg-blue-500',
            'pinescript': 'bg-purple-500'
        };
        return colors[mode] || 'bg-gray-500';
    }

    function formatDate(dateStr: string): string {
        return new Date(dateStr).toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }
</script>

<div class="flex h-full overflow-hidden bg-background text-foreground font-sans">
    <Sidebar bind:isOpen={sidebarOpen} />

    <main 
        class="flex-1 flex flex-col overflow-hidden h-full transition-all duration-300"
        class:ml-64={sidebarOpen}
        class:ml-0={!sidebarOpen}
    >
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-border/50">
            <div class="flex-1">
                <h1 class="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-white">
                    Analytics Dashboard
                </h1>
                <p class="text-xs text-muted-foreground">
                    Track your trading assistant usage
                </p>
            </div>
            <button 
                onclick={loadAnalytics}
                disabled={isLoading}
                class="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-colors disabled:opacity-50"
            >
                <RefreshCw size={16} class={isLoading ? 'animate-spin' : ''} />
                <span class="text-sm">Refresh</span>
            </button>
        </div>

        <!-- Analytics Content -->
        <div class="flex-1 overflow-y-auto px-6 py-6">
            {#if isLoading}
                <div class="flex items-center justify-center h-64">
                    <Loader2 size={32} class="animate-spin text-primary" />
                </div>
            {:else if error}
                <div class="glass-panel p-8 text-center">
                    <div class="text-red-400 mb-2">Failed to load analytics</div>
                    <div class="text-muted-foreground text-sm">{error}</div>
                </div>
            {:else if analytics}
                <!-- Stats Cards -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <!-- Total Chats -->
                    <div class="glass-panel p-5">
                        <div class="flex items-center gap-3">
                            <div class="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                                <MessageSquare size={20} />
                            </div>
                            <div>
                                <div class="text-2xl font-bold">{analytics.stats.totalChats}</div>
                                <div class="text-xs text-muted-foreground">Total Chats</div>
                            </div>
                        </div>
                    </div>

                    <!-- Total Messages -->
                    <div class="glass-panel p-5">
                        <div class="flex items-center gap-3">
                            <div class="p-2 rounded-lg bg-green-500/20 text-green-400">
                                <Bot size={20} />
                            </div>
                            <div>
                                <div class="text-2xl font-bold">{analytics.stats.totalMessages}</div>
                                <div class="text-xs text-muted-foreground">Total Messages</div>
                            </div>
                        </div>
                    </div>

                    <!-- Recent Activity -->
                    <div class="glass-panel p-5">
                        <div class="flex items-center gap-3">
                            <div class="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                                <TrendingUp size={20} />
                            </div>
                            <div>
                                <div class="text-2xl font-bold">{analytics.stats.recentChatsLast7Days}</div>
                                <div class="text-xs text-muted-foreground">This Week</div>
                            </div>
                        </div>
                    </div>

                    <!-- Indicators -->
                    <div class="glass-panel p-5">
                        <div class="flex items-center gap-3">
                            <div class="p-2 rounded-lg bg-orange-500/20 text-orange-400">
                                <BarChart3 size={20} />
                            </div>
                            <div>
                                <div class="text-2xl font-bold">{analytics.stats.totalIndicators}</div>
                                <div class="text-xs text-muted-foreground">Indicators Created</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Agent Mode Usage -->
                <div class="glass-panel p-5 mb-6">
                    <h2 class="text-base font-semibold mb-4 flex items-center gap-2">
                        <Bot size={18} class="text-primary" />
                        Agent Mode Usage
                    </h2>
                    
                    {#if Object.keys(analytics.agentModes).length > 0}
                        <div class="space-y-3">
                            {#each Object.entries(analytics.agentModes) as [mode, count]}
                                {@const total = Object.values(analytics.agentModes).reduce((a: any, b: any) => a + b, 0)}
                                {@const percentage = Math.round((count / total) * 100)}
                                <div>
                                    <div class="flex items-center justify-between mb-1">
                                        <span class="text-sm">{getModeLabel(mode)}</span>
                                        <span class="text-sm text-muted-foreground">{count} ({percentage}%)</span>
                                    </div>
                                    <div class="h-2 bg-secondary rounded-full overflow-hidden">
                                        <div 
                                            class="h-full {getModeColor(mode)} transition-all duration-500"
                                            style="width: {percentage}%"
                                        ></div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <div class="text-muted-foreground text-sm text-center py-4">
                            No agent mode data yet
                        </div>
                    {/if}
                </div>

                <!-- Recent Indicators -->
                <div class="glass-panel p-5">
                    <h2 class="text-base font-semibold mb-4 flex items-center gap-2">
                        <BarChart3 size={18} class="text-primary" />
                        Recent Indicators
                    </h2>
                    
                    {#if analytics.recentIndicators.length > 0}
                        <div class="space-y-2">
                            {#each analytics.recentIndicators as indicator}
                                <div class="flex items-center justify-between py-2 px-3 bg-secondary/30 rounded-lg">
                                    <span class="text-sm">{indicator.name}</span>
                                    <span class="text-xs text-muted-foreground">
                                        {formatDate(indicator.created_at)}
                                    </span>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <div class="text-muted-foreground text-sm text-center py-4">
                            No indicators created yet
                        </div>
                    {/if}
                </div>

                <!-- Period Info -->
                <div class="mt-6 text-center text-xs text-muted-foreground">
                    <Calendar size={12} class="inline mr-1" />
                    Showing analytics for {analytics.period.replace('_', ' ')}
                </div>
            {/if}
        </div>
    </main>
</div>
