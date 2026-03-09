<script lang="ts">
    import type { TradeSetupBlock } from '$lib/types/contentBlock';

    let { asset, direction, thesis, entryZone, stopLoss, targets, riskRewardRatio, maxRiskPct, invalidation, timeframe }: TradeSetupBlock = $props();

    const isLong = $derived(direction === 'long');
    const directionColor = $derived(isLong ? '#22c55e' : '#ef4444');
    const directionBg = $derived(isLong ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)');

    // SVG price ladder
    const svgH = 220;
    const svgW = 180;
    const padTop = 16;
    const padBot = 16;

    function priceToY(price: number, maxP: number, range: number): number {
        return padTop + ((maxP - price) / range) * (svgH - padTop - padBot);
    }

    const layout = $derived.by(() => {
        const allPrices = [stopLoss, entryZone.low, entryZone.high, ...targets.map((t) => t.price)];
        const minP = Math.min(...allPrices);
        const maxP = Math.max(...allPrices);
        const range = maxP - minP || 1;
        const entryMid = (entryZone.low + entryZone.high) / 2;
        const slY = priceToY(stopLoss, maxP, range);
        const entryMidY = priceToY(entryMid, maxP, range);
        const entryLowY = priceToY(entryZone.low, maxP, range);
        const entryHighY = priceToY(entryZone.high, maxP, range);

        return {
            minP,
            maxP,
            range,
            slY,
            entryMidY,
            entryLowY,
            entryHighY,
            entryZoneH: Math.abs(entryHighY - entryLowY) || 4
        };
    });

    function fmtPrice(p: number): string {
        if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        return p.toFixed(p < 10 ? 4 : 2);
    }
</script>

<div class="trade-setup">
    <!-- Header -->
    <div class="ts-header">
        <div class="ts-asset">{asset}</div>
        <div class="ts-direction" style="background:{directionBg}; color:{directionColor}">
            {direction.toUpperCase()}
        </div>
        <div class="ts-timeframe">{timeframe}</div>
    </div>

    <!-- Thesis -->
    <div class="ts-thesis">{thesis}</div>

    <!-- Price Ladder + Metrics -->
    <div class="ts-body">
        <!-- SVG Price Ladder -->
        <svg width={svgW} height={svgH} viewBox="0 0 {svgW} {svgH}" class="ts-ladder" aria-label="Trade price levels">
            <!-- Vertical axis line -->
            <line x1="80" y1={padTop} x2="80" y2={svgH - padBot} stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />

            <!-- Stop Loss -->
            <line x1="60" y1={layout.slY} x2="100" y2={layout.slY} stroke="#ef4444" stroke-width="2" stroke-dasharray="4,2" />
            <circle cx="80" cy={layout.slY} r="4" fill="#ef4444" />
            <text x="106" y={layout.slY + 4} font-size="9" fill="#ef4444" font-weight="600">SL {fmtPrice(stopLoss)}</text>

            <!-- Entry Zone -->
            <rect x="68" y={Math.min(layout.entryLowY, layout.entryHighY)} width="24" height={layout.entryZoneH} fill="rgba(245,158,11,0.3)" rx="2" />
            <line x1="56" y1={layout.entryMidY} x2="104" y2={layout.entryMidY} stroke="#f59e0b" stroke-width="2" />
            <circle cx="80" cy={layout.entryMidY} r="4" fill="#f59e0b" />
            <text x="106" y={layout.entryMidY - 6} font-size="9" fill="#f59e0b" font-weight="600">ENTRY</text>
            <text x="106" y={layout.entryMidY + 6} font-size="8" fill="rgba(245,158,11,0.7)">{fmtPrice(entryZone.low)}–{fmtPrice(entryZone.high)}</text>

            <!-- Targets -->
            {#each targets as target, i}
                {@const ty = priceToY(target.price, layout.maxP, layout.range)}
                {@const tpColors = ['#22c55e', '#10b981', '#059669']}
                {@const col = tpColors[i] ?? '#22c55e'}
                <line x1="60" y1={ty} x2="100" y2={ty} stroke={col} stroke-width="2" />
                <circle cx="80" cy={ty} r="4" fill={col} />
                <text x="106" y={ty + 4} font-size="9" fill={col} font-weight="600">{target.label} {fmtPrice(target.price)}</text>
                <text x="56" y={ty + 4} font-size="8" fill={col} text-anchor="end">{target.rMultiple}R</text>
            {/each}
        </svg>

        <!-- Metrics Grid -->
        <div class="ts-metrics">
            <div class="ts-metric">
                <span class="ts-metric-label">Risk/Reward</span>
                <span class="ts-metric-value" style="color:#22c55e">1:{riskRewardRatio.toFixed(1)}</span>
            </div>
            <div class="ts-metric">
                <span class="ts-metric-label">Max Risk</span>
                <span class="ts-metric-value">{maxRiskPct}% of capital</span>
            </div>
            <div class="ts-metric">
                <span class="ts-metric-label">Entry Zone</span>
                <span class="ts-metric-value">{fmtPrice(entryZone.low)} – {fmtPrice(entryZone.high)}</span>
            </div>
            <div class="ts-metric">
                <span class="ts-metric-label">Stop Loss</span>
                <span class="ts-metric-value" style="color:#ef4444">{fmtPrice(stopLoss)}</span>
            </div>
            {#each targets as target}
                <div class="ts-metric">
                    <span class="ts-metric-label">{target.label}</span>
                    <span class="ts-metric-value" style="color:#22c55e">{fmtPrice(target.price)} ({target.rMultiple}R)</span>
                </div>
            {/each}
        </div>
    </div>

    <!-- Invalidation -->
    <div class="ts-invalidation">
        <span class="ts-inv-label">Invalidation:</span>
        {invalidation}
    </div>
</div>

<style>
    .trade-setup {
        background: rgba(13, 17, 23, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 14px;
        padding: 1.1rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        max-width: 560px;
    }
    .ts-header {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        flex-wrap: wrap;
    }
    .ts-asset {
        font-size: 1.1rem;
        font-weight: 700;
        color: #f8fafc;
    }
    .ts-direction {
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        padding: 3px 10px;
        border-radius: 999px;
    }
    .ts-timeframe {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.4);
        margin-left: auto;
    }
    .ts-thesis {
        font-size: 0.82rem;
        color: rgba(255, 255, 255, 0.75);
        line-height: 1.5;
    }
    .ts-body {
        display: flex;
        gap: 1rem;
        align-items: flex-start;
        flex-wrap: wrap;
    }
    .ts-ladder {
        flex-shrink: 0;
    }
    .ts-metrics {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        min-width: 160px;
    }
    .ts-metric {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        padding-bottom: 0.35rem;
        gap: 0.5rem;
    }
    .ts-metric-label {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.45);
    }
    .ts-metric-value {
        font-size: 0.8rem;
        font-weight: 600;
        color: #f8fafc;
        text-align: right;
    }
    .ts-invalidation {
        font-size: 0.78rem;
        color: rgba(251, 191, 36, 0.8);
        background: rgba(251, 191, 36, 0.06);
        border: 1px solid rgba(251, 191, 36, 0.15);
        border-radius: 8px;
        padding: 0.5rem 0.75rem;
        line-height: 1.4;
    }
    .ts-inv-label {
        font-weight: 700;
        margin-right: 0.35em;
    }
</style>
