<script lang="ts">
    import type { ToolCallStatus } from "$lib/types/contentBlock";
    import { Loader2, CheckCircle2, XCircle } from "lucide-svelte";

    let { tools }: { tools: ToolCallStatus[] } = $props();

    const toolLabels: Record<string, string> = {
        get_market_data: "Fetching market data",
        get_crypto_chart: "Loading chart data",
        get_technical_analysis: "Calculating indicators",
        get_fear_greed_index: "Checking market sentiment",
        search_crypto_news: "Searching latest news",
        get_token_info: "Loading token info",
        get_funding_rate: "Fetching funding rates",
        get_order_book: "Loading order book",
        get_liquidation_data: "Fetching liquidation data",
        get_economic_calendar: "Loading economic events",
        get_onchain_data: "Fetching on-chain data",
        calculate_position_size: "Calculating position size",
        screener: "Screening markets",
        set_price_alert: "Setting price alert",
    };

    function getLabel(name: string): string {
        return toolLabels[name] || `Running ${name}`;
    }

    function getElapsed(startedAt: number): string {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        if (elapsed < 1) return "";
        return `${elapsed}s`;
    }

    // Force re-render every second for elapsed time
    let _tick = $state(0);
    $effect(() => {
        const hasRunning = tools.some((t) => t.status === "running");
        if (!hasRunning) return;
        const interval = setInterval(() => {
            _tick++;
        }, 1000);
        return () => clearInterval(interval);
    });
</script>

<div class="tool-progress">
    {#each tools as tool}
        <div class="tool-item" class:running={tool.status === "running"}>
            <div class="tool-icon">
                {#if tool.status === "running"}
                    <Loader2 size={14} class="spinning" />
                {:else if tool.status === "complete"}
                    <CheckCircle2 size={14} class="done-icon" />
                {:else}
                    <XCircle size={14} class="error-icon" />
                {/if}
            </div>
            <span class="tool-label">{getLabel(tool.name)}</span>
            {#if tool.status === "running"}
                <span class="tool-elapsed">{_tick >= 0 ? getElapsed(tool.startedAt) : ''}</span>
            {/if}
        </div>
    {/each}
</div>

<style>
    .tool-progress {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px 0;
    }

    .tool-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
        transition: opacity 0.3s;
    }

    .tool-item.running {
        color: rgba(255, 255, 255, 0.8);
    }

    .tool-icon {
        flex-shrink: 0;
        display: flex;
        align-items: center;
    }

    :global(.spinning) {
        animation: spin 1s linear infinite;
        color: #f59e0b;
    }

    :global(.done-icon) {
        color: #00d4aa;
    }

    :global(.error-icon) {
        color: #ff6b6b;
    }

    .tool-label {
        font-weight: 500;
    }

    .tool-elapsed {
        margin-left: auto;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.3);
        font-variant-numeric: tabular-nums;
    }

    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }
</style>
