<script lang="ts">
    import type { ResearchReportBlock as ResearchReportBlockType } from "$lib/types/contentBlock";
    import Markdown from "../Markdown.svelte";
    import { ChevronDown, ChevronUp, FileText, Clock, Wrench } from "lucide-svelte";

    let { report }: { report: ResearchReportBlockType } = $props();
    let collapsed = $state(false);

    const isComplete = $derived(report.status === 'complete' || report.status === 'error');
    const durationLabel = $derived(() => {
        const ms = report.totalDurationMs;
        if (ms < 1000) return '<1s';
        const s = Math.floor(ms / 1000);
        return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
    });

    // Auto-collapse after completion
    $effect(() => {
        if (isComplete) {
            const timer = setTimeout(() => { collapsed = true; }, 5000);
            return () => clearTimeout(timer);
        }
    });
</script>

<div class="report-block" class:complete={isComplete} class:error={report.status === 'error'}>
    <!-- Header -->
    <button class="report-header" onclick={() => collapsed = !collapsed}>
        <div class="report-title-row">
            <div class="report-icon">
                <FileText size={16} />
            </div>
            <span class="report-title">{report.title}</span>
            {#if isComplete}
                <span class="report-badge done">
                    {report.sections.length} sections
                </span>
            {:else}
                <span class="report-badge active">
                    {report.status === 'researching' ? 'Researching...' : 'Synthesizing...'}
                </span>
            {/if}
        </div>
        <div class="report-chevron">
            {#if collapsed}
                <ChevronDown size={16} />
            {:else}
                <ChevronUp size={16} />
            {/if}
        </div>
    </button>

    <!-- Meta bar -->
    {#if isComplete}
        <div class="report-meta">
            <span class="meta-item">
                <Clock size={12} />
                {durationLabel()}
            </span>
            <span class="meta-item">
                <Wrench size={12} />
                {report.toolCallCount} tools used
            </span>
        </div>
    {/if}

    <!-- Sections -->
    {#if !collapsed && report.sections.length > 0}
        <div class="report-sections">
            {#each report.sections as section, i}
                <div class="section-item">
                    <div class="section-number">{i + 1}</div>
                    <div class="section-content">
                        <div class="section-title">{section.title}</div>
                        <div class="section-body">
                            <Markdown content={section.content} />
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    {/if}

    <!-- Status indicator for in-progress -->
    {#if !isComplete}
        <div class="report-loading">
            <div class="pulse-dot"></div>
            <span>Deep research in progress...</span>
        </div>
    {/if}
</div>

<style>
    .report-block {
        background: rgba(255, 255, 255, 0.04);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(99, 102, 241, 0.2);
        border-radius: 12px;
        overflow: hidden;
        transition: all 0.3s ease;
        margin: 8px 0;
    }

    .report-block.complete {
        border-color: rgba(99, 102, 241, 0.3);
    }

    .report-block.error {
        border-color: rgba(255, 107, 107, 0.3);
    }

    .report-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 12px 14px;
        background: none;
        border: none;
        cursor: pointer;
        color: rgba(255, 255, 255, 0.9);
        transition: background 0.15s;
    }

    .report-header:hover {
        background: rgba(255, 255, 255, 0.03);
    }

    .report-title-row {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .report-icon {
        color: #818cf8;
        display: flex;
        align-items: center;
    }

    .report-title {
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.01em;
    }

    .report-badge {
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 10px;
        font-variant-numeric: tabular-nums;
    }

    .report-badge.done {
        background: rgba(99, 102, 241, 0.15);
        color: #818cf8;
    }

    .report-badge.active {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
        animation: badge-pulse 2s ease-in-out infinite;
    }

    .report-chevron {
        color: rgba(255, 255, 255, 0.3);
        display: flex;
        align-items: center;
    }

    .report-meta {
        display: flex;
        gap: 16px;
        padding: 0 14px 8px;
    }

    .meta-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.35);
    }

    .report-sections {
        padding: 4px 14px 14px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .section-item {
        display: flex;
        gap: 10px;
    }

    .section-number {
        font-size: 10px;
        font-weight: 700;
        color: rgba(99, 102, 241, 0.5);
        min-width: 16px;
        text-align: right;
        padding-top: 2px;
        font-variant-numeric: tabular-nums;
    }

    .section-content {
        flex: 1;
        min-width: 0;
    }

    .section-title {
        font-size: 12px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.85);
        margin-bottom: 4px;
    }

    .section-body {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        line-height: 1.5;
    }

    .section-body :global(p) {
        margin: 0 0 6px;
    }

    .section-body :global(ol),
    .section-body :global(ul) {
        margin: 0 0 6px;
        padding-left: 16px;
    }

    .report-loading {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.4);
    }

    .pulse-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #818cf8;
        animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 0.4; transform: scale(0.8); }
        50% { opacity: 1; transform: scale(1); }
    }

    @keyframes badge-pulse {
        0%, 100% { opacity: 0.7; }
        50% { opacity: 1; }
    }
</style>
