<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import {
        createChart,
        CandlestickSeries,
        LineSeries,
        HistogramSeries,
        ColorType,
        CrosshairMode,
        LineStyle,
        type IChartApi,
        type UTCTimestamp,
    } from "lightweight-charts";
    import type { OHLCV } from "$lib/types/contentBlock";

    let {
        chartType = "candlestick",
        symbol,
        interval,
        data,
        indicators,
    }: {
        chartType: "candlestick" | "line" | "bar";
        symbol: string;
        interval: string;
        data: OHLCV[];
        indicators?: {
            name: string;
            data: { time: number; value: number }[];
            color?: string;
            overlay: boolean;
        }[];
    } = $props();

    let mainContainer = $state<HTMLDivElement>(null!);
    let separateContainer = $state<HTMLDivElement>(null!);
    let mainChart: IChartApi | null = null;
    let separateChart: IChartApi | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const hasSeparateIndicators = $derived(
        indicators?.some((ind) => !ind.overlay) ?? false,
    );

    function chartOptions(container: HTMLDivElement, height: number) {
        return {
            width: container.clientWidth,
            height,
            layout: {
                background: { type: ColorType.Solid as const, color: "transparent" },
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
        if (!mainContainer || !data?.length) return;
        destroy();

        const mainHeight = hasSeparateIndicators ? 260 : 350;
        mainChart = createChart(mainContainer, chartOptions(mainContainer, mainHeight));

        // Candlestick / Line series
        if (chartType === "candlestick") {
            const series = mainChart.addSeries(CandlestickSeries, {
                upColor: "#00d4aa",
                downColor: "#ff6b6b",
                borderDownColor: "#ff6b6b",
                borderUpColor: "#00d4aa",
                wickDownColor: "#ff6b6b88",
                wickUpColor: "#00d4aa88",
            });
            series.setData(
                data.map((d) => ({
                    time: d.time as UTCTimestamp,
                    open: d.open,
                    high: d.high,
                    low: d.low,
                    close: d.close,
                })),
            );
        } else {
            const series = mainChart.addSeries(LineSeries, {
                color: "#00d4aa",
                lineWidth: 2,
            });
            series.setData(
                data.map((d) => ({
                    time: d.time as UTCTimestamp,
                    value: d.close,
                })),
            );
        }

        // Volume histogram
        const volSeries = mainChart.addSeries(HistogramSeries, {
            color: "rgba(0, 212, 170, 0.15)",
            priceFormat: { type: "volume" as const },
            priceScaleId: "volume",
        });
        mainChart.priceScale("volume").applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 },
        });
        volSeries.setData(
            data.map((d) => ({
                time: d.time as UTCTimestamp,
                value: d.volume,
                color:
                    d.close >= d.open
                        ? "rgba(0, 212, 170, 0.2)"
                        : "rgba(255, 107, 107, 0.2)",
            })),
        );

        // Overlay indicators on main chart
        if (indicators) {
            for (const ind of indicators.filter((i) => i.overlay)) {
                const lineSeries = mainChart.addSeries(LineSeries, {
                    color: ind.color || "#f59e0b",
                    lineWidth: 2,
                    lastValueVisible: true,
                    priceLineVisible: false,
                });
                lineSeries.setData(
                    ind.data.map((d) => ({
                        time: d.time as UTCTimestamp,
                        value: d.value,
                    })),
                );
            }
        }

        mainChart.timeScale().fitContent();

        // Separate indicator panel
        if (hasSeparateIndicators && separateContainer) {
            separateChart = createChart(
                separateContainer,
                chartOptions(separateContainer, 150),
            );

            for (const ind of indicators!.filter((i) => !i.overlay)) {
                const lineSeries = separateChart.addSeries(LineSeries, {
                    color: ind.color || "#8b5cf6",
                    lineWidth: 2,
                    lastValueVisible: true,
                    priceLineVisible: false,
                });
                lineSeries.setData(
                    ind.data.map((d) => ({
                        time: d.time as UTCTimestamp,
                        value: d.value,
                    })),
                );
            }

            separateChart.timeScale().fitContent();

            // Sync time scales
            mainChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
                if (range && separateChart)
                    separateChart.timeScale().setVisibleLogicalRange(range);
            });
            separateChart
                .timeScale()
                .subscribeVisibleLogicalRangeChange((range) => {
                    if (range && mainChart)
                        mainChart.timeScale().setVisibleLogicalRange(range);
                });
        }

        // Resize
        resizeObserver = new ResizeObserver(() => {
            if (mainChart && mainContainer)
                mainChart.applyOptions({ width: mainContainer.clientWidth });
            if (separateChart && separateContainer)
                separateChart.applyOptions({
                    width: separateContainer.clientWidth,
                });
        });
        resizeObserver.observe(mainContainer);
    }

    function destroy() {
        resizeObserver?.disconnect();
        resizeObserver = null;
        if (mainChart) {
            mainChart.remove();
            mainChart = null;
        }
        if (separateChart) {
            separateChart.remove();
            separateChart = null;
        }
    }

    $effect(() => {
        if (data && mainContainer) {
            requestAnimationFrame(() => buildChart());
        }
    });

    onMount(() => {
        if (data?.length) buildChart();
    });

    onDestroy(() => destroy());
</script>

<div class="chart-block">
    <div class="chart-header">
        <span class="chart-symbol">{symbol}</span>
        <span class="chart-interval">{interval}</span>
        {#if indicators?.length}
            <div class="chart-indicators">
                {#each indicators as ind}
                    <span class="indicator-badge" style="--ind-color: {ind.color || '#8b5cf6'}">
                        {ind.name}
                    </span>
                {/each}
            </div>
        {/if}
    </div>

    <div bind:this={mainContainer} class="chart-canvas"></div>

    {#if hasSeparateIndicators}
        <div class="chart-divider"></div>
        <div bind:this={separateContainer} class="chart-canvas"></div>
    {/if}
</div>

<style>
    .chart-block {
        border-radius: 12px;
        overflow: hidden;
        background: rgba(13, 17, 23, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(12px);
    }

    .chart-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        background: rgba(255, 255, 255, 0.03);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .chart-symbol {
        font-size: 14px;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.95);
    }

    .chart-interval {
        font-size: 11px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.4);
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.05);
    }

    .chart-indicators {
        display: flex;
        gap: 4px;
        margin-left: auto;
        flex-wrap: wrap;
    }

    .indicator-badge {
        font-size: 10px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 4px;
        color: var(--ind-color);
        background: color-mix(in srgb, var(--ind-color) 12%, transparent);
        border: 1px solid color-mix(in srgb, var(--ind-color) 20%, transparent);
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
</style>
