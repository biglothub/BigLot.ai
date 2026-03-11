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
                    <div class="popover-name">{source.name}</div>
                    <div class="popover-time">{formatTime(source.accessedAt)}</div>
                    {#if source.url}
                        <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="popover-link"
                        >
                            {source.url.replace(/^https?:\/\//, "")}
                            <ExternalLink size={10} />
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
        gap: 4px;
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
        width: 20px;
        height: 20px;
        border-radius: 50%;
        font-size: 11px;
        font-weight: 600;
        font-family: inherit;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.5);
        cursor: pointer;
        transition: all 0.15s ease;
        line-height: 1;
        padding: 0;
    }

    .source-pill:hover {
        background: rgba(255, 255, 255, 0.12);
        color: rgba(255, 255, 255, 0.8);
        border-color: rgba(255, 255, 255, 0.25);
    }

    .source-popover {
        position: absolute;
        bottom: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%);
        background: hsl(var(--card));
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        padding: 10px 14px;
        min-width: 200px;
        max-width: 280px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        z-index: 50;
        display: flex;
        flex-direction: column;
        gap: 4px;
        animation: popover-in 0.12s ease-out;
    }

    .source-popover::after {
        content: "";
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 5px solid transparent;
        border-top-color: rgba(255, 255, 255, 0.12);
    }

    @keyframes popover-in {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(4px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }

    .popover-name {
        font-size: 12px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.85);
    }

    .popover-time {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.4);
        font-variant-numeric: tabular-nums;
    }

    .popover-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: hsl(var(--primary));
        text-decoration: none;
        margin-top: 2px;
        transition: opacity 0.15s;
    }

    .popover-link:hover {
        opacity: 0.8;
    }
</style>
