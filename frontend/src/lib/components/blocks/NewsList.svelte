<script lang="ts">
    import { ExternalLink } from "lucide-svelte";

    let {
        items,
    }: {
        items: {
            title: string;
            url: string;
            source: string;
            publishedAt: string;
            sentiment?: "bullish" | "bearish" | "neutral";
        }[];
    } = $props();

    function timeAgo(dateStr: string): string {
        const now = Date.now();
        const then = new Date(dateStr).getTime();
        const diff = Math.floor((now - then) / 1000);
        if (diff < 60) return "just now";
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }
</script>

<div class="news-block">
    <div class="news-header">
        <span class="news-title">Latest News</span>
    </div>
    <div class="news-list">
        {#each items as item}
            <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                class="news-item"
            >
                <div class="news-content">
                    <span class="news-item-title">{item.title}</span>
                    <div class="news-meta">
                        <span class="news-source">{item.source}</span>
                        <span class="news-dot"></span>
                        <span class="news-time">{timeAgo(item.publishedAt)}</span>
                        {#if item.sentiment && item.sentiment !== "neutral"}
                            <span
                                class="news-sentiment"
                                class:bullish={item.sentiment === "bullish"}
                                class:bearish={item.sentiment === "bearish"}
                            >
                                {item.sentiment}
                            </span>
                        {/if}
                    </div>
                </div>
                <ExternalLink size={14} class="news-link-icon" />
            </a>
        {/each}
    </div>
</div>

<style>
    .news-block {
        border-radius: 12px;
        overflow: hidden;
        background: rgba(13, 17, 23, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(12px);
    }

    .news-header {
        padding: 10px 14px;
        background: rgba(255, 255, 255, 0.03);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .news-title {
        font-size: 13px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.9);
    }

    .news-list {
        display: flex;
        flex-direction: column;
    }

    .news-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        text-decoration: none;
        color: inherit;
        transition: background 0.15s;
    }

    .news-item:last-child {
        border-bottom: none;
    }

    .news-item:hover {
        background: rgba(255, 255, 255, 0.03);
    }

    .news-content {
        flex: 1;
        min-width: 0;
    }

    .news-item-title {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.85);
        line-height: 1.4;
        line-clamp: 2;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .news-meta {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 4px;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.35);
    }

    .news-dot {
        width: 3px;
        height: 3px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
    }

    .news-source {
        font-weight: 500;
    }

    .news-sentiment {
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.3px;
    }

    .news-sentiment.bullish {
        color: #00d4aa;
        background: rgba(0, 212, 170, 0.1);
    }

    .news-sentiment.bearish {
        color: #ff6b6b;
        background: rgba(255, 107, 107, 0.1);
    }

    :global(.news-link-icon) {
        flex-shrink: 0;
        color: rgba(255, 255, 255, 0.2);
    }
</style>
