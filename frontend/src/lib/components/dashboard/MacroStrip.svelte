<script lang="ts">
    import type { MacroData } from '$lib/types/dashboardMeta';

    let {
        macro,
        chrome = 'standalone'
    }: {
        macro: MacroData | null;
        chrome?: 'standalone' | 'embedded';
    } = $props();

    function fmtChange(n: number): string {
        return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
    }

    const signalColor = $derived(
        macro?.goldSignal === 'bullish' ? '#22c55e'
        : macro?.goldSignal === 'bearish' ? '#ef4444'
        : '#f59e0b'
    );
    const signalGlow = $derived(
        macro?.goldSignal === 'bullish' ? 'rgba(34,197,94,0.25)'
        : macro?.goldSignal === 'bearish' ? 'rgba(239,68,68,0.25)'
        : 'rgba(245,158,11,0.25)'
    );
</script>

<div class="macro-strip" class:macro-strip-embedded={chrome === 'embedded'}>
    {#if macro}
        <div class="ticker-track">
            {#each [0, 1, 2, 3] as _copy}
                <div class="ticker-content">
                    {#if macro.dxy}
                        <div class="macro-item">
                            <span class="macro-label">DXY</span>
                            <span class="macro-value">{macro.dxy.price.toFixed(2)}</span>
                            <span class="macro-change" class:up={macro.dxy.change > 0} class:down={macro.dxy.change < 0}>
                                {fmtChange(macro.dxy.change)}
                            </span>
                        </div>
                    {/if}

                    {#if macro.tnx}
                        <div class="macro-item">
                            <span class="macro-label">10Y</span>
                            <span class="macro-value">{macro.tnx.price.toFixed(2)}%</span>
                            <span class="macro-change" class:up={macro.tnx.change > 0} class:down={macro.tnx.change < 0}>
                                {fmtChange(macro.tnx.change)}
                            </span>
                        </div>
                    {/if}

                    {#if macro.realYield !== null}
                        <div class="macro-item">
                            <span class="macro-label">Real Yield</span>
                            <span class="macro-value">{macro.realYield.toFixed(2)}%</span>
                        </div>
                    {/if}

                    {#if macro.spx}
                        <div class="macro-item">
                            <span class="macro-label">SPX</span>
                            <span class="macro-value">{macro.spx.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                            <span class="macro-change" class:up={macro.spx.change > 0} class:down={macro.spx.change < 0}>
                                {fmtChange(macro.spx.change)}
                            </span>
                        </div>
                    {/if}

                    <div class="macro-signal" style="background:{signalColor}10; box-shadow: 0 0 12px {signalGlow}, inset 0 0 0 1px {signalColor}30">
                        <span class="macro-signal-dot" style="background:{signalColor}; box-shadow: 0 0 6px {signalColor}"></span>
                        <span class="macro-signal-label">Gold</span>
                        <span class="macro-signal-value" style="color:{signalColor}">
                            {macro.goldSignal.toUpperCase()}
                        </span>
                    </div>

                    <span class="ticker-dot">·</span>
                </div>
            {/each}
        </div>
    {:else}
        <div class="macro-empty">Macro data unavailable</div>
    {/if}
</div>

<style>
    .macro-strip {
        background: rgba(10, 12, 18, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 12px;
        overflow: hidden;
        position: relative;
    }
    .macro-strip-embedded {
        background: transparent;
        border: 0;
        border-radius: 0;
    }
    .ticker-track {
        display: flex;
        width: max-content;
        animation: scroll 30s linear infinite;
    }
    .ticker-track:hover {
        animation-play-state: paused;
    }
    @keyframes scroll {
        0% { transform: translateX(0); }
        100% { transform: translateX(-25%); }
    }
    .ticker-content {
        display: flex;
        align-items: stretch;
        flex-shrink: 0;
    }
    .ticker-dot {
        display: flex;
        align-items: center;
        padding: 0 1.2rem;
        color: rgba(255, 255, 255, 0.12);
        font-size: 1.4rem;
        line-height: 1;
    }
    .macro-item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0.65rem 1.25rem;
        white-space: nowrap;
        border-right: 1px solid rgba(255, 255, 255, 0.04);
    }
    .macro-label {
        font-size: 0.58rem;
        font-weight: 700;
        color: rgba(255,255,255,0.25);
        text-transform: uppercase;
        letter-spacing: 0.07em;
    }
    .macro-value {
        font-size: 0.85rem;
        font-weight: 700;
        color: rgba(255,255,255,0.88);
        font-variant-numeric: tabular-nums;
    }
    .macro-change {
        font-size: 0.62rem;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: rgba(255,255,255,0.3);
    }
    .macro-change.up { color: #22c55e; }
    .macro-change.down { color: #ef4444; }
    .macro-signal {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0.4rem 0.9rem;
        margin: 0.35rem 0.5rem;
        border-radius: 6px;
        white-space: nowrap;
        align-self: center;
    }
    .macro-signal-dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        flex-shrink: 0;
    }
    .macro-signal-label {
        font-size: 0.55rem;
        color: rgba(255,255,255,0.3);
        text-transform: uppercase;
        letter-spacing: 0.07em;
        font-weight: 600;
    }
    .macro-signal-value {
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.08em;
    }
    .macro-empty {
        font-size: 0.75rem;
        color: rgba(255,255,255,0.25);
        padding: 1rem;
        width: 100%;
        text-align: center;
    }
</style>
