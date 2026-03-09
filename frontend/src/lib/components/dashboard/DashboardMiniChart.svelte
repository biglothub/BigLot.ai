<script lang="ts">
    import type { OHLCV } from '$lib/types/contentBlock';

    let {
        ohlcv,
        interval,
        showHeader = true
    }: {
        ohlcv: OHLCV[] | null;
        interval?: string;
        showHeader?: boolean;
    } = $props();

    // Simple SVG candlestick chart (no external dep)
    const svgW = 600;
    const svgH = 200;
    const pad = { top: 12, right: 8, bottom: 20, left: 55 };

    const chartW = $derived(svgW - pad.left - pad.right);
    const chartH = $derived(svgH - pad.top - pad.bottom);

    const layout = $derived.by(() => {
        if (!ohlcv || ohlcv.length === 0) return null;
        const highs = ohlcv.map(c => c.high);
        const lows = ohlcv.map(c => c.low);
        const maxP = Math.max(...highs);
        const minP = Math.min(...lows);
        const range = maxP - minP || 1;
        const candleW = Math.max(2, Math.min(8, (chartW / ohlcv.length) * 0.7));
        const gap = chartW / ohlcv.length;

        return { maxP, minP, range, candleW, gap };
    });

    function priceToY(price: number): number {
        if (!layout) return 0;
        return pad.top + ((layout.maxP - price) / layout.range) * chartH;
    }

    function fmtAxisPrice(p: number): string {
        if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
        return p.toFixed(2);
    }

    // Price axis ticks
    const axisTicks = $derived.by(() => {
        if (!layout) return [];
        const count = 5;
        const step = layout.range / (count - 1);
        return Array.from({ length: count }, (_, i) => layout.minP + step * i);
    });
</script>

<div class="mini-chart-wrap">
    {#if ohlcv && ohlcv.length > 0 && layout}
        {#if showHeader}
            <div class="mini-chart-header">
                <span class="mini-chart-title">GC=F Gold Futures</span>
                {#if interval}
                    <span class="mini-chart-interval">{interval}</span>
                {/if}
            </div>
        {/if}
        <svg
            viewBox="0 0 {svgW} {svgH}"
            class="mini-chart-svg"
            preserveAspectRatio="xMidYMid meet"
        >
            <!-- Grid lines -->
            {#each axisTicks as tick}
                {@const y = priceToY(tick)}
                <line x1={pad.left} y1={y} x2={svgW - pad.right} y2={y} stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
                <text x={pad.left - 6} y={y + 3} text-anchor="end" font-size="8" fill="rgba(255,255,255,0.3)">
                    {fmtAxisPrice(tick)}
                </text>
            {/each}

            <!-- Candles -->
            {#each ohlcv as candle, i}
                {@const x = pad.left + i * layout.gap + layout.gap / 2}
                {@const isGreen = candle.close >= candle.open}
                {@const bodyTop = priceToY(Math.max(candle.open, candle.close))}
                {@const bodyBot = priceToY(Math.min(candle.open, candle.close))}
                {@const bodyH = Math.max(1, bodyBot - bodyTop)}
                {@const wickTop = priceToY(candle.high)}
                {@const wickBot = priceToY(candle.low)}
                {@const color = isGreen ? '#22c55e' : '#ef4444'}

                <!-- Wick -->
                <line x1={x} y1={wickTop} x2={x} y2={wickBot} stroke={color} stroke-width="1" opacity="0.7"/>
                <!-- Body -->
                <rect
                    x={x - layout.candleW / 2}
                    y={bodyTop}
                    width={layout.candleW}
                    height={bodyH}
                    fill={color}
                    rx="0.5"
                />
            {/each}
        </svg>
    {:else}
        <div class="mini-chart-empty">Chart data unavailable</div>
    {/if}
</div>

<style>
    .mini-chart-wrap {
        background: rgba(13, 17, 23, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 0.75rem;
        overflow: hidden;
    }
    .mini-chart-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.5rem;
    }
    .mini-chart-title {
        font-size: 0.7rem;
        font-weight: 600;
        color: rgba(255,255,255,0.5);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    .mini-chart-interval {
        font-size: 0.6rem;
        color: rgba(255,255,255,0.3);
        background: rgba(255,255,255,0.05);
        padding: 2px 8px;
        border-radius: 4px;
    }
    .mini-chart-svg {
        width: 100%;
        height: auto;
        display: block;
    }
    .mini-chart-empty {
        font-size: 0.75rem;
        color: rgba(255,255,255,0.3);
        text-align: center;
        padding: 2rem;
    }
</style>
