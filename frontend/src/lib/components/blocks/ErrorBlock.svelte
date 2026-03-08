<script lang="ts">
    import { AlertTriangle } from "lucide-svelte";

    let {
        message,
        tool,
    }: {
        message: string;
        tool?: string;
    } = $props();
</script>

<div class="error-block">
    <AlertTriangle size={16} class="error-icon" />
    <div class="error-content">
        {#if tool}
            <span class="error-tool">{tool}</span>
        {/if}
        <span class="error-message">{message}</span>
    </div>
</div>

<style>
    .error-block {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 14px;
        border-radius: 10px;
        background: rgba(255, 107, 107, 0.06);
        border: 1px solid rgba(255, 107, 107, 0.15);
    }

    :global(.error-icon) {
        flex-shrink: 0;
        color: #ff6b6b;
        margin-top: 1px;
    }

    .error-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .error-tool {
        font-size: 11px;
        font-weight: 600;
        color: rgba(255, 107, 107, 0.7);
        text-transform: uppercase;
        letter-spacing: 0.3px;
    }

    .error-message {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.7);
        line-height: 1.4;
    }
</style>
