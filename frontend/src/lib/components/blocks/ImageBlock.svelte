<script lang="ts">
    let {
        url,
        alt,
        caption,
    }: {
        url: string;
        alt?: string;
        caption?: string;
    } = $props();
</script>

<div class="image-block">
    <div class="image-wrapper">
        <img src={url} alt={alt || "Image"} loading="lazy" />
    </div>
    {#if caption}
        <div class="image-caption">{caption}</div>
    {/if}
</div>

<style>
    .image-block {
        border-radius: 12px;
        overflow: hidden;
        background: rgba(13, 17, 23, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .image-wrapper {
        position: relative;
        max-height: 500px;
        overflow: hidden;
    }

    img {
        width: 100%;
        height: auto;
        max-height: 500px;
        object-fit: contain;
        display: block;
    }

    .image-caption {
        padding: 8px 14px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
        background: rgba(255, 255, 255, 0.02);
        border-top: 1px solid rgba(255, 255, 255, 0.06);
    }
</style>
