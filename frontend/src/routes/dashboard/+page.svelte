<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import GoldHeroPanel from '$lib/components/dashboard/GoldHeroPanel.svelte';
    import MacroStrip from '$lib/components/dashboard/MacroStrip.svelte';
    import DashboardMiniChart from '$lib/components/dashboard/DashboardMiniChart.svelte';
    import AgentOrb from '$lib/components/AgentOrb.svelte';
    import { fade } from 'svelte/transition';
    import type { DashboardMeta } from '$lib/types/dashboardMeta';

    let data = $state<any>(null);
    let loading = $state(true);
    let lastUpdate = $state('');
    let fetchError = $state<string | null>(null);
    let meta = $state<DashboardMeta | null>(null);
    let interval: ReturnType<typeof setInterval>;

    async function fetchDashboard() {
        try {
            const res = await fetch('/api/dashboard');
            if (!res.ok) {
                fetchError = `Server error: ${res.status}`;
                return;
            }
            data = await res.json();
            fetchError = null;
            meta = data?._meta ?? null;
            if (data?.updatedAt) {
                lastUpdate = new Date(data.updatedAt).toLocaleTimeString('en-US', {
                    timeZone: 'Asia/Bangkok',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
            }
        } catch {
            fetchError = 'Network error — retrying in 30s';
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        fetchDashboard();
        interval = setInterval(fetchDashboard, 30_000);
    });

    onDestroy(() => {
        clearInterval(interval);
    });

    // COT helpers
    function fmtK(n: number): string {
        const sign = n >= 0 ? '+' : '';
        return `${sign}${(n / 1000).toFixed(1)}K`;
    }

    // COT gauge SVG arc
    function gaugeArc(value: number, min: number, max: number): string {
        const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
        const angle = -90 + pct * 180;
        const rad = (angle * Math.PI) / 180;
        const r = 40;
        const cx = 50;
        const cy = 50;
        const x = cx + r * Math.cos(rad);
        const y = cy + r * Math.sin(rad);
        return `${x},${y}`;
    }
</script>

<svelte:head>
    <title>Dashboard — BigLot.ai</title>
</svelte:head>

<div class="dashboard-page">
    <!-- Header -->
    <header class="dash-header">
        <div class="dash-header-left">
            <a href="/" class="dash-back" aria-label="Back to chat">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 18l-6-6 6-6"/>
                </svg>
            </a>
            <h1 class="dash-title">
                <span class="dash-title-gradient">BigLot.ai</span>
                <span class="dash-title-sub">Dashboard</span>
            </h1>
        </div>
        <div class="dash-header-right">
            {#if meta?.warnings?.length}
                <span class="dash-warning-badge" title={meta.warnings.join('\n')}>
                    {meta.warnings.length} warning{meta.warnings.length > 1 ? 's' : ''}
                </span>
            {/if}
            {#if lastUpdate}
                <span class="dash-updated">Updated {lastUpdate} ICT</span>
            {/if}
            <div class="dash-refresh-dot" class:dash-loading={loading}>
                <AgentOrb size="sm" status={loading ? 'analyzing' : 'idle'} showLabel={false} />
            </div>
        </div>
    </header>

    {#if fetchError}
        <div class="dash-error-banner">{fetchError}</div>
    {/if}

    {#if loading && !data}
        <div class="dash-loading-state" transition:fade>
            <AgentOrb size="lg" status="analyzing" />
            <p class="dash-loading-text">Loading dashboard...</p>
        </div>
    {:else}
        <div class="dash-grid" transition:fade>
            <!-- Gold Hero -->
            <div class="dash-cell dash-hero">
                <GoldHeroPanel gold={data?.gold} />
            </div>

            <!-- Mini Chart -->
            <div class="dash-cell dash-chart">
                <DashboardMiniChart
                    ohlcv={data?.chart?.ohlcv ?? null}
                    interval={data?.chart?.interval}
                />
            </div>

            <!-- Macro Strip -->
            <div class="dash-cell dash-macro">
                <MacroStrip macro={data?.macro} />
            </div>

            <!-- COT Panel -->
            <div class="dash-cell dash-cot">
                <div class="cot-panel">
                    {#if data?.cot}
                        <div class="cot-title">COT Positioning</div>
                        <div class="cot-body">
                            {#if true}
                            {@const cotPct = Math.max(0, Math.min(1, (data.cot.netSpec + 100_000) / 350_000))}
                            {@const cotAngle = -180 + cotPct * 180}
                            {@const cotRad = (cotAngle * Math.PI) / 180}
                            {@const cotNx = 50 + 32 * Math.cos(cotRad)}
                            {@const cotNy = 50 + 32 * Math.sin(cotRad)}
                            <svg viewBox="0 0 100 60" class="cot-gauge-svg">
                                <!-- Background arc -->
                                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="6" stroke-linecap="round"/>
                                <!-- Colored arc segments -->
                                <path d="M 10 50 A 40 40 0 0 1 30 14.2" fill="none" stroke="#22c55e" stroke-width="6" stroke-linecap="round" opacity="0.4"/>
                                <path d="M 30 14.2 A 40 40 0 0 1 50 10" fill="none" stroke="#22c55e" stroke-width="6" stroke-linecap="round" opacity="0.6"/>
                                <path d="M 50 10 A 40 40 0 0 1 70 14.2" fill="none" stroke="#f59e0b" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
                                <path d="M 70 14.2 A 40 40 0 0 1 90 50" fill="none" stroke="#ef4444" stroke-width="6" stroke-linecap="round" opacity="0.4"/>
                                <!-- Needle -->
                                <line x1="50" y1="50" x2={cotNx} y2={cotNy} stroke="#f8fafc" stroke-width="2" stroke-linecap="round"/>
                                <circle cx="50" cy="50" r="3" fill="#f8fafc"/>
                            </svg>

                            <div class="cot-metrics">
                                <div class="cot-metric">
                                    <span class="cot-metric-label">Net Spec</span>
                                    <span class="cot-metric-value">{fmtK(data.cot.netSpec)}</span>
                                </div>
                                <div class="cot-metric">
                                    <span class="cot-metric-label">WoW</span>
                                    <span class="cot-metric-value" class:cot-up={data.cot.wowChange > 0} class:cot-down={data.cot.wowChange < 0}>
                                        {fmtK(data.cot.wowChange)}
                                    </span>
                                </div>
                                <div class="cot-metric">
                                    <span class="cot-metric-label">Signal</span>
                                    <span class="cot-metric-value cot-classification">{data.cot.classification}</span>
                                </div>
                            </div>
                            {/if}
                        </div>
                        <div class="cot-report-date" class:cot-stale={data.cot.reportAgeMs > 7 * 86_400_000}>
                            Report: {data.cot.reportDate}
                            {#if data.cot.reportAgeMs > 7 * 86_400_000}
                                <span class="cot-stale-tag">stale</span>
                            {/if}
                        </div>
                    {:else}
                        <div class="cot-empty">COT data unavailable</div>
                    {/if}
                </div>
            </div>

            <!-- Gold Signal Summary -->
            <div class="dash-cell dash-signal">
                <div class="signal-panel">
                    <div class="signal-title">Market Assessment</div>
                    {#if data?.macro}
                        {@const signal = data.macro.goldSignal}
                        {@const color = signal === 'bullish' ? '#22c55e' : signal === 'bearish' ? '#ef4444' : '#f59e0b'}
                        <div class="signal-badge" style="background:{color}18; border-color:{color}40; color:{color}">
                            {signal.toUpperCase()}
                        </div>
                        <p class="signal-context">{data.macro.goldContext}</p>
                    {:else}
                        <p class="signal-context">No signal available</p>
                    {/if}
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    .dashboard-page {
        min-height: 100vh;
        background: var(--color-background, #0a0a0f);
        color: #f8fafc;
        font-family: var(--font-sans, system-ui, sans-serif);
    }

    /* Header */
    .dash-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        background: rgba(0,0,0,0.3);
        backdrop-filter: blur(12px);
        position: sticky;
        top: 0;
        z-index: 10;
    }
    .dash-header-left {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    .dash-back {
        color: rgba(255,255,255,0.4);
        transition: color 0.15s;
        display: flex;
    }
    .dash-back:hover { color: #f59e0b; }
    .dash-title {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
        font-size: 1rem;
        font-weight: 700;
        margin: 0;
    }
    .dash-title-gradient {
        background: linear-gradient(90deg, #f59e0b, #f8fafc);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }
    .dash-title-sub {
        font-size: 0.75rem;
        font-weight: 500;
        color: rgba(255,255,255,0.35);
    }
    .dash-header-right {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    .dash-updated {
        font-size: 0.65rem;
        color: rgba(255,255,255,0.3);
    }

    /* Loading */
    .dash-loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 60vh;
        gap: 1rem;
    }
    .dash-loading-text {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.35);
    }

    /* Grid */
    .dash-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: auto auto auto;
        gap: 0.75rem;
        padding: 1rem 1.5rem 2rem;
        max-width: 1100px;
        margin: 0 auto;
    }
    .dash-hero { grid-column: 1; grid-row: 1; }
    .dash-chart { grid-column: 2; grid-row: 1; }
    .dash-macro { grid-column: 1 / -1; grid-row: 2; }
    .dash-cot { grid-column: 1; grid-row: 3; }
    .dash-signal { grid-column: 2; grid-row: 3; }

    @media (max-width: 768px) {
        .dash-grid {
            grid-template-columns: 1fr;
            padding: 0.75rem;
        }
        .dash-hero, .dash-chart, .dash-macro, .dash-cot, .dash-signal {
            grid-column: 1;
            grid-row: auto;
        }
    }

    /* COT Panel */
    .cot-panel {
        background: rgba(13, 17, 23, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 1rem;
        height: 100%;
        display: flex;
        flex-direction: column;
    }
    .cot-title {
        font-size: 0.7rem;
        font-weight: 600;
        color: rgba(255,255,255,0.4);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.5rem;
    }
    .cot-body {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex: 1;
    }
    .cot-gauge-svg {
        width: 100px;
        height: 60px;
        flex-shrink: 0;
    }
    .cot-metrics {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        flex: 1;
    }
    .cot-metric {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
    }
    .cot-metric-label {
        font-size: 0.65rem;
        color: rgba(255,255,255,0.35);
    }
    .cot-metric-value {
        font-size: 0.8rem;
        font-weight: 600;
        color: #f8fafc;
        font-variant-numeric: tabular-nums;
    }
    .cot-up { color: #22c55e; }
    .cot-down { color: #ef4444; }
    .cot-classification { color: #f59e0b; }
    .cot-report-date {
        font-size: 0.55rem;
        color: rgba(255,255,255,0.2);
        margin-top: 0.4rem;
    }
    .cot-empty {
        font-size: 0.75rem;
        color: rgba(255,255,255,0.3);
        text-align: center;
        padding: 2rem;
    }

    /* Signal Panel */
    .signal-panel {
        background: rgba(13, 17, 23, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 1rem;
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }
    .signal-title {
        font-size: 0.7rem;
        font-weight: 600;
        color: rgba(255,255,255,0.4);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .signal-badge {
        font-size: 1.2rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        padding: 0.5rem 1rem;
        border-radius: 10px;
        border: 1px solid;
        text-align: center;
    }
    .signal-context {
        font-size: 0.78rem;
        color: rgba(255,255,255,0.55);
        line-height: 1.5;
        margin: 0;
    }

    .dash-loading { opacity: 0.5; }

    /* Warning badge */
    .dash-warning-badge {
        font-size: 0.6rem;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
        cursor: help;
        white-space: nowrap;
    }

    /* Error banner */
    .dash-error-banner {
        font-size: 0.75rem;
        color: #fca5a5;
        background: rgba(239, 68, 68, 0.1);
        border-bottom: 1px solid rgba(239, 68, 68, 0.2);
        padding: 0.5rem 1.5rem;
        text-align: center;
    }

    /* COT stale */
    .cot-stale { color: #f59e0b; }
    .cot-stale-tag {
        font-size: 0.5rem;
        padding: 1px 5px;
        border-radius: 999px;
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
        margin-left: 0.4rem;
        vertical-align: middle;
    }
</style>
