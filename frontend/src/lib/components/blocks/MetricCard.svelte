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
                                <TrendingUp size={11} />
                            {:else if metric.direction === "down"}
                                <TrendingDown size={11} />
                            {:else}
                                <Minus size={11} />
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
        background: rgba(10, 12, 18, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.07);
        backdrop-filter: blur(12px);
    }

    .metric-header {
        padding: 10px 14px 10px 17px;
        background: rgba(245, 158, 11, 0.04);
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        border-left: 3px solid rgba(245, 158, 11, 0.45);
    }

    .metric-title {
        font-size: 12px;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.85);
        letter-spacing: 0.01em;
    }

    .metric-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 1px;
        background: rgba(255, 255, 255, 0.03);
    }

    .metric-item {
        padding: 10px 14px;
        background: rgba(10, 12, 18, 0.85);
        display: flex;
        flex-direction: column;
        gap: 4px;
        transition: background 0.15s ease;
    }

    .metric-item:hover {
        background: rgba(20, 24, 36, 0.9);
    }

    .metric-label {
        font-size: 10.5px;
        color: rgba(255, 255, 255, 0.35);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .metric-value-row {
        display: flex;
        align-items: center;
        gap: 7px;
        flex-wrap: wrap;
    }

    .metric-value {
        font-size: 15px;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.92);
        font-variant-numeric: tabular-nums;
    }

    .metric-change {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 10.5px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        color: rgba(255, 255, 255, 0.4);
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.08);
        font-variant-numeric: tabular-nums;
    }

    .metric-change.up {
        color: #00d4aa;
        background: rgba(0, 212, 170, 0.08);
        border-color: rgba(0, 212, 170, 0.2);
    }

    .metric-change.down {
        color: #ff6b6b;
        background: rgba(255, 107, 107, 0.08);
        border-color: rgba(255, 107, 107, 0.2);
    }
</style>
