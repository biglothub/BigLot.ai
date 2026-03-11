<script lang="ts">
    import { ExternalLink } from "lucide-svelte";

    let {
        sources,
    }: {
        sources: { name: string; url?: string; accessedAt: number }[];
    } = $props();

    let activePopover = $state<number | null>(null);

    function formatTime(ts: number): string {
        const d = new Date(ts);
        return d.toLocaleString("en-US", {
            timeZone: "Asia/Bangkok",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }) + " ICT";
    }

    function togglePopover(idx: number) {
        activePopover = activePopover === idx ? null : idx;
    }
</script>

<div class="sources-inline">
    {#each sources as source, idx}
        <span class="source-pill-wrapper">
            <button
                type="button"
                class="source-pill"
                class:active={activePopover === idx}
                onclick={() => togglePopover(idx)}
                title={source.name}
                aria-label={`Show source ${idx + 1}: ${source.name}`}
                aria-expanded={activePopover === idx}
                aria-haspopup="dialog"
            >
                {idx + 1}
            </button>
            {#if activePopover === idx}
                <div class="source-popover" role="dialog" aria-label={`Source details for ${source.name}`}>
                    <div class="popover-index">Source {idx + 1}</div>
                    <div class="popover-name">{source.name}</div>
                    <div class="popover-time">{formatTime(source.accessedAt)}</div>
                    {#if source.url}
                        <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="popover-link"
                        >
                            <span class="popover-url">{source.url.replace(/^https?:\/\//, "")}</span>
                            <ExternalLink size={9} />
                        </a>
                    {/if}
                </div>
            {/if}
        </span>
    {/each}
</div>

<style>
    .sources-inline {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        flex-wrap: wrap;
        margin-top: 6px;
    }

    .source-pill-wrapper {
        position: relative;
        display: inline-flex;
    }

    .source-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 700;
        font-family: inherit;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.45);
        cursor: pointer;
        transition: all 0.15s ease;
        line-height: 1;
        padding: 0;
        letter-spacing: -0.02em;
    }

    .source-pill:hover {
        background: rgba(245, 158, 11, 0.12);
        color: #f59e0b;
        border-color: rgba(245, 158, 11, 0.3);
        box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.1);
    }

    .source-pill.active {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
        border-color: rgba(245, 158, 11, 0.4);
        box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.15);
    }

    .source-popover {
        position: absolute;
        bottom: calc(100% + 10px);
        left: 50%;
        transform: translateX(-50%);
        background: rgba(10, 12, 18, 0.9);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(245, 158, 11, 0.2);
        border-radius: 10px;
        padding: 12px 14px;
        min-width: 220px;
        max-width: 290px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(245, 158, 11, 0.08);
        z-index: 50;
        display: flex;
        flex-direction: column;
        gap: 5px;
        animation: popover-in 0.1s ease-out;
    }

    .source-popover::after {
        content: "";
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 5px solid transparent;
        border-top-color: rgba(245, 158, 11, 0.25);
    }

    @keyframes popover-in {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(5px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }

    .popover-index {
        font-size: 9.5px;
        font-weight: 600;
        color: #f59e0b;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        opacity: 0.7;
    }

    .popover-name {
        font-size: 12.5px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.92);
        line-height: 1.35;
    }

    .popover-time {
        font-size: 10.5px;
        color: rgba(255, 255, 255, 0.35);
        font-variant-numeric: tabular-nums;
    }

    .popover-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-top: 3px;
        padding: 4px 8px;
        border-radius: 5px;
        background: rgba(245, 158, 11, 0.08);
        border: 1px solid rgba(245, 158, 11, 0.15);
        text-decoration: none;
        transition: all 0.15s ease;
    }

    .popover-link:hover {
        background: rgba(245, 158, 11, 0.15);
        border-color: rgba(245, 158, 11, 0.3);
    }

    .popover-url {
        font-size: 11px;
        color: #f59e0b;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 200px;
    }
</style>
