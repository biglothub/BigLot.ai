<script lang="ts">
    import type { GoldPriceData } from '$lib/types/dashboardMeta';

    let { gold }: { gold: GoldPriceData | null } = $props();

    const isUp = $derived(gold ? gold.change24hPct >= 0 : true);
    const changeColor = $derived(isUp ? '#22c55e' : '#ef4444');
    const changeBg = $derived(isUp ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)');

    function fmtUsd(n: number): string {
        return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
</script>

<div class="hero-panel">
    {#if gold}
        <div class="hero-top">
            <div class="hero-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#f59e0b" stroke-width="2" fill="rgba(245,158,11,0.15)"/>
                    <text x="12" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="#f59e0b">Au</text>
                </svg>
            </div>
            <div class="hero-label">GOLD<span class="hero-sub">{gold.priceSource === 'binance' ? 'Binance' : 'GC=F'}</span></div>
        </div>

        <div class="hero-price">${fmtUsd(gold.spotPrice)}</div>

        <div class="hero-change-row">
            <span class="hero-change" style="color:{changeColor}; background:{changeBg}">
                {isUp ? '▲' : '▼'} {gold.change24hPct >= 0 ? '+' : ''}{gold.change24hPct.toFixed(2)}%
            </span>
            <span class="hero-24h">24h</span>
        </div>

        <div class="hero-secondary">
            <div class="hero-sec-item">
                <span class="hero-sec-label">Thai Gold</span>
                <span class="hero-sec-value gold-text">฿{gold.thaiGoldPrice.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</span>
            </div>
            <div class="hero-sec-item">
                <span class="hero-sec-label">USD/THB{#if gold.thbIsLive === false} <span class="hero-cached-tag">cached</span>{/if}</span>
                <span class="hero-sec-value">{gold.thbRate.toFixed(2)}</span>
            </div>
            {#if gold.binancePrice}
                <div class="hero-sec-item">
                    <span class="hero-sec-label">Binance</span>
                    <span class="hero-sec-value">${fmtUsd(gold.binancePrice)}</span>
                </div>
            {/if}
        </div>

        {#if gold.comexHigh52w && gold.comexLow52w}
            {@const pct52w = ((gold.spotPrice - gold.comexLow52w) / (gold.comexHigh52w - gold.comexLow52w)) * 100}
            <div class="hero-52w">
                <span class="hero-52w-label">52W</span>
                <div class="hero-52w-bar">
                    <div class="hero-52w-track">
                        <div class="hero-52w-fill" style="width:{Math.min(100, Math.max(0, pct52w))}%"></div>
                    </div>
                </div>
                <span class="hero-52w-vals">
                    ${gold.comexLow52w.toLocaleString('en-US', { maximumFractionDigits: 0 })} — ${gold.comexHigh52w.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
            </div>
        {/if}
    {:else}
        <div class="hero-empty">Gold data unavailable</div>
    {/if}
</div>

<style>
    .hero-panel {
        background: linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(13,17,23,0.9) 60%);
        border: 1px solid rgba(245,158,11,0.2);
        border-radius: 16px;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }
    .hero-top {
        display: flex;
        align-items: center;
        gap: 0.6rem;
    }
    .hero-icon { flex-shrink: 0; }
    .hero-label {
        font-size: 0.85rem;
        font-weight: 700;
        color: #f59e0b;
        letter-spacing: 0.1em;
    }
    .hero-sub {
        font-size: 0.65rem;
        color: rgba(255,255,255,0.35);
        margin-left: 0.4rem;
        font-weight: 500;
        letter-spacing: 0;
    }
    .hero-price {
        font-size: 2.4rem;
        font-weight: 800;
        color: #f8fafc;
        font-variant-numeric: tabular-nums;
        line-height: 1.1;
    }
    .hero-change-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .hero-change {
        font-size: 0.8rem;
        font-weight: 700;
        padding: 3px 10px;
        border-radius: 999px;
        font-variant-numeric: tabular-nums;
    }
    .hero-24h {
        font-size: 0.65rem;
        color: rgba(255,255,255,0.35);
    }
    .hero-secondary {
        display: flex;
        gap: 1.2rem;
        flex-wrap: wrap;
        margin-top: 0.3rem;
        padding-top: 0.6rem;
        border-top: 1px solid rgba(255,255,255,0.06);
    }
    .hero-sec-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .hero-sec-label {
        font-size: 0.6rem;
        color: rgba(255,255,255,0.35);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .hero-sec-value {
        font-size: 0.85rem;
        font-weight: 600;
        color: rgba(255,255,255,0.85);
        font-variant-numeric: tabular-nums;
    }
    .gold-text { color: #f59e0b; }
    .hero-52w {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.3rem;
    }
    .hero-52w-label {
        font-size: 0.6rem;
        color: rgba(255,255,255,0.3);
        font-weight: 600;
    }
    .hero-52w-bar { flex: 1; }
    .hero-52w-track {
        height: 4px;
        background: rgba(255,255,255,0.08);
        border-radius: 2px;
        overflow: hidden;
    }
    .hero-52w-fill {
        height: 100%;
        background: linear-gradient(90deg, #ef4444, #f59e0b, #22c55e);
        border-radius: 2px;
    }
    .hero-52w-vals {
        font-size: 0.58rem;
        color: rgba(255,255,255,0.3);
        white-space: nowrap;
    }
    .hero-empty {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.3);
        text-align: center;
        padding: 2rem;
    }
    .hero-cached-tag {
        font-size: 0.5rem;
        padding: 1px 4px;
        border-radius: 999px;
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
        vertical-align: middle;
    }
</style>
