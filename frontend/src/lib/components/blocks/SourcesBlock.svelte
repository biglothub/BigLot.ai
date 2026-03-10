<script lang="ts">
    import { Database, ChevronDown, ExternalLink } from "lucide-svelte";

    let {
        sources,
    }: {
        sources: { name: string; url?: string; accessedAt: number }[];
    } = $props();

    let expanded = $state(false);

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
</script>

<div class="sources-block">
    <button class="sources-toggle" onclick={() => (expanded = !expanded)}>
        <Database size={13} class="sources-icon" />
        <span class="sources-label">
            {sources.length} data source{sources.length !== 1 ? "s" : ""}
        </span>
        <ChevronDown
            size={12}
            class="sources-chevron {expanded ? 'rotated' : ''}"
        />
    </button>
    {#if expanded}
        <ul class="sources-list">
            {#each sources as source}
                <li class="source-item">
                    <span class="source-name">{source.name}</span>
                    {#if source.url}
                        <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="source-link"
                        >
                            <ExternalLink size={10} />
                        </a>
                    {/if}
                    <span class="source-time">{formatTime(source.accessedAt)}</span>
                </li>
            {/each}
        </ul>
    {/if}
</div>

<style>
    .sources-block {
        margin-top: 8px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        overflow: hidden;
    }

    .sources-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        padding: 8px 12px;
        background: none;
        border: none;
        cursor: pointer;
        color: rgba(255, 255, 255, 0.4);
        font-size: 11px;
        font-family: inherit;
        transition: color 0.15s;
    }

    .sources-toggle:hover {
        color: rgba(255, 255, 255, 0.6);
    }

    :global(.sources-icon) {
        flex-shrink: 0;
        opacity: 0.6;
    }

    .sources-label {
        flex: 1;
        text-align: left;
        letter-spacing: 0.2px;
    }

    :global(.sources-chevron) {
        flex-shrink: 0;
        transition: transform 0.2s ease;
    }

    :global(.sources-chevron.rotated) {
        transform: rotate(180deg);
    }

    .sources-list {
        list-style: none;
        margin: 0;
        padding: 0 12px 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .source-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.5);
        padding: 3px 0;
    }

    .source-name {
        font-weight: 500;
        color: rgba(255, 255, 255, 0.6);
    }

    .source-link {
        color: rgba(255, 255, 255, 0.3);
        display: inline-flex;
        align-items: center;
        transition: color 0.15s;
    }

    .source-link:hover {
        color: rgba(255, 255, 255, 0.7);
    }

    .source-time {
        margin-left: auto;
        font-size: 10px;
        color: rgba(255, 255, 255, 0.3);
        font-variant-numeric: tabular-nums;
    }
</style>
