<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { fade } from 'svelte/transition';
    import GoldHeroPanel from '$lib/components/dashboard/GoldHeroPanel.svelte';
    import MacroStrip from '$lib/components/dashboard/MacroStrip.svelte';
    import DashboardMiniChart from '$lib/components/dashboard/DashboardMiniChart.svelte';
    import AgentOrb from '$lib/components/AgentOrb.svelte';
    import {
        DASHBOARD_TIMEFRAMES,
        type DashboardResponse,
        type DashboardSignal,
        type DashboardSource,
        type DashboardTimeframe,
        type SourceMeta
    } from '$lib/types/dashboardMeta';

    const sourceOrder: DashboardSource[] = ['gold', 'macro', 'cot', 'chart'];
    const sourceLabels: Record<DashboardSource, string> = {
        gold: 'Gold',
        macro: 'Macro',
        cot: 'COT',
        chart: 'Chart'
    };

    let data = $state<DashboardResponse | null>(null);
    let initialLoading = $state(true);
    let refreshing = $state(false);
    let switchingTimeframe = $state(false);
    let fetchError = $state<string | null>(null);
    let lastUpdate = $state('');
    let selectedTimeframe = $state<DashboardTimeframe>('1mo');
    let interval: ReturnType<typeof setInterval>;
    let abortController: AbortController | null = null;
    let activeRequestId = 0;

    const meta = $derived(data?._meta ?? null);
    const busy = $derived(initialLoading || refreshing || switchingTimeframe);

    function normalizeTimeframe(value: string | null | undefined): DashboardTimeframe {
        if (value && DASHBOARD_TIMEFRAMES.includes(value as DashboardTimeframe)) {
            return value as DashboardTimeframe;
        }
        return '1mo';
    }

    function readTimeframeFromUrl(): DashboardTimeframe {
        if (typeof window === 'undefined') return '1mo';
        const url = new URL(window.location.href);
        return normalizeTimeframe(url.searchParams.get('tf') ?? url.searchParams.get('timeframe'));
    }

    function syncUrlTimeframe(timeframe: DashboardTimeframe) {
        if (typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        url.searchParams.delete('timeframe');
        if (timeframe === '1mo') {
            url.searchParams.delete('tf');
        } else {
            url.searchParams.set('tf', timeframe);
        }
        window.history.replaceState(window.history.state, '', url);
    }

    function updateLastUpdate(updatedAt: string) {
        lastUpdate = new Date(updatedAt).toLocaleTimeString('en-US', {
            timeZone: 'Asia/Bangkok',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    function buildApiUrl(timeframe: DashboardTimeframe): string {
        return `/api/dashboard?timeframe=${encodeURIComponent(timeframe)}`;
    }

    async function fetchDashboard(
        reason: 'initial' | 'poll' | 'timeframe',
        timeframe: DashboardTimeframe
    ) {
        const requestId = ++activeRequestId;
        abortController?.abort();
        abortController = new AbortController();

        if (reason === 'initial' && !data) {
            initialLoading = true;
        } else if (reason === 'timeframe') {
            switchingTimeframe = true;
        } else {
            refreshing = true;
        }

        try {
            const res = await fetch(buildApiUrl(timeframe), {
                signal: abortController.signal
            });

            if (!res.ok) {
                throw new Error(`Server error: ${res.status}`);
            }

            const nextData = await res.json() as DashboardResponse;
            if (requestId !== activeRequestId) return;

            data = nextData;
            selectedTimeframe = nextData.chart?.timeframe ?? timeframe;
            fetchError = null;
            updateLastUpdate(nextData.updatedAt);
            syncUrlTimeframe(selectedTimeframe);
        } catch (error) {
            if ((error as Error).name === 'AbortError' || requestId !== activeRequestId) {
                return;
            }

            fetchError = 'Network error - retrying in 30s';
            if (reason === 'timeframe' && data?.chart?.timeframe) {
                selectedTimeframe = data.chart.timeframe;
                syncUrlTimeframe(selectedTimeframe);
            }
        } finally {
            if (requestId !== activeRequestId) return;

            if (reason === 'initial') {
                initialLoading = false;
            } else if (reason === 'timeframe') {
                switchingTimeframe = false;
            } else {
                refreshing = false;
            }
        }
    }

    async function handleTimeframeChange(timeframe: DashboardTimeframe) {
        if (timeframe === selectedTimeframe && data?.chart?.timeframe === timeframe) return;
        selectedTimeframe = timeframe;
        syncUrlTimeframe(timeframe);
        await fetchDashboard('timeframe', timeframe);
    }

    function handlePopState() {
        const nextTimeframe = readTimeframeFromUrl();
        if (nextTimeframe === selectedTimeframe && data?.chart?.timeframe === nextTimeframe) return;
        selectedTimeframe = nextTimeframe;
        void fetchDashboard('timeframe', nextTimeframe);
    }

    onMount(() => {
        selectedTimeframe = readTimeframeFromUrl();
        void fetchDashboard('initial', selectedTimeframe);

        interval = setInterval(() => {
            if (switchingTimeframe) return;
            void fetchDashboard('poll', selectedTimeframe);
        }, 30_000);

        window.addEventListener('popstate', handlePopState);
    });

    onDestroy(() => {
        clearInterval(interval);
        abortController?.abort();
        window.removeEventListener('popstate', handlePopState);
    });

    function fmtK(n: number): string {
        const sign = n >= 0 ? '+' : '';
        return `${sign}${(n / 1000).toFixed(1)}K`;
    }

    function fmtImpact(n: number): string {
        return `${n >= 0 ? '+' : ''}${n.toFixed(1)}`;
    }

    function formatCheckedAt(ts: string): string {
        return new Date(ts).toLocaleTimeString('en-US', {
            timeZone: 'Asia/Bangkok',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function getSourceMeta(source: DashboardSource): SourceMeta | null {
        return meta?.sources.find((item) => item.source === source) ?? null;
    }

    function signalColor(signal: DashboardSignal): string {
        if (signal === 'bullish') return '#22c55e';
        if (signal === 'bearish') return '#ef4444';
        return '#f59e0b';
    }

    function statusColor(status: SourceMeta['status']): string {
        if (status === 'healthy') return '#22c55e';
        if (status === 'fallback') return '#f59e0b';
        if (status === 'stale') return '#fb923c';
        return '#ef4444';
    }

    function refreshLabel(): string {
        if (switchingTimeframe) return `Switching to ${selectedTimeframe}`;
        if (refreshing) return 'Refreshing';
        return 'Live';
    }

    function cotLagDays(reportAgeMs: number): number {
        return Math.max(0, Math.floor(reportAgeMs / 86_400_000));
    }

    function cotNeedle(netSpec: number): { x: number; y: number } {
        const pct = Math.max(0, Math.min(1, (netSpec + 100_000) / 350_000));
        const angle = -180 + pct * 180;
        const rad = (angle * Math.PI) / 180;
        return {
            x: 50 + 32 * Math.cos(rad),
            y: 50 + 32 * Math.sin(rad)
        };
    }
</script>

<svelte:head>
    <title>Dashboard — BigLot.ai</title>
</svelte:head>

<div class="dashboard-page">
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
            <span class="dash-status-text">{refreshLabel()}</span>
            <div class="dash-refresh-dot" class:dash-loading={busy}>
                <AgentOrb size="sm" status={busy ? 'analyzing' : 'idle'} showLabel={false} />
            </div>
        </div>
    </header>

    {#if fetchError}
        <div class="dash-error-banner">{fetchError}</div>
    {/if}

    {#if meta?.sources?.length}
        <section class="source-health-row" transition:fade>
            {#each sourceOrder as source}
                {@const sourceMeta = getSourceMeta(source)}
                {@const cardColor = statusColor(sourceMeta?.status ?? 'error')}
                <article
                    class="source-card"
                    style={`--source-color:${cardColor};`}
                >
                    <div class="source-card-top">
                        <span class="source-card-label">{sourceLabels[source]}</span>
                        <span class="source-card-status">{sourceMeta?.status ?? 'error'}</span>
                    </div>
                    <div class="source-card-summary">{sourceMeta?.summary ?? 'Status unavailable'}</div>
                    <div class="source-card-time">
                        {#if sourceMeta}
                            Checked {formatCheckedAt(sourceMeta.fetchedAt)} ICT
                        {:else}
                            Not available
                        {/if}
                    </div>
                    {#if sourceMeta?.details?.length}
                        <div class="source-card-details">
                            {#each sourceMeta.details.slice(0, 2) as detail}
                                <span>{detail}</span>
                            {/each}
                        </div>
                    {/if}
                </article>
            {/each}
        </section>
    {/if}

    {#if initialLoading && !data}
        <div class="dash-loading-state" transition:fade>
            <AgentOrb size="lg" status="analyzing" />
            <p class="dash-loading-text">Loading dashboard...</p>
        </div>
    {:else if !data}
        <div class="dash-empty-state" transition:fade>
            <AgentOrb size="lg" status="idle" />
            <p class="dash-loading-text">Dashboard data unavailable</p>
        </div>
    {:else}
        <div class="dash-grid" transition:fade>
            <div class="dash-cell dash-hero">
                <GoldHeroPanel gold={data.gold} />
            </div>

            <div class="dash-cell dash-chart">
                <div class="chart-panel">
                    <div class="chart-panel-header">
                        <div>
                            <div class="chart-title">GC=F Gold Futures</div>
                            <div class="chart-subtitle">
                                {#if data.chart}
                                    {data.chart.interval} candles
                                {:else}
                                    Awaiting chart data
                                {/if}
                            </div>
                        </div>

                        <div class="timeframe-switcher">
                            {#each DASHBOARD_TIMEFRAMES as timeframe}
                                <button
                                    type="button"
                                    class="timeframe-btn"
                                    class:timeframe-btn-active={selectedTimeframe === timeframe}
                                    onclick={() => handleTimeframeChange(timeframe)}
                                >
                                    {timeframe}
                                </button>
                            {/each}
                        </div>
                    </div>

                    <DashboardMiniChart
                        ohlcv={data.chart?.ohlcv ?? null}
                        interval={data.chart?.interval}
                        showHeader={false}
                    />
                </div>
            </div>

            <div class="dash-cell dash-macro">
                <MacroStrip macro={data.macro} />
            </div>

            <div class="dash-cell dash-cot">
                <div class="cot-panel">
                    {#if data.cot}
                        {@const cotNeedlePoint = cotNeedle(data.cot.netSpec)}
                        <div class="cot-title">COT Positioning</div>
                        <div class="cot-body">
                            <svg viewBox="0 0 100 60" class="cot-gauge-svg">
                                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="6" stroke-linecap="round"/>
                                <path d="M 10 50 A 40 40 0 0 1 30 14.2" fill="none" stroke="#22c55e" stroke-width="6" stroke-linecap="round" opacity="0.4"/>
                                <path d="M 30 14.2 A 40 40 0 0 1 50 10" fill="none" stroke="#22c55e" stroke-width="6" stroke-linecap="round" opacity="0.6"/>
                                <path d="M 50 10 A 40 40 0 0 1 70 14.2" fill="none" stroke="#f59e0b" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
                                <path d="M 70 14.2 A 40 40 0 0 1 90 50" fill="none" stroke="#ef4444" stroke-width="6" stroke-linecap="round" opacity="0.4"/>
                                <line x1="50" y1="50" x2={cotNeedlePoint.x} y2={cotNeedlePoint.y} stroke="#f8fafc" stroke-width="2" stroke-linecap="round"/>
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
                        </div>

                        <div class="cot-report-date" class:cot-stale={data.cot.reportAgeMs > 8 * 86_400_000}>
                            Report: {data.cot.reportDate}
                            <span class="cot-lag-tag">lag {cotLagDays(data.cot.reportAgeMs)}d</span>
                            {#if data.cot.reportAgeMs > 8 * 86_400_000}
                                <span class="cot-stale-tag">stale</span>
                            {/if}
                        </div>
                    {:else}
                        <div class="cot-empty">COT data unavailable</div>
                    {/if}
                </div>
            </div>

            <div class="dash-cell dash-signal">
                <div class="signal-panel">
                    <div class="signal-header">
                        <div class="signal-title">Market Assessment</div>
                        <span class="signal-confidence">{data.assessment.confidence} confidence</span>
                    </div>

                    <div class="signal-score-row">
                        <div class="signal-score">{data.assessment.score}</div>
                        <div class="signal-score-meta">
                            <div class="signal-badge" style={`background:${signalColor(data.assessment.signal)}18; border-color:${signalColor(data.assessment.signal)}40; color:${signalColor(data.assessment.signal)};`}>
                                {data.assessment.signal.toUpperCase()}
                            </div>
                            <div class="signal-summary">{data.assessment.summary}</div>
                        </div>
                    </div>

                    <div class="signal-score-track">
                        <div class="signal-score-fill" style={`width:${data.assessment.score}%; background:${signalColor(data.assessment.signal)};`}></div>
                    </div>

                    <div class="signal-driver-list">
                        {#each data.assessment.drivers as driver}
                            <div class="signal-driver">
                                <div class="signal-driver-top">
                                    <span class="signal-driver-label">{driver.label}</span>
                                    <span
                                        class="signal-driver-impact"
                                        class:signal-driver-up={driver.direction === 'bullish'}
                                        class:signal-driver-down={driver.direction === 'bearish'}
                                    >
                                        {fmtImpact(driver.impact)}
                                    </span>
                                </div>
                                <div class="signal-driver-detail">{driver.detail}</div>
                            </div>
                        {/each}
                    </div>
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

    .dash-back:hover {
        color: #f59e0b;
    }

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

    .dash-updated,
    .dash-status-text {
        font-size: 0.65rem;
        color: rgba(255,255,255,0.3);
    }

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

    .dash-error-banner {
        font-size: 0.75rem;
        color: #fca5a5;
        background: rgba(239, 68, 68, 0.1);
        border-bottom: 1px solid rgba(239, 68, 68, 0.2);
        padding: 0.5rem 1.5rem;
        text-align: center;
    }

    .source-health-row {
        max-width: 1100px;
        margin: 0.85rem auto 0;
        padding: 0 1.5rem;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.75rem;
    }

    .source-card {
        background: linear-gradient(180deg, rgba(13,17,23,0.88), rgba(13,17,23,0.62));
        border: 1px solid color-mix(in srgb, var(--source-color) 32%, rgba(255,255,255,0.08));
        border-radius: 14px;
        padding: 0.85rem 0.95rem;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
    }

    .source-card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0.35rem;
    }

    .source-card-label {
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.55);
    }

    .source-card-status {
        font-size: 0.55rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--source-color);
    }

    .source-card-summary {
        font-size: 0.82rem;
        font-weight: 600;
        color: #f8fafc;
        min-height: 2.3em;
    }

    .source-card-time {
        margin-top: 0.45rem;
        font-size: 0.62rem;
        color: rgba(255,255,255,0.35);
    }

    .source-card-details {
        margin-top: 0.55rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.65rem;
        color: rgba(255,255,255,0.48);
    }

    .dash-loading-state,
    .dash-empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 55vh;
        gap: 1rem;
    }

    .dash-loading-text {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.35);
    }

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

    .chart-panel,
    .cot-panel,
    .signal-panel {
        background: rgba(13, 17, 23, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 1rem;
        height: 100%;
    }

    .chart-panel {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
    }

    .chart-panel-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.75rem;
    }

    .chart-title,
    .cot-title,
    .signal-title {
        font-size: 0.7rem;
        font-weight: 600;
        color: rgba(255,255,255,0.4);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .chart-subtitle {
        margin-top: 0.25rem;
        font-size: 0.65rem;
        color: rgba(255,255,255,0.3);
    }

    .timeframe-switcher {
        display: inline-flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 0.35rem;
    }

    .timeframe-btn {
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.03);
        color: rgba(255,255,255,0.5);
        border-radius: 999px;
        padding: 0.32rem 0.62rem;
        font-size: 0.62rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        transition: 0.16s ease;
        cursor: pointer;
    }

    .timeframe-btn:hover {
        color: #f8fafc;
        border-color: rgba(245,158,11,0.24);
    }

    .timeframe-btn-active {
        background: rgba(245,158,11,0.14);
        color: #f59e0b;
        border-color: rgba(245,158,11,0.32);
    }

    .cot-body {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex: 1;
        margin-top: 0.6rem;
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
        gap: 1rem;
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
        margin-top: 0.7rem;
        font-size: 0.58rem;
        color: rgba(255,255,255,0.25);
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.35rem;
    }

    .cot-lag-tag,
    .cot-stale-tag,
    .signal-confidence {
        font-size: 0.55rem;
        padding: 2px 6px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255,255,255,0.55);
    }

    .cot-stale {
        color: #f59e0b;
    }

    .cot-stale-tag {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
    }

    .cot-empty {
        font-size: 0.75rem;
        color: rgba(255,255,255,0.3);
        text-align: center;
        padding: 2rem;
    }

    .signal-panel {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
    }

    .signal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
    }

    .signal-score-row {
        display: flex;
        align-items: flex-start;
        gap: 0.9rem;
    }

    .signal-score {
        font-size: 2.5rem;
        line-height: 1;
        font-weight: 800;
        color: #f8fafc;
        min-width: 4rem;
    }

    .signal-score-meta {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
    }

    .signal-badge {
        width: fit-content;
        font-size: 0.85rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        padding: 0.42rem 0.7rem;
        border-radius: 10px;
        border: 1px solid;
    }

    .signal-summary {
        font-size: 0.76rem;
        color: rgba(255,255,255,0.55);
        line-height: 1.5;
    }

    .signal-score-track {
        height: 6px;
        background: rgba(255,255,255,0.07);
        border-radius: 999px;
        overflow: hidden;
    }

    .signal-score-fill {
        height: 100%;
        border-radius: 999px;
    }

    .signal-driver-list {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }

    .signal-driver {
        padding: 0.7rem 0.75rem;
        border-radius: 10px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.05);
    }

    .signal-driver-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
    }

    .signal-driver-label {
        font-size: 0.7rem;
        font-weight: 700;
        color: rgba(255,255,255,0.78);
    }

    .signal-driver-impact {
        font-size: 0.68rem;
        font-weight: 700;
        color: rgba(255,255,255,0.45);
    }

    .signal-driver-up {
        color: #22c55e;
    }

    .signal-driver-down {
        color: #ef4444;
    }

    .signal-driver-detail {
        margin-top: 0.35rem;
        font-size: 0.68rem;
        color: rgba(255,255,255,0.45);
    }

    .dash-loading {
        opacity: 0.5;
    }

    @media (max-width: 900px) {
        .source-health-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .chart-panel-header,
        .signal-header {
            flex-direction: column;
            align-items: flex-start;
        }

        .timeframe-switcher {
            justify-content: flex-start;
        }
    }

    @media (max-width: 768px) {
        .dash-header {
            padding: 0.9rem 1rem;
        }

        .dash-header-right {
            gap: 0.45rem;
            flex-wrap: wrap;
            justify-content: flex-end;
        }

        .source-health-row {
            padding: 0 0.75rem;
        }

        .dash-grid {
            grid-template-columns: 1fr;
            padding: 0.75rem 0.75rem 1.5rem;
        }

        .dash-hero,
        .dash-chart,
        .dash-macro,
        .dash-cot,
        .dash-signal {
            grid-column: 1;
            grid-row: auto;
        }

        .signal-score-row {
            flex-direction: column;
        }

        .signal-score {
            min-width: 0;
        }
    }

    @media (max-width: 560px) {
        .source-health-row {
            grid-template-columns: 1fr;
        }

        .source-card-summary {
            min-height: 0;
        }
    }
</style>
