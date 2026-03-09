<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import AgentOrb from './AgentOrb.svelte';

    type WatchlistItem = {
        symbol: string;
        label: string;
        price: number;
        change: number;
        currency: string;
    };

    let items = $state<WatchlistItem[]>([]);
    let loading = $state(true);
    let interval: ReturnType<typeof setInterval>;

    const GOLD_SYMBOLS = new Set(['GC=F', 'SI=F']);

    async function fetchWatchlist() {
        try {
            const res = await fetch('/api/watchlist');
            if (!res.ok) return;
            items = await res.json();
        } catch {
            // silently fail
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        fetchWatchlist();
        interval = setInterval(fetchWatchlist, 30_000);
    });

    onDestroy(() => {
        clearInterval(interval);
    });

    function fmtPrice(item: WatchlistItem): string {
        if (item.currency === '%') return `${item.price.toFixed(2)}%`;
        if (item.currency === 'USD') {
            if (item.price >= 10_000) return `$${item.price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
            if (item.price >= 100) return `$${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            return `$${item.price.toFixed(4)}`;
        }
        return item.price.toFixed(2);
    }

    function fmtChange(change: number): string {
        return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    }
</script>

<div class="watchlist-bar" aria-label="Live market watchlist">
    {#if loading}
        <div class="wl-loading">Loading markets...</div>
    {:else if items.length > 0}
        <div class="ticker-track">
            {#each [0, 1, 2, 3] as _copy}
                <div class="ticker-content">
                    {#each items as item (item.symbol)}
                        {@const isUp = item.change >= 0}
                        {@const isGold = GOLD_SYMBOLS.has(item.symbol)}
                        <div class="wl-item" class:wl-gold={isGold}>
                            <span class="wl-label" class:wl-label-gold={isGold}>{item.label}</span>
                            <span class="wl-price">{fmtPrice(item)}</span>
                            <span class="wl-change" class:wl-up={isUp} class:wl-down={!isUp}>
                                {fmtChange(item.change)}
                            </span>
                        </div>
                    {/each}
                    <span class="ticker-dot"><AgentOrb size="sm" showLabel={false} /></span>
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .watchlist-bar {
        overflow: hidden;
        background: rgba(0, 0, 0, 0.25);
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        min-height: 32px;
        flex-shrink: 0;
    }

    .wl-loading {
        font-size: 0.65rem;
        color: rgba(255,255,255,0.3);
        padding: 0 0.75rem;
        line-height: 32px;
    }

    .ticker-track {
        display: flex;
        width: max-content;
        animation: wl-scroll 35s linear infinite;
    }
    .ticker-track:hover {
        animation-play-state: paused;
    }
    @keyframes wl-scroll {
        0% { transform: translateX(0); }
        100% { transform: translateX(-25%); }
    }
    .ticker-content {
        display: flex;
        align-items: center;
        flex-shrink: 0;
    }
    .ticker-dot {
        display: flex;
        align-items: center;
        padding: 0 1rem;
        color: rgba(255, 255, 255, 0.12);
        font-size: 0.5rem;
    }

    .wl-item {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0 0.75rem;
        border-right: 1px solid rgba(255,255,255,0.05);
        white-space: nowrap;
        flex-shrink: 0;
        height: 32px;
    }

    .wl-gold {
        background: rgba(245, 158, 11, 0.04);
    }

    .wl-label {
        font-size: 0.65rem;
        font-weight: 600;
        color: rgba(255,255,255,0.4);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    .wl-label-gold {
        color: #f59e0b;
    }

    .wl-price {
        font-size: 0.72rem;
        font-weight: 600;
        color: rgba(255,255,255,0.85);
        font-variant-numeric: tabular-nums;
    }

    .wl-change {
        font-size: 0.65rem;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
    }
    .wl-up   { color: #22c55e; }
    .wl-down { color: #ef4444; }
</style>
