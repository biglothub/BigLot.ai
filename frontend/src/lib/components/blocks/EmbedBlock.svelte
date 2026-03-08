<script lang="ts">
    let {
        url,
        height = 450,
        title,
    }: {
        url: string;
        height?: number;
        title?: string;
    } = $props();
</script>

<div class="embed-block">
    {#if title}
        <div class="embed-header">
            <span class="embed-title">{title}</span>
        </div>
    {/if}
    <div class="embed-wrapper" style="height: {height}px">
        <iframe
            src={url}
            {title}
            frameborder="0"
            allowfullscreen
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups"
        ></iframe>
    </div>
</div>

<style>
    .embed-block {
        border-radius: 12px;
        overflow: hidden;
        background: rgba(13, 17, 23, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .embed-header {
        padding: 10px 14px;
        background: rgba(255, 255, 255, 0.03);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .embed-title {
        font-size: 13px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.9);
    }

    .embed-wrapper {
        width: 100%;
        position: relative;
    }

    iframe {
        width: 100%;
        height: 100%;
        border: none;
    }
</style>
