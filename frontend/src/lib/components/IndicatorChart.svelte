<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import {
        createChart,
        createSeriesMarkers,
        CandlestickSeries,
        LineSeries,
        HistogramSeries,
        ColorType,
        CrosshairMode,
        LineStyle,
        type IChartApi,
        type ISeriesApi,
        type UTCTimestamp,
        type SeriesMarker,
        type Time,
    } from "lightweight-charts";
    import type { IndicatorValue } from "$lib/types/indicator";

    // Props
    let {
        ohlcvData,
        indicatorResults,
        overlayType = "separate",
        indicatorName = "Indicator",
        height = 400,
    }: {
        ohlcvData: {
            timestamp: number;
            open: number;
            high: number;
            low: number;
            close: number;
            volume: number;
        }[];
        indicatorResults: IndicatorValue[];
        overlayType?: "overlay" | "separate";
        indicatorName?: string;
        height?: number;
    } = $props();

    let chartContainer = $state<HTMLDivElement>(null!);
    let indicatorContainer = $state<HTMLDivElement>(null!);
    let chart: IChartApi | null = null;
    let indicatorChart: IChartApi | null = null;
    let resizeObserver: ResizeObserver | null = null;

    // Color palette for indicator lines
    const LINE_COLORS = [
        "#00d4aa",
        "#ff6b6b",
        "#ffd93d",
        "#6bcbff",
        "#c084fc",
        "#ff9f43",
        "#54a0ff",
        "#5f27cd",
    ];

    // Special colors for known keys
    const SPECIAL_COLORS: Record<string, string> = {
        overbought: "#ff6b6b",
        oversold: "#4ecdc4",
        upper: "#ff6b6b88",
        lower: "#4ecdc488",
        basis: "#ffd93d",
        signal_line: "#ff6b6b",
        histogram: "#6bcbff",
        close: "#ffffff44",
        k: "#00d4aa",
        d: "#ff6b6b",
        fast_ma: "#00d4aa",
        slow_ma: "#ff6b6b",
        vwap: "#ffd93d",
    };

    function toChartTime(ts: number): UTCTimestamp {
        return Math.floor(ts / 1000) as UTCTimestamp;
    }

    function createChartOptions(container: HTMLDivElement, h: number) {
        return {
            width: container.clientWidth,
            height: h,
            layout: {
                background: {
                    type: ColorType.Solid as const,
                    color: "transparent",
                },
                textColor: "rgba(255, 255, 255, 0.5)",
                fontSize: 11,
                fontFamily: "'Inter', sans-serif",
            },
            grid: {
                vertLines: { color: "rgba(255, 255, 255, 0.04)" },
                horzLines: { color: "rgba(255, 255, 255, 0.04)" },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: {
                    color: "rgba(0, 212, 170, 0.3)",
                    width: 1 as const,
                    style: LineStyle.Dashed,
                    labelBackgroundColor: "#0d1117",
                },
                horzLine: {
                    color: "rgba(0, 212, 170, 0.3)",
                    width: 1 as const,
                    style: LineStyle.Dashed,
                    labelBackgroundColor: "#0d1117",
                },
            },
            rightPriceScale: {
                borderColor: "rgba(255, 255, 255, 0.08)",
                scaleMargins: { top: 0.1, bottom: 0.1 },
            },
            timeScale: {
                borderColor: "rgba(255, 255, 255, 0.08)",
                timeVisible: true,
                secondsVisible: false,
            },
            handleScroll: { vertTouchDrag: false },
        };
    }

    function buildChart() {
        if (!chartContainer || !ohlcvData?.length) return;

        // Cleanup old charts
        destroyCharts();

        const candleData = ohlcvData.map((d) => ({
            time: toChartTime(d.timestamp),
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
        }));

        // --- MAIN CHART (Candlestick) ---
        const mainHeight =
            overlayType === "separate" ? Math.floor(height * 0.55) : height;
        chart = createChart(
            chartContainer,
            createChartOptions(chartContainer, mainHeight),
        );

        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: "#00d4aa",
            downColor: "#ff6b6b",
            borderDownColor: "#ff6b6b",
            borderUpColor: "#00d4aa",
            wickDownColor: "#ff6b6b88",
            wickUpColor: "#00d4aa88",
        });
        candleSeries.setData(candleData);

        // Volume as histogram on main chart
        const volumeSeries = chart.addSeries(HistogramSeries, {
            color: "rgba(0, 212, 170, 0.15)",
            priceFormat: { type: "volume" as const },
            priceScaleId: "volume",
        });
        chart.priceScale("volume").applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 },
        });
        volumeSeries.setData(
            ohlcvData.map((d) => ({
                time: toChartTime(d.timestamp),
                value: d.volume,
                color:
                    d.close >= d.open
                        ? "rgba(0, 212, 170, 0.2)"
                        : "rgba(255, 107, 107, 0.2)",
            })),
        );

        // If overlay indicator, plot on main chart
        if (overlayType === "overlay" && indicatorResults?.length) {
            plotIndicatorLines(chart, indicatorResults, true);
        }

        // Add buy/sell markers on main chart
        addSignalMarkers(candleSeries, indicatorResults);

        chart.timeScale().fitContent();

        // --- INDICATOR CHART (Separate pane) ---
        if (
            overlayType === "separate" &&
            indicatorResults?.length &&
            indicatorContainer
        ) {
            const indHeight = Math.floor(height * 0.4);
            indicatorChart = createChart(
                indicatorContainer,
                createChartOptions(indicatorContainer, indHeight),
            );

            plotIndicatorLines(indicatorChart, indicatorResults, false);

            indicatorChart.timeScale().fitContent();

            // Sync time scales
            chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
                if (range && indicatorChart) {
                    indicatorChart.timeScale().setVisibleLogicalRange(range);
                }
            });
            indicatorChart
                .timeScale()
                .subscribeVisibleLogicalRangeChange((range) => {
                    if (range && chart) {
                        chart.timeScale().setVisibleLogicalRange(range);
                    }
                });
        }

        // Resize observer
        resizeObserver = new ResizeObserver(() => {
            if (chart && chartContainer) {
                chart.applyOptions({ width: chartContainer.clientWidth });
            }
            if (indicatorChart && indicatorContainer) {
                indicatorChart.applyOptions({
                    width: indicatorContainer.clientWidth,
                });
            }
        });
        resizeObserver.observe(chartContainer);
    }

    function plotIndicatorLines(
        targetChart: IChartApi,
        results: IndicatorValue[],
        isOverlay: boolean,
    ) {
        if (!results?.length) return;

        const keys = Object.keys(results[0]?.values || {}).filter(
            (k) => k !== "close",
        );
        let colorIdx = 0;

        for (const key of keys) {
            const isConstant = results.every(
                (r) =>
                    r.values[key] === results[0].values[key] ||
                    r.values[key] === null,
            );

            const color =
                SPECIAL_COLORS[key] ||
                LINE_COLORS[colorIdx % LINE_COLORS.length];
            colorIdx++;

            // Check if this is a histogram-type value (like MACD histogram)
            if (key === "histogram") {
                const histSeries = targetChart.addSeries(HistogramSeries, {
                    color: color,
                    priceFormat: {
                        type: "price" as const,
                        precision: 4,
                        minMove: 0.0001,
                    },
                    ...(isOverlay ? { priceScaleId: "indicator" } : {}),
                });
                histSeries.setData(
                    results
                        .filter(
                            (r) =>
                                r.values[key] !== null &&
                                r.values[key] !== undefined,
                        )
                        .map((r) => ({
                            time: toChartTime(r.timestamp),
                            value: r.values[key] as number,
                            color:
                                (r.values[key] as number) >= 0
                                    ? "rgba(0, 212, 170, 0.6)"
                                    : "rgba(255, 107, 107, 0.6)",
                        })),
                );
                continue;
            }

            // Constant lines (overbought, oversold) - use dashed lines
            if (isConstant && results[0].values[key] !== null) {
                const lineSeries = targetChart.addSeries(LineSeries, {
                    color: color,
                    lineWidth: 1,
                    lineStyle: LineStyle.Dashed,
                    crosshairMarkerVisible: false,
                    lastValueVisible: true,
                    priceLineVisible: false,
                    ...(isOverlay ? { priceScaleId: "indicator" } : {}),
                });
                lineSeries.setData(
                    results
                        .filter((r) => r.values[key] !== null)
                        .map((r) => ({
                            time: toChartTime(r.timestamp),
                            value: r.values[key] as number,
                        })),
                );
                continue;
            }

            // Normal line series
            const lineSeries = targetChart.addSeries(LineSeries, {
                color: color,
                lineWidth: 2,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 4,
                crosshairMarkerBorderColor: color,
                crosshairMarkerBackgroundColor: "#0d1117",
                lastValueVisible: true,
                priceLineVisible: false,
                ...(isOverlay ? { priceScaleId: "indicator" } : {}),
            });
            lineSeries.setData(
                results
                    .filter(
                        (r) =>
                            r.values[key] !== null &&
                            r.values[key] !== undefined,
                    )
                    .map((r) => ({
                        time: toChartTime(r.timestamp),
                        value: r.values[key] as number,
                    })),
            );
        }
    }

    function addSignalMarkers(
        candleSeries: ISeriesApi<"Candlestick">,
        results: IndicatorValue[],
    ) {
        if (!results?.length) return;

        const markers: SeriesMarker<Time>[] = results
            .filter((r) => r.signal === "buy" || r.signal === "sell")
            .map((r) => ({
                time: toChartTime(r.timestamp) as Time,
                position:
                    r.signal === "buy"
                        ? ("belowBar" as const)
                        : ("aboveBar" as const),
                color: r.signal === "buy" ? "#00d4aa" : "#ff6b6b",
                shape:
                    r.signal === "buy"
                        ? ("arrowUp" as const)
                        : ("arrowDown" as const),
                text: (r.signal === "buy" ? "BUY" : "SELL") as string,
            }));

        if (markers.length > 0) {
            createSeriesMarkers(candleSeries, markers);
        }
    }

    function destroyCharts() {
        if (chart) {
            chart.remove();
            chart = null;
        }
        if (indicatorChart) {
            indicatorChart.remove();
            indicatorChart = null;
        }
    }

    // Reactively rebuild chart when data changes
    $effect(() => {
        if (ohlcvData && indicatorResults && chartContainer) {
            requestAnimationFrame(() => buildChart());
        }
    });

    onMount(() => {
        if (ohlcvData?.length) {
            buildChart();
        }
    });

    onDestroy(() => {
        resizeObserver?.disconnect();
        destroyCharts();
    });
</script>

<div class="indicator-chart-wrapper">
    <!-- Main Candlestick Chart -->
    <div class="chart-section">
        <div class="chart-label">
            <span class="chart-label-icon">📊</span>
            <span>Price Action</span>
            {#if overlayType === "overlay"}
                <span class="chart-badge overlay">+ {indicatorName}</span>
            {/if}
        </div>
        <div bind:this={chartContainer} class="chart-canvas"></div>
    </div>

    <!-- Indicator Separate Pane -->
    {#if overlayType === "separate"}
        <div class="chart-divider"></div>
        <div class="chart-section indicator-section">
            <div class="chart-label">
                <span class="chart-label-icon">📉</span>
                <span>{indicatorName}</span>
                <span class="chart-badge separate">Separate Pane</span>
            </div>
            <div bind:this={indicatorContainer} class="chart-canvas"></div>
        </div>
    {/if}

    <!-- Legend -->
    {#if indicatorResults?.length}
        <div class="chart-legend">
            {#each Object.keys(indicatorResults[0]?.values || {}).filter((k) => k !== "close") as key, i}
                <div class="legend-item">
                    <div
                        class="legend-dot"
                        style="background: {SPECIAL_COLORS[key] ||
                            LINE_COLORS[i % LINE_COLORS.length]}"
                    ></div>
                    <span class="legend-label">{key}</span>
                </div>
            {/each}
            <div class="legend-item">
                <div class="legend-dot buy-dot"></div>
                <span class="legend-label signal-buy">▲ Buy</span>
            </div>
            <div class="legend-item">
                <div class="legend-dot sell-dot"></div>
                <span class="legend-label signal-sell">▼ Sell</span>
            </div>
        </div>
    {/if}
</div>

<style>
    .indicator-chart-wrapper {
        border-radius: 12px;
        overflow: hidden;
        background: rgba(13, 17, 23, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.06);
        backdrop-filter: blur(12px);
    }

    .chart-section {
        position: relative;
    }

    .chart-label {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        font-size: 11px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.6);
        background: rgba(255, 255, 255, 0.02);
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }

    .chart-label-icon {
        font-size: 12px;
    }

    .chart-badge {
        margin-left: auto;
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 9px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .chart-badge.overlay {
        background: rgba(0, 212, 170, 0.15);
        color: #00d4aa;
        border: 1px solid rgba(0, 212, 170, 0.2);
    }

    .chart-badge.separate {
        background: rgba(107, 203, 255, 0.15);
        color: #6bcbff;
        border: 1px solid rgba(107, 203, 255, 0.2);
    }

    .chart-canvas {
        width: 100%;
    }

    .chart-divider {
        height: 1px;
        background: linear-gradient(
            90deg,
            transparent,
            rgba(0, 212, 170, 0.3),
            transparent
        );
    }

    .indicator-section .chart-label {
        background: rgba(0, 212, 170, 0.03);
    }

    .chart-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.02);
        border-top: 1px solid rgba(255, 255, 255, 0.04);
    }

    .legend-item {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .legend-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .buy-dot {
        background: #00d4aa;
    }

    .sell-dot {
        background: #ff6b6b;
    }

    .legend-label {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.5);
        font-weight: 500;
        text-transform: capitalize;
    }

    .signal-buy {
        color: #00d4aa;
    }

    .signal-sell {
        color: #ff6b6b;
    }
</style>
