<script lang="ts">
    import type { HeatmapBlock } from '$lib/types/contentBlock';

    let { title, assets, timeframes, data, colorScale }: HeatmapBlock = $props();

    const maxAbs = $derived.by(() => {
        const allValues = data.flat().filter((v) => v !== null && !isNaN(v));
        return Math.max(Math.abs(Math.min(...allValues, 0)), Math.abs(Math.max(...allValues, 0)), 0.01);
    });

    function cellBg(value: number): string {
        const norm = Math.max(-1, Math.min(1, value / maxAbs)); // -1 to 1
        if (colorScale === 'goldblue') {
            if (norm > 0) {
                // positive → amber/gold
                const intensity = Math.round(norm * 200);
                return `rgba(245, 158, 11, ${norm * 0.7})`;
            } else {
                // negative → blue
                return `rgba(59, 130, 246, ${Math.abs(norm) * 0.7})`;
            }
        } else {
            // redgreen (default)
            if (norm > 0) {
                return `rgba(34, 197, 94, ${norm * 0.7})`;
            } else {
                return `rgba(239, 68, 68, ${Math.abs(norm) * 0.7})`;
            }
        }
    }

    function textColor(value: number): string {
        const norm = Math.abs(value / maxAbs);
        return norm > 0.5 ? '#fff' : 'rgba(255,255,255,0.8)';
    }

    function fmt(v: number): string {
        return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
    }
</script>

<div class="heatmap-block">
    {#if title}
        <div class="heatmap-title">{title}</div>
    {/if}
    <div class="heatmap-table-wrap">
        <table class="heatmap-table">
            <thead>
                <tr>
                    <th class="corner-cell"></th>
                    {#each assets as asset}
                        <th class="asset-header">{asset}</th>
                    {/each}
                </tr>
            </thead>
            <tbody>
                {#each timeframes as tf, rowIdx}
                    <tr>
                        <td class="tf-label">{tf}</td>
                        {#each assets as _asset, colIdx}
                            {@const val = data[rowIdx]?.[colIdx] ?? 0}
                            <td
                                class="data-cell"
                                style="background: {cellBg(val)}; color: {textColor(val)}"
                                title="{assets[colIdx]} {tf}: {fmt(val)}"
                            >
                                {fmt(val)}
                            </td>
                        {/each}
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</div>

<style>
    .heatmap-block {
        background: rgba(13, 17, 23, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 1rem;
        overflow: hidden;
    }
    .heatmap-title {
        font-size: 0.75rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.5);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.75rem;
    }
    .heatmap-table-wrap {
        overflow-x: auto;
    }
    .heatmap-table {
        border-collapse: separate;
        border-spacing: 3px;
        width: 100%;
    }
    .corner-cell {
        min-width: 48px;
    }
    .asset-header {
        font-size: 0.7rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.6);
        text-align: center;
        padding: 4px 8px;
        white-space: nowrap;
    }
    .tf-label {
        font-size: 0.7rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.5);
        padding: 4px 8px;
        white-space: nowrap;
    }
    .data-cell {
        font-size: 0.72rem;
        font-weight: 600;
        text-align: center;
        padding: 6px 10px;
        border-radius: 6px;
        white-space: nowrap;
        transition: filter 0.15s;
        min-width: 60px;
    }
    .data-cell:hover {
        filter: brightness(1.3);
    }
</style>
