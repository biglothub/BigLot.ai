<script lang="ts">
    import type { MacroData } from '$lib/server/data/macro.data';

    let { macro }: { macro: MacroData | null } = $props();

    function fmtChange(n: number): string {
        return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
    }

    const signalColor = $derived(
        macro?.goldSignal === 'bullish' ? '#22c55e'
        : macro?.goldSignal === 'bearish' ? '#ef4444'
        : '#f59e0b'
    );
</script>

<div class="macro-strip">
    {#if macro}
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

        <div class="macro-signal" style="border-color:{signalColor}40; background:{signalColor}10">
            <span class="macro-signal-label">Gold Signal</span>
            <span class="macro-signal-value" style="color:{signalColor}">
                {macro.goldSignal.toUpperCase()}
            </span>
        </div>
    {:else}
        <div class="macro-empty">Macro data unavailable</div>
    {/if}
</div>

<style>
    .macro-strip {
        display: flex;
        align-items: stretch;
        gap: 0;
        background: rgba(13, 17, 23, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        overflow: hidden;
    }
    .macro-item {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 0.75rem 0.5rem;
        border-right: 1px solid rgba(255, 255, 255, 0.05);
        min-width: 0;
    }
    .macro-item:last-of-type { border-right: none; }
    .macro-label {
        font-size: 0.6rem;
        font-weight: 600;
        color: rgba(255,255,255,0.35);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .macro-value {
        font-size: 0.9rem;
        font-weight: 700;
        color: #f8fafc;
        font-variant-numeric: tabular-nums;
    }
    .macro-change {
        font-size: 0.65rem;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: rgba(255,255,255,0.4);
    }
    .macro-change.up { color: #22c55e; }
    .macro-change.down { color: #ef4444; }
    .macro-signal {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        padding: 0.75rem 1rem;
        border-left: 2px solid;
        min-width: 90px;
    }
    .macro-signal-label {
        font-size: 0.55rem;
        color: rgba(255,255,255,0.35);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .macro-signal-value {
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 0.08em;
    }
    .macro-empty {
        font-size: 0.75rem;
        color: rgba(255,255,255,0.3);
        padding: 1rem;
        width: 100%;
        text-align: center;
    }
</style>
