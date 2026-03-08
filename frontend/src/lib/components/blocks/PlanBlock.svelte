<script lang="ts">
    import type { PlanBlock as PlanBlockType, PlanStepStatus } from "$lib/types/contentBlock";
    import { Loader2, CheckCircle2, XCircle, Circle, ChevronDown, ChevronUp, ListTodo, MinusCircle } from "lucide-svelte";

    let { plan }: { plan: PlanBlockType } = $props();
    let collapsed = $state(false);

    const completedCount = $derived(plan.steps.filter(s => s.status === 'complete').length);
    const totalCount = $derived(plan.steps.length);
    const progressPct = $derived(totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0);
    const isComplete = $derived(plan.status === 'complete' || plan.status === 'error');

    // Auto-collapse after completion
    $effect(() => {
        if (isComplete) {
            const timer = setTimeout(() => { collapsed = true; }, 2500);
            return () => clearTimeout(timer);
        }
    });

    function getElapsed(step: { startedAt?: number; completedAt?: number; status: PlanStepStatus }): string {
        if (!step.startedAt) return "";
        const end = step.completedAt || Date.now();
        const elapsed = Math.floor((end - step.startedAt) / 1000);
        if (elapsed < 1) return "";
        return `${elapsed}s`;
    }

    // Force re-render every second for elapsed time
    let _tick = $state(0);
    $effect(() => {
        const hasRunning = plan.steps.some(s => s.status === "running");
        if (!hasRunning) return;
        const interval = setInterval(() => { _tick++; }, 1000);
        return () => clearInterval(interval);
    });
</script>

<div class="plan-block" class:complete={isComplete}>
    <!-- Header -->
    <button class="plan-header" onclick={() => collapsed = !collapsed}>
        <div class="plan-title-row">
            <div class="plan-icon">
                <ListTodo size={16} />
            </div>
            <span class="plan-title">{plan.title}</span>
            <span class="plan-badge" class:done={isComplete}>
                {completedCount}/{totalCount}
            </span>
        </div>
        <div class="plan-chevron">
            {#if collapsed}
                <ChevronDown size={16} />
            {:else}
                <ChevronUp size={16} />
            {/if}
        </div>
    </button>

    <!-- Progress bar -->
    <div class="progress-track">
        <div
            class="progress-fill"
            class:error={plan.status === 'error'}
            style="width: {progressPct}%"
        ></div>
    </div>

    <!-- Steps list -->
    {#if !collapsed}
        <div class="plan-steps">
            {#each plan.steps as step, i}
                <div class="step-item" class:running={step.status === 'running'} class:dimmed={step.status === 'pending' || step.status === 'skipped'}>
                    <div class="step-number">{i + 1}</div>
                    <div class="step-icon">
                        {#if step.status === 'running'}
                            <Loader2 size={14} class="spinning" />
                        {:else if step.status === 'complete'}
                            <CheckCircle2 size={14} class="done-icon" />
                        {:else if step.status === 'error'}
                            <XCircle size={14} class="error-icon" />
                        {:else if step.status === 'skipped'}
                            <MinusCircle size={14} class="skipped-icon" />
                        {:else}
                            <Circle size={14} class="pending-icon" />
                        {/if}
                    </div>
                    <div class="step-content">
                        <span class="step-title">{step.title}</span>
                        {#if step.result && step.status !== 'running'}
                            <span class="step-result">{step.result}</span>
                        {/if}
                    </div>
                    {#if step.status === 'running'}
                        <span class="step-elapsed">{_tick >= 0 ? getElapsed(step) : ''}</span>
                    {:else if step.status === 'complete' && step.startedAt && step.completedAt}
                        <span class="step-elapsed done">{getElapsed(step)}</span>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .plan-block {
        background: rgba(255, 255, 255, 0.04);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        overflow: hidden;
        transition: all 0.3s ease;
        margin: 8px 0;
    }

    .plan-block.complete {
        border-color: rgba(0, 212, 170, 0.15);
    }

    .plan-header {
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

    .plan-header:hover {
        background: rgba(255, 255, 255, 0.03);
    }

    .plan-title-row {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .plan-icon {
        color: #00d4aa;
        display: flex;
        align-items: center;
    }

    .plan-title {
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.01em;
    }

    .plan-badge {
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.5);
        font-variant-numeric: tabular-nums;
    }

    .plan-badge.done {
        background: rgba(0, 212, 170, 0.15);
        color: #00d4aa;
    }

    .plan-chevron {
        color: rgba(255, 255, 255, 0.3);
        display: flex;
        align-items: center;
    }

    .progress-track {
        height: 2px;
        background: rgba(255, 255, 255, 0.06);
    }

    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #00d4aa, #00b894);
        transition: width 0.5s ease;
        border-radius: 1px;
    }

    .progress-fill.error {
        background: linear-gradient(90deg, #ff6b6b, #ee5a24);
    }

    .plan-steps {
        padding: 6px 14px 12px;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .step-item {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 6px 0;
        transition: all 0.2s ease;
    }

    .step-item.dimmed {
        opacity: 0.4;
    }

    .step-item.running {
        opacity: 1;
    }

    .step-number {
        font-size: 10px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.25);
        min-width: 14px;
        text-align: right;
        padding-top: 1px;
        font-variant-numeric: tabular-nums;
    }

    .step-icon {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        padding-top: 1px;
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

    :global(.skipped-icon) {
        color: rgba(255, 255, 255, 0.2);
    }

    :global(.pending-icon) {
        color: rgba(255, 255, 255, 0.15);
    }

    .step-content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .step-title {
        font-size: 12px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.75);
        line-height: 1.3;
    }

    .step-item.running .step-title {
        color: rgba(255, 255, 255, 0.95);
    }

    .step-result {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.35);
        line-height: 1.3;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .step-elapsed {
        flex-shrink: 0;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.3);
        font-variant-numeric: tabular-nums;
        padding-top: 1px;
    }

    .step-elapsed.done {
        color: rgba(255, 255, 255, 0.2);
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
</style>
