<script lang="ts">
    import type { ToolCallStatus } from "$lib/types/contentBlock";

    let { tools }: { tools: ToolCallStatus[] } = $props();

    const toolLabels: Record<string, string> = {
        get_market_data: "Fetching market data",
        get_crypto_chart: "Loading chart data",
        get_technical_analysis: "Calculating indicators",
        get_fear_greed_index: "Checking market sentiment",
        get_gold_price: "Fetching gold price",
        get_gold_chart: "Loading gold chart",
        get_macro_indicators: "Fetching macro indicators",
        get_cot_data: "Fetching COT data",
        get_cross_asset_correlation: "Analyzing cross-asset correlation",
        web_search: "Searching the web",
        save_memory: "Saving to memory",
        recall_memory: "Recalling memory",
        delete_memory: "Deleting memory",
        handoff_to_agent: "Switching specialist",
        create_plan: "Creating plan",
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

    function getLabel(name: string, status: string): string {
        const base = toolLabels[name] || name.replace(/_/g, ' ');
        if (status === 'complete') {
            if (base.startsWith('Fetching')) return base.replace('Fetching', 'Fetched');
            if (base.startsWith('Loading')) return base.replace('Loading', 'Loaded');
            if (base.startsWith('Searching')) return base.replace('Searching', 'Searched');
            if (base.startsWith('Calculating')) return base.replace('Calculating', 'Calculated');
            if (base.startsWith('Checking')) return base.replace('Checking', 'Checked');
            if (base.startsWith('Analyzing')) return base.replace('Analyzing', 'Analyzed');
            if (base.startsWith('Creating')) return base.replace('Creating', 'Created');
            if (base.startsWith('Saving')) return base.replace('Saving', 'Saved');
            if (base.startsWith('Recalling')) return base.replace('Recalling', 'Recalled');
            if (base.startsWith('Deleting')) return base.replace('Deleting', 'Deleted');
            if (base.startsWith('Switching')) return base.replace('Switching', 'Switched');
            if (base.startsWith('Setting')) return base.replace('Setting', 'Set');
            if (base.startsWith('Screening')) return base.replace('Screening', 'Screened');
        }
        return base;
    }

    function getElapsed(tool: ToolCallStatus): string {
        if (tool.status === 'complete' && tool.latencyMs != null) {
            return tool.latencyMs < 1000
                ? `${tool.latencyMs}ms`
                : `${(tool.latencyMs / 1000).toFixed(1)}s`;
        }
        if (tool.status === 'running') {
            const elapsed = Math.floor((Date.now() - tool.startedAt) / 1000);
            if (elapsed < 1) return "";
            return `${elapsed}s`;
        }
        return "";
    }

    let _tick = $state(0);
    $effect(() => {
        const hasRunning = tools.some((t) => t.status === "running");
        if (!hasRunning) return;
        const interval = setInterval(() => { _tick++; }, 1000);
        return () => clearInterval(interval);
    });
</script>

<div class="tool-progress">
    {#each tools as tool}
        <div
            class="tool-item"
            class:running={tool.status === "running"}
            class:complete={tool.status === "complete"}
            class:error={tool.status === "error"}
        >
            <div class="tool-status">
                {#if tool.status === "running"}
                    <span class="dot-pulse">
                        <span></span><span></span><span></span>
                    </span>
                {:else if tool.status === "complete"}
                    <span class="status-mark done">✓</span>
                {:else}
                    <span class="status-mark err">✕</span>
                {/if}
            </div>
            <span class="tool-label">{getLabel(tool.name, tool.status)}</span>
            <span class="tool-elapsed">{_tick >= 0 ? getElapsed(tool) : ''}</span>
        </div>
    {/each}
</div>

<style>
    .tool-progress {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 4px 0;
    }

    .tool-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11.5px;
        color: rgba(255, 255, 255, 0.35);
        transition: color 0.3s ease;
        padding: 3px 8px 3px 10px;
        border-radius: 4px;
        border-left: 2px solid transparent;
        position: relative;
    }

    .tool-item.running {
        color: rgba(255, 255, 255, 0.75);
        border-left-color: #f59e0b;
        background: rgba(245, 158, 11, 0.04);
        animation: item-shimmer 2s ease-in-out infinite;
    }

    .tool-item.complete {
        color: rgba(255, 255, 255, 0.42);
        border-left-color: rgba(0, 212, 170, 0.5);
    }

    .tool-item.error {
        color: rgba(255, 100, 100, 0.65);
        border-left-color: rgba(255, 107, 107, 0.5);
    }

    /* Dot pulse loader */
    .dot-pulse {
        display: inline-flex;
        align-items: center;
        gap: 3px;
    }
    .dot-pulse span {
        display: block;
        width: 3px;
        height: 3px;
        border-radius: 50%;
        background: #f59e0b;
        animation: dot-bounce 1.2s ease-in-out infinite;
    }
    .dot-pulse span:nth-child(2) { animation-delay: 0.2s; }
    .dot-pulse span:nth-child(3) { animation-delay: 0.4s; }

    .status-mark {
        font-size: 10px;
        font-weight: 700;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 14px;
        height: 14px;
        border-radius: 3px;
        flex-shrink: 0;
    }
    .status-mark.done {
        color: #00d4aa;
        background: rgba(0, 212, 170, 0.1);
    }
    .status-mark.err {
        color: #ff6b6b;
        background: rgba(255, 107, 107, 0.1);
    }

    .tool-status {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        width: 18px;
    }

    .tool-label {
        font-weight: 500;
        letter-spacing: 0.01em;
    }

    .tool-elapsed {
        margin-left: auto;
        font-size: 10.5px;
        color: rgba(255, 255, 255, 0.25);
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.02em;
    }

    @keyframes dot-bounce {
        0%, 80%, 100% { transform: scale(0.5); opacity: 0.3; }
        40% { transform: scale(1); opacity: 1; }
    }

    @keyframes item-shimmer {
        0%, 100% { background: rgba(245, 158, 11, 0.03); }
        50% { background: rgba(245, 158, 11, 0.07); }
    }
</style>
