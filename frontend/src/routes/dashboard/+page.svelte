<script lang="ts">
    import Sidebar from "$lib/components/Sidebar.svelte";
    import { onDestroy, onMount } from 'svelte';
    import { fade, fly } from 'svelte/transition';
    import { Activity, Calendar, RefreshCw } from "lucide-svelte";
    import GoldHeroPanel from '$lib/components/dashboard/GoldHeroPanel.svelte';
    import MacroStrip from '$lib/components/dashboard/MacroStrip.svelte';
    import DashboardMiniChart from '$lib/components/dashboard/DashboardMiniChart.svelte';
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
    const timeframeLabels: Record<DashboardTimeframe, string> = {
        '1d': '1D',
        '1wk': '1W',
        '1mo': '1M',
        '3mo': '3M',
        '6mo': '6M',
        '1y': '1Y'
    };

    let sidebarOpen = $state(true);
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
    const heroEyebrow = $derived(`Live market framing · ${formatTimeframeLabel(selectedTimeframe)}`);

    function normalizeTimeframe(value: string | null | undefined): DashboardTimeframe {
        if (value && DASHBOARD_TIMEFRAMES.includes(value as DashboardTimeframe)) {
            return value as DashboardTimeframe;
        }
        return '1mo';
    }

    function formatTimeframeLabel(timeframe: DashboardTimeframe): string {
        return timeframeLabels[timeframe] ?? timeframe.toUpperCase();
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
            fetchError = null;

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

    async function handleRefresh() {
        await fetchDashboard('poll', selectedTimeframe);
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
        if (switchingTimeframe) return `Switching to ${formatTimeframeLabel(selectedTimeframe)}`;
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

<div class="flex h-full overflow-hidden bg-background text-foreground font-sans">
    <Sidebar bind:isOpen={sidebarOpen} />

    <main
        class="dashboard-main flex-1 overflow-hidden h-full transition-all duration-300"
        class:ml-64={sidebarOpen}
        class:ml-0={!sidebarOpen}
    >
        <div class="dashboard-scroll">
            <div class="dashboard-container">
                <header class="dashboard-hero">
                    <div class="hero-copy">
                        <p class="hero-eyebrow">{heroEyebrow}</p>
                        <h1 class="hero-title">Gold Dashboard</h1>
                        <p class="hero-description">
                            A premium snapshot of gold price, macro pressure, COT positioning, and
                            chart context for fast market orientation.
                        </p>
                    </div>

                    <div class="hero-actions">
                        {#if lastUpdate}
                            <div class="meta-pill">
                                <Calendar size={14} />
                                <span>Updated {lastUpdate} ICT</span>
                            </div>
                        {/if}

                        {#if meta?.warnings?.length}
                            <div class="meta-pill warning-pill">
                                <span>{meta.warnings.length} warning{meta.warnings.length > 1 ? 's' : ''}</span>
                            </div>
                        {/if}

                        <div class="meta-pill live-pill">
                            <Activity size={14} />
                            <span>{refreshLabel()}</span>
                            <span class="live-dot" class:is-busy={busy}></span>
                        </div>

                        <button
                            class="refresh-button"
                            onclick={handleRefresh}
                            disabled={busy}
                        >
                            <span class:is-spinning={busy}>
                                <RefreshCw size={15} />
                            </span>
                            <span>{refreshing ? 'Refreshing' : 'Refresh'}</span>
                        </button>
                    </div>
                </header>

                {#if fetchError && data}
                    <div class="inline-notice" transition:fade={{ duration: 180 }}>
                        <div>
                            <p class="notice-label">Refresh failed</p>
                            <p class="notice-copy">{fetchError}</p>
                        </div>
                        <button class="notice-action" onclick={handleRefresh}>
                            Try again
                        </button>
                    </div>
                {/if}

                {#if initialLoading && !data}
                    <div class="content-stack" aria-hidden="true">
                        <section class="dashboard-panel">
                            <div class="panel-head">
                                <div>
                                    <div class="skeleton-line skeleton-line-short"></div>
                                    <div class="skeleton-line skeleton-line-medium"></div>
                                </div>
                                <div class="skeleton-line skeleton-line-caption"></div>
                            </div>

                            <div class="source-grid">
                                {#each Array.from({ length: 4 }) as _, index}
                                    <article class="source-card skeleton-card" data-skeleton-source={index}>
                                        <div class="skeleton-line skeleton-line-short"></div>
                                        <div class="skeleton-line skeleton-line-medium"></div>
                                        <div class="skeleton-line skeleton-line-short"></div>
                                    </article>
                                {/each}
                            </div>
                        </section>

                        <div class="feature-grid">
                            {#each Array.from({ length: 2 }) as _, index}
                                <section class="dashboard-panel" data-feature-skeleton={index}>
                                    <div class="panel-head">
                                        <div>
                                            <div class="skeleton-line skeleton-line-short"></div>
                                            <div class="skeleton-line skeleton-line-medium"></div>
                                        </div>
                                    </div>

                                    <div class="skeleton-panel-body">
                                        <div class="skeleton-badge"></div>
                                        <div class="skeleton-line skeleton-line-value"></div>
                                        <div class="skeleton-line skeleton-line-medium"></div>
                                        <div class="skeleton-line skeleton-line-medium"></div>
                                    </div>
                                </section>
                            {/each}
                        </div>

                        <div class="market-grid">
                            {#each Array.from({ length: 2 }) as _, index}
                                <section class="dashboard-panel" data-market-skeleton={index}>
                                    <div class="panel-head">
                                        <div>
                                            <div class="skeleton-line skeleton-line-short"></div>
                                            <div class="skeleton-line skeleton-line-medium"></div>
                                        </div>
                                        {#if index === 0}
                                            <div class="timeframe-switcher">
                                                {#each Array.from({ length: 4 }) as __}
                                                    <div class="skeleton-pill"></div>
                                                {/each}
                                            </div>
                                        {/if}
                                    </div>

                                    <div class="chart-skeleton" class:compact-chart-skeleton={index === 1}>
                                        <div class="skeleton-chart-grid"></div>
                                    </div>
                                </section>
                            {/each}
                        </div>

                        <section class="dashboard-panel">
                            <div class="panel-head">
                                <div>
                                    <div class="skeleton-line skeleton-line-short"></div>
                                    <div class="skeleton-line skeleton-line-medium"></div>
                                </div>
                            </div>

                            <div class="macro-skeleton">
                                {#each Array.from({ length: 5 }) as _, index}
                                    <div class="skeleton-pill macro-skeleton-pill" data-macro-pill={index}></div>
                                {/each}
                            </div>
                        </section>
                    </div>
                {:else if !data}
                    <div class="state-shell">
                        <section class="state-card" transition:fly={{ y: 14, duration: 220 }}>
                            <p class="state-kicker">{fetchError ? 'Unavailable' : 'Awaiting data'}</p>
                            <h2 class="state-title">
                                {fetchError ? 'Dashboard could not be loaded' : 'Dashboard data unavailable'}
                            </h2>
                            <p class="state-copy">
                                {fetchError ?? 'The dashboard feed returned no renderable data.'}
                            </p>
                            <button class="refresh-button" onclick={() => fetchDashboard('initial', selectedTimeframe)}>
                                <RefreshCw size={15} />
                                <span>Retry</span>
                            </button>
                        </section>
                    </div>
                {:else}
                    <div class="content-stack" transition:fade={{ duration: 180 }}>
                        <section class="dashboard-panel">
                            <div class="panel-head">
                                <div>
                                    <p class="panel-eyebrow">System health</p>
                                    <h2 class="panel-title">Source availability and freshness</h2>
                                </div>
                                <p class="panel-caption">
                                    Gold, macro, COT, and chart feeds behind this snapshot
                                </p>
                            </div>

                            {#if meta?.sources?.length}
                                <div class="source-grid">
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
                                            <div class="source-card-summary">
                                                {sourceMeta?.summary ?? 'Status unavailable'}
                                            </div>
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
                                </div>
                            {:else}
                                <div class="empty-card">
                                    <p class="empty-title">Source metadata unavailable</p>
                                    <p class="empty-copy">
                                        Feed diagnostics will appear here once the dashboard returns
                                        source-level health information.
                                    </p>
                                </div>
                            {/if}
                        </section>

                        <div class="feature-grid">
                            <section class="dashboard-panel">
                                <div class="panel-head">
                                    <div>
                                        <p class="panel-eyebrow">Gold pulse</p>
                                        <h2 class="panel-title">Spot, Thai gold, and range context</h2>
                                    </div>
                                    <p class="panel-caption">
                                        Primary price framing for the current dashboard snapshot
                                    </p>
                                </div>

                                <GoldHeroPanel gold={data.gold} chrome="embedded" />
                            </section>

                            <section class="dashboard-panel">
                                <div class="panel-head">
                                    <div>
                                        <p class="panel-eyebrow">Market assessment</p>
                                        <h2 class="panel-title">Market Assessment</h2>
                                    </div>
                                    <p class="panel-caption">
                                        Composite score derived from macro and positioning inputs
                                    </p>
                                </div>

                                <div class="signal-panel">
                                    <div class="signal-header">
                                        <span class="signal-confidence">
                                            {data.assessment.confidence} confidence
                                        </span>
                                    </div>

                                    <div class="signal-score-row">
                                        <div class="signal-score">{data.assessment.score}</div>
                                        <div class="signal-score-meta">
                                            <div
                                                class="signal-badge"
                                                style={`background:${signalColor(data.assessment.signal)}18; border-color:${signalColor(data.assessment.signal)}40; color:${signalColor(data.assessment.signal)};`}
                                            >
                                                {data.assessment.signal.toUpperCase()}
                                            </div>
                                            <div class="signal-summary">{data.assessment.summary}</div>
                                        </div>
                                    </div>

                                    <div class="signal-score-track">
                                        <div
                                            class="signal-score-fill"
                                            style={`width:${data.assessment.score}%; background:${signalColor(data.assessment.signal)};`}
                                        ></div>
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
                            </section>
                        </div>

                        <div class="market-grid">
                            <section class="dashboard-panel">
                                <div class="panel-head panel-head-aligned-top">
                                    <div>
                                        <p class="panel-eyebrow">Gold chart</p>
                                        <h2 class="panel-title">GC=F Gold Futures</h2>
                                    </div>

                                    <div class="chart-header-actions">
                                        <p class="chart-subtitle">
                                            {#if data.chart}
                                                {data.chart.interval} candles
                                            {:else}
                                                Awaiting chart data
                                            {/if}
                                        </p>

                                        <div class="timeframe-switcher">
                                            {#each DASHBOARD_TIMEFRAMES as timeframe}
                                                <button
                                                    type="button"
                                                    class="timeframe-btn"
                                                    class:timeframe-btn-active={selectedTimeframe === timeframe}
                                                    onclick={() => handleTimeframeChange(timeframe)}
                                                >
                                                    {formatTimeframeLabel(timeframe)}
                                                </button>
                                            {/each}
                                        </div>
                                    </div>
                                </div>

                                <DashboardMiniChart
                                    ohlcv={data.chart?.ohlcv ?? null}
                                    interval={data.chart?.interval}
                                    showHeader={false}
                                    chrome="embedded"
                                />
                            </section>

                            <section class="dashboard-panel">
                                <div class="panel-head">
                                    <div>
                                        <p class="panel-eyebrow">Positioning</p>
                                        <h2 class="panel-title">COT Positioning</h2>
                                    </div>
                                    <p class="panel-caption">Weekly futures positioning and momentum shift</p>
                                </div>

                                <div class="cot-panel">
                                    {#if data.cot}
                                        {@const cotNeedlePoint = cotNeedle(data.cot.netSpec)}
                                        <div class="cot-body">
                                            <svg viewBox="0 0 100 60" class="cot-gauge-svg">
                                                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="6" stroke-linecap="round"></path>
                                                <path d="M 10 50 A 40 40 0 0 1 30 14.2" fill="none" stroke="#22c55e" stroke-width="6" stroke-linecap="round" opacity="0.4"></path>
                                                <path d="M 30 14.2 A 40 40 0 0 1 50 10" fill="none" stroke="#22c55e" stroke-width="6" stroke-linecap="round" opacity="0.6"></path>
                                                <path d="M 50 10 A 40 40 0 0 1 70 14.2" fill="none" stroke="#f59e0b" stroke-width="6" stroke-linecap="round" opacity="0.5"></path>
                                                <path d="M 70 14.2 A 40 40 0 0 1 90 50" fill="none" stroke="#ef4444" stroke-width="6" stroke-linecap="round" opacity="0.4"></path>
                                                <line x1="50" y1="50" x2={cotNeedlePoint.x} y2={cotNeedlePoint.y} stroke="#f8fafc" stroke-width="2" stroke-linecap="round"></line>
                                                <circle cx="50" cy="50" r="3" fill="#f8fafc"></circle>
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
                                        <div class="empty-card compact-empty-card">
                                            <p class="empty-title">COT data unavailable</p>
                                            <p class="empty-copy">
                                                Weekly positioning will appear here once the feed is restored.
                                            </p>
                                        </div>
                                    {/if}
                                </div>
                            </section>
                        </div>

                        <section class="dashboard-panel">
                            <div class="panel-head">
                                <div>
                                    <p class="panel-eyebrow">Macro context</p>
                                    <h2 class="panel-title">Dollar, yields, equities, and bias</h2>
                                </div>
                                <p class="panel-caption">
                                    Moving tape of the core macro inputs that shape the gold view
                                </p>
                            </div>

                            <p class="section-note">
                                The strip keeps dollar strength, rates, equities, and derived gold
                                signal in one line for quick context checks.
                            </p>

                            <MacroStrip macro={data.macro} chrome="embedded" />
                        </section>
                    </div>
                {/if}
            </div>
        </div>
    </main>
</div>

<style>
    .dashboard-main {
        position: relative;
        background:
            radial-gradient(circle at top, rgba(214, 181, 123, 0.14), transparent 30%),
            radial-gradient(circle at 85% 15%, rgba(244, 238, 220, 0.08), transparent 24%),
            linear-gradient(180deg, #0d0c0a 0%, #060606 100%);
    }

    .dashboard-main::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
            linear-gradient(135deg, rgba(214, 181, 123, 0.08), transparent 40%),
            linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.02));
    }

    .dashboard-scroll {
        position: relative;
        z-index: 1;
        height: 100%;
        overflow-y: auto;
    }

    .dashboard-container {
        max-width: 1080px;
        margin: 0 auto;
        padding: 3.5rem 2rem 4rem;
    }

    .dashboard-hero,
    .panel-head,
    .source-card,
    .inline-notice,
    .state-card,
    .empty-card,
    .signal-driver {
        border: 1px solid rgba(214, 181, 123, 0.16);
    }

    .dashboard-hero {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 1.5rem;
        padding: 0 0 2rem;
        margin-bottom: 1.75rem;
        border-width: 0 0 1px;
    }

    .hero-copy {
        max-width: 42rem;
    }

    .hero-eyebrow,
    .panel-eyebrow,
    .notice-label,
    .state-kicker {
        margin: 0;
        color: rgba(227, 207, 165, 0.72);
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 0.72rem;
    }

    .hero-title,
    .panel-title,
    .state-title {
        margin: 0.35rem 0 0;
        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
        font-weight: 600;
        letter-spacing: -0.03em;
        color: rgba(255, 250, 239, 0.96);
    }

    .hero-title {
        font-size: clamp(2.5rem, 5vw, 4.1rem);
        line-height: 0.96;
    }

    .panel-title,
    .state-title {
        font-size: clamp(1.55rem, 2vw, 2rem);
        line-height: 1.04;
    }

    .hero-description,
    .panel-caption,
    .notice-copy,
    .state-copy,
    .empty-copy,
    .section-note,
    .signal-summary,
    .signal-driver-detail,
    .source-card-time,
    .source-card-details,
    .chart-subtitle {
        margin: 0;
        color: rgba(245, 239, 228, 0.62);
        line-height: 1.55;
    }

    .hero-description {
        margin-top: 1rem;
        max-width: 34rem;
        font-size: 0.98rem;
    }

    .hero-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 0.75rem;
        align-items: center;
    }

    .meta-pill,
    .refresh-button,
    .notice-action,
    .timeframe-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        border-radius: 999px;
        font-size: 0.82rem;
        letter-spacing: 0.02em;
    }

    .meta-pill {
        padding: 0.8rem 1rem;
        color: rgba(249, 244, 236, 0.72);
        background: rgba(255, 255, 255, 0.03);
    }

    .warning-pill {
        color: rgba(255, 230, 179, 0.86);
        border: 1px solid rgba(214, 181, 123, 0.18);
    }

    .live-pill {
        position: relative;
    }

    .live-dot {
        width: 0.55rem;
        height: 0.55rem;
        border-radius: 999px;
        background: rgba(34, 197, 94, 0.65);
        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.3);
    }

    .live-dot.is-busy {
        background: rgba(214, 181, 123, 0.95);
        animation: dashboard-pulse 1.3s ease-in-out infinite;
    }

    .refresh-button,
    .notice-action {
        padding: 0.82rem 1.1rem;
        background: linear-gradient(180deg, rgba(214, 181, 123, 0.18), rgba(214, 181, 123, 0.1));
        color: rgba(255, 247, 232, 0.95);
        border: 1px solid rgba(214, 181, 123, 0.24);
        cursor: pointer;
        transition:
            background-color 160ms ease,
            border-color 160ms ease,
            transform 160ms ease;
    }

    .refresh-button:hover,
    .notice-action:hover,
    .timeframe-btn:hover {
        background: linear-gradient(180deg, rgba(214, 181, 123, 0.24), rgba(214, 181, 123, 0.14));
        border-color: rgba(214, 181, 123, 0.34);
        transform: translateY(-1px);
    }

    .refresh-button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
        transform: none;
    }

    .is-spinning {
        animation: dashboard-spin 0.9s linear infinite;
    }

    .inline-notice,
    .state-card,
    .dashboard-panel,
    .source-card,
    .empty-card,
    .signal-driver {
        background: rgba(12, 11, 9, 0.8);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.22);
    }

    .inline-notice {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border-radius: 1.25rem;
        padding: 1rem 1.15rem;
        margin-bottom: 1.4rem;
    }

    .content-stack {
        display: grid;
        gap: 1.4rem;
    }

    .dashboard-panel {
        border-radius: 1.5rem;
        padding: 1.5rem;
    }

    .panel-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 1rem;
        padding: 0 0 1.2rem;
        margin-bottom: 1.35rem;
        border-width: 0 0 1px;
        background: transparent;
        box-shadow: none;
    }

    .panel-head-aligned-top {
        align-items: flex-start;
    }

    .panel-caption {
        max-width: 18rem;
        text-align: right;
        font-size: 0.9rem;
    }

    .source-grid,
    .feature-grid,
    .market-grid {
        display: grid;
        gap: 1rem;
    }

    .source-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .feature-grid {
        grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
    }

    .market-grid {
        grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
    }

    .source-card,
    .empty-card,
    .state-card {
        border-radius: 1.25rem;
        padding: 1.15rem;
    }

    .source-card {
        border-color: color-mix(in srgb, var(--source-color, #d6b57b) 24%, rgba(214, 181, 123, 0.18));
        background:
            linear-gradient(180deg, rgba(18, 16, 12, 0.92), rgba(12, 11, 9, 0.82)),
            radial-gradient(circle at top, color-mix(in srgb, var(--source-color, #d6b57b) 14%, transparent), transparent 52%);
    }

    .source-card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0.45rem;
    }

    .source-card-label {
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.55);
    }

    .source-card-status {
        font-size: 0.55rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--source-color, #d6b57b);
    }

    .source-card-summary,
    .empty-title {
        margin: 0;
        color: rgba(255, 249, 238, 0.94);
        font-size: 0.98rem;
        line-height: 1.35;
    }

    .source-card-time {
        margin-top: 0.55rem;
        font-size: 0.68rem;
    }

    .source-card-details {
        margin-top: 0.7rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.68rem;
    }

    .signal-panel,
    .cot-panel {
        display: grid;
        gap: 0.9rem;
    }

    .signal-header {
        display: flex;
        align-items: center;
        justify-content: flex-end;
    }

    .signal-score-row {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
    }

    .signal-score {
        font-size: clamp(2.5rem, 5vw, 4rem);
        line-height: 0.95;
        font-weight: 800;
        color: rgba(255, 250, 242, 0.98);
        min-width: 5rem;
        letter-spacing: -0.05em;
    }

    .signal-score-meta {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
    }

    .signal-badge,
    .signal-confidence,
    .cot-lag-tag,
    .cot-stale-tag {
        width: fit-content;
        font-size: 0.74rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        padding: 0.42rem 0.7rem;
        border-radius: 999px;
        border: 1px solid rgba(214, 181, 123, 0.14);
        text-transform: uppercase;
    }

    .signal-confidence {
        background: rgba(255, 255, 255, 0.04);
        color: rgba(245, 239, 228, 0.72);
        letter-spacing: 0.08em;
    }

    .signal-score-track {
        height: 0.5rem;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.07);
    }

    .signal-score-fill {
        height: 100%;
        border-radius: inherit;
        box-shadow: 0 0 22px color-mix(in srgb, currentColor 20%, transparent);
    }

    .signal-driver-list {
        display: grid;
        gap: 0.7rem;
    }

    .signal-driver {
        border-radius: 1rem;
        padding: 0.9rem 1rem;
        background: rgba(255, 255, 255, 0.03);
    }

    .signal-driver-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
    }

    .signal-driver-label {
        font-size: 0.72rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.78);
        text-transform: uppercase;
        letter-spacing: 0.08em;
    }

    .signal-driver-impact {
        font-size: 0.75rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.45);
    }

    .signal-driver-up {
        color: #22c55e;
    }

    .signal-driver-down {
        color: #ef4444;
    }

    .chart-header-actions {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.8rem;
    }

    .chart-subtitle {
        font-size: 0.86rem;
        text-align: right;
    }

    .timeframe-switcher {
        display: inline-flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 0.35rem;
    }

    .timeframe-btn {
        border: 1px solid rgba(214, 181, 123, 0.14);
        background: rgba(255, 255, 255, 0.03);
        color: rgba(255, 255, 255, 0.58);
        padding: 0.48rem 0.82rem;
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        cursor: pointer;
        transition:
            border-color 160ms ease,
            color 160ms ease,
            background-color 160ms ease,
            transform 160ms ease;
    }

    .timeframe-btn-active {
        background: rgba(214, 181, 123, 0.14);
        color: rgba(255, 236, 205, 0.96);
        border-color: rgba(214, 181, 123, 0.3);
    }

    .cot-body {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .cot-gauge-svg {
        width: 120px;
        height: 72px;
        flex-shrink: 0;
    }

    .cot-metrics {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        flex: 1;
    }

    .cot-metric {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 1rem;
    }

    .cot-metric-label {
        font-size: 0.68rem;
        color: rgba(255, 255, 255, 0.4);
        text-transform: uppercase;
        letter-spacing: 0.08em;
    }

    .cot-metric-value {
        font-size: 0.9rem;
        font-weight: 600;
        color: #f8fafc;
        font-variant-numeric: tabular-nums;
    }

    .cot-up {
        color: #22c55e;
    }

    .cot-down {
        color: #ef4444;
    }

    .cot-classification {
        color: #f59e0b;
    }

    .cot-report-date {
        margin-top: 0.3rem;
        font-size: 0.64rem;
        color: rgba(255, 255, 255, 0.32);
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.4rem;
    }

    .cot-lag-tag {
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.62);
        letter-spacing: 0.04em;
    }

    .cot-stale {
        color: #f59e0b;
    }

    .cot-stale-tag {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
        letter-spacing: 0.04em;
    }

    .section-note {
        margin-bottom: 1rem;
        font-size: 0.92rem;
    }

    .empty-card,
    .state-card {
        display: grid;
        gap: 0.8rem;
    }

    .compact-empty-card {
        min-height: 100%;
        align-content: center;
    }

    .state-shell {
        display: flex;
        justify-content: center;
        padding-top: 1rem;
    }

    .state-card {
        max-width: 34rem;
        width: 100%;
    }

    .skeleton-line,
    .skeleton-badge,
    .skeleton-pill,
    .skeleton-chart-grid::before,
    .skeleton-chart-grid::after {
        background: linear-gradient(90deg, rgba(255, 255, 255, 0.08), rgba(214, 181, 123, 0.18));
    }

    .skeleton-line {
        height: 0.72rem;
        border-radius: 999px;
    }

    .skeleton-line-short {
        width: 7rem;
    }

    .skeleton-line-medium {
        width: 12rem;
    }

    .skeleton-line-caption {
        width: 10rem;
    }

    .skeleton-line-value {
        width: 6rem;
        height: 2.2rem;
    }

    .skeleton-card {
        pointer-events: none;
        min-height: 9.5rem;
    }

    .skeleton-panel-body {
        display: grid;
        gap: 1rem;
    }

    .skeleton-badge {
        width: 2.8rem;
        height: 2.8rem;
        border-radius: 999px;
    }

    .skeleton-pill {
        width: 3rem;
        height: 2rem;
        border-radius: 999px;
    }

    .chart-skeleton {
        height: 16rem;
        border-radius: 1.2rem;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(214, 181, 123, 0.08);
    }

    .compact-chart-skeleton {
        height: 12rem;
    }

    .skeleton-chart-grid {
        position: relative;
        width: 100%;
        height: 100%;
    }

    .skeleton-chart-grid::before,
    .skeleton-chart-grid::after {
        content: "";
        position: absolute;
        inset: 18% 8%;
        border-radius: 1rem;
        opacity: 0.2;
    }

    .skeleton-chart-grid::after {
        inset: auto 10% 18% 10%;
        height: 0.3rem;
        border-radius: 999px;
        opacity: 0.28;
    }

    .macro-skeleton {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
    }

    .macro-skeleton-pill {
        width: 7rem;
    }

    @keyframes dashboard-spin {
        to {
            transform: rotate(360deg);
        }
    }

    @keyframes dashboard-pulse {
        0%,
        100% {
            box-shadow: 0 0 0 0 rgba(214, 181, 123, 0.28);
        }

        50% {
            box-shadow: 0 0 0 8px rgba(214, 181, 123, 0);
        }
    }

    @media (max-width: 960px) {
        .dashboard-container {
            padding: 2rem 1.25rem 3rem;
        }

        .dashboard-hero,
        .panel-head,
        .inline-notice {
            align-items: flex-start;
            flex-direction: column;
        }

        .hero-actions,
        .chart-header-actions,
        .timeframe-switcher {
            width: 100%;
        }

        .hero-actions,
        .chart-header-actions {
            justify-content: flex-start;
            align-items: flex-start;
        }

        .panel-caption,
        .chart-subtitle {
            max-width: none;
            text-align: left;
        }

        .source-grid,
        .feature-grid,
        .market-grid {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: 640px) {
        .dashboard-container {
            padding-inline: 1rem;
        }

        .dashboard-panel,
        .state-card {
            padding: 1.1rem;
        }

        .source-card {
            padding: 1rem;
        }

        .signal-score-row,
        .cot-body {
            flex-direction: column;
            align-items: flex-start;
        }

        .signal-score {
            min-width: 0;
        }

        .cot-gauge-svg {
            width: 100%;
            max-width: 140px;
        }
    }
</style>
