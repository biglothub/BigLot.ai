<script lang="ts">
    import type { GoldPriceData } from '$lib/types/dashboardMeta';

    let {
        gold,
        chrome = 'standalone'
    }: {
        gold: GoldPriceData | null;
        chrome?: 'standalone' | 'embedded';
    } = $props();

    const isUp = $derived(gold ? gold.change24hPct >= 0 : true);
    const changeColor = $derived(isUp ? '#22c55e' : '#ef4444');
    const changeBg = $derived(isUp ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)');
    const changeBorder = $derived(isUp ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)');

    function fmtUsd(n: number): string {
        return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
</script>

<div class="hero-panel" class:hero-panel-embedded={chrome === 'embedded'}>
    {#if gold}
        <div class="hero-top">
            <div class="hero-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(0 0 8px rgba(245,158,11,0.5))">
                    <circle cx="12" cy="12" r="10" stroke="#f59e0b" stroke-width="1.5" fill="rgba(245,158,11,0.12)"/>
                    <text x="12" y="16" text-anchor="middle" font-size="10" font-weight="800" fill="#f59e0b" letter-spacing="-0.5">Au</text>
                </svg>
            </div>
            <div class="hero-label-group">
                <span class="hero-label">GOLD</span>
                <span class="hero-sub">{gold.priceSource === 'binance' ? 'Binance' : 'GC=F'}</span>
            </div>
        </div>

        <div class="hero-price">${fmtUsd(gold.spotPrice)}</div>

        <div class="hero-change-row">
            <span class="hero-change" style="color:{changeColor}; background:{changeBg}; border-color:{changeBorder}">
                {isUp ? '▲' : '▼'} {gold.change24hPct >= 0 ? '+' : ''}{gold.change24hPct.toFixed(2)}%
            </span>
            <span class="hero-24h">24h</span>
        </div>

        <div class="hero-divider"></div>

        <div class="hero-secondary">
            <div class="hero-sec-item">
                <span class="hero-sec-label">Thai Gold</span>
                <span class="hero-sec-value gold-text">฿{gold.thaiGoldPrice.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</span>
            </div>
            <div class="hero-sec-sep"></div>
            <div class="hero-sec-item">
                <span class="hero-sec-label">USD/THB{#if gold.thbIsLive === false} <span class="hero-cached-tag">cached</span>{/if}</span>
                <span class="hero-sec-value">{gold.thbRate.toFixed(2)}</span>
            </div>
            {#if gold.binancePrice}
                <div class="hero-sec-sep"></div>
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
        background: linear-gradient(135deg, rgba(245,158,11,0.07) 0%, rgba(10,12,18,0.95) 55%);
        border: 1px solid rgba(245,158,11,0.18);
        border-radius: 16px;
        padding: 1.25rem 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
        position: relative;
        overflow: hidden;
    }
    .hero-panel::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(245,158,11,0.4), transparent);
    }
    .hero-panel-embedded {
        background: transparent;
        border: 0;
        border-radius: 0;
        padding: 0;
        overflow: visible;
    }
    .hero-panel-embedded::before {
        display: none;
    }
    .hero-top {
        display: flex;
        align-items: center;
        gap: 0.6rem;
    }
    .hero-icon { flex-shrink: 0; }
    .hero-label-group {
        display: flex;
        align-items: baseline;
        gap: 0.4rem;
    }
    .hero-label {
        font-size: 0.7rem;
        font-weight: 800;
        color: #f59e0b;
        letter-spacing: 0.12em;
    }
    .hero-sub {
        font-size: 0.6rem;
        color: rgba(255,255,255,0.28);
        font-weight: 500;
    }
    .hero-price {
        font-size: 2.2rem;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        line-height: 1.1;
        background: linear-gradient(135deg, #fbbf24 0%, #f8fafc 60%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }
    .hero-change-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .hero-change {
        font-size: 0.75rem;
        font-weight: 700;
        padding: 3px 10px;
        border-radius: 5px;
        border: 1px solid;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.02em;
    }
    .hero-24h {
        font-size: 0.6rem;
        color: rgba(255,255,255,0.25);
        letter-spacing: 0.04em;
    }
    .hero-divider {
        height: 1px;
        background: rgba(255,255,255,0.05);
        margin: 0.1rem 0;
    }
    .hero-secondary {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
    }
    .hero-sec-sep {
        width: 1px;
        height: 24px;
        background: rgba(255,255,255,0.07);
        margin: 0 0.9rem;
        flex-shrink: 0;
    }
    .hero-sec-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .hero-sec-label {
        font-size: 0.58rem;
        color: rgba(255,255,255,0.28);
        text-transform: uppercase;
        letter-spacing: 0.07em;
        font-weight: 600;
    }
    .hero-sec-value {
        font-size: 0.82rem;
        font-weight: 600;
        color: rgba(255,255,255,0.82);
        font-variant-numeric: tabular-nums;
    }
    .gold-text { color: #f59e0b; }
    .hero-52w {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.15rem;
    }
    .hero-52w-label {
        font-size: 0.58rem;
        color: rgba(255,255,255,0.25);
        font-weight: 700;
        letter-spacing: 0.06em;
        flex-shrink: 0;
    }
    .hero-52w-bar { flex: 1; }
    .hero-52w-track {
        height: 5px;
        background: rgba(255,255,255,0.06);
        border-radius: 3px;
        overflow: hidden;
    }
    .hero-52w-fill {
        height: 100%;
        background: linear-gradient(90deg, #ef4444, #f59e0b 50%, #22c55e);
        border-radius: 3px;
        box-shadow: 0 0 6px rgba(245,158,11,0.4);
    }
    .hero-52w-vals {
        font-size: 0.56rem;
        color: rgba(255,255,255,0.25);
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
    }
    .hero-empty {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.25);
        text-align: center;
        padding: 2rem;
    }
    .hero-cached-tag {
        font-size: 0.48rem;
        padding: 1px 4px;
        border-radius: 3px;
        background: rgba(245, 158, 11, 0.12);
        color: #f59e0b;
        vertical-align: middle;
        border: 1px solid rgba(245,158,11,0.2);
    }
</style>
