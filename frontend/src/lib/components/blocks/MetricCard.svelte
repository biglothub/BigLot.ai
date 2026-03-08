<script lang="ts">
    import { TrendingUp, TrendingDown, Minus } from "lucide-svelte";

    let {
        title,
        metrics,
    }: {
        title: string;
        metrics: {
            label: string;
            value: string;
            change?: string;
            direction?: "up" | "down" | "neutral";
        }[];
    } = $props();
</script>

<div class="metric-card">
    <div class="metric-header">
        <span class="metric-title">{title}</span>
    </div>
    <div class="metric-grid">
        {#each metrics as metric}
            <div class="metric-item">
                <span class="metric-label">{metric.label}</span>
                <div class="metric-value-row">
                    <span class="metric-value">{metric.value}</span>
                    {#if metric.change}
                        <span
                            class="metric-change"
                            class:up={metric.direction === "up"}
                            class:down={metric.direction === "down"}
                        >
                            {#if metric.direction === "up"}
                                <TrendingUp size={12} />
                            {:else if metric.direction === "down"}
                                <TrendingDown size={12} />
                            {:else}
                                <Minus size={12} />
                            {/if}
                            {metric.change}
                        </span>
                    {/if}
                </div>
            </div>
        {/each}
    </div>
</div>

<style>
    .metric-card {
        border-radius: 12px;
        overflow: hidden;
        background: rgba(13, 17, 23, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(12px);
    }

    .metric-header {
        padding: 10px 14px;
        background: rgba(255, 255, 255, 0.03);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .metric-title {
        font-size: 13px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.9);
    }

    .metric-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 1px;
        background: rgba(255, 255, 255, 0.04);
    }

    .metric-item {
        padding: 10px 14px;
        background: rgba(13, 17, 23, 0.8);
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .metric-label {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.45);
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.3px;
    }

    .metric-value-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    .metric-value {
        font-size: 15px;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.95);
        font-variant-numeric: tabular-nums;
    }

    .metric-change {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 11px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        color: rgba(255, 255, 255, 0.5);
        background: rgba(255, 255, 255, 0.05);
    }

    .metric-change.up {
        color: #00d4aa;
        background: rgba(0, 212, 170, 0.1);
    }

    .metric-change.down {
        color: #ff6b6b;
        background: rgba(255, 107, 107, 0.1);
    }
</style>
