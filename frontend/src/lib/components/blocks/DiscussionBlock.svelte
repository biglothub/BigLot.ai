<script lang="ts">
    import type { DiscussionBlock as DiscussionBlockType, DiscussionPanelistId } from "$lib/types/contentBlock";
    import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Copy, Check } from "lucide-svelte";
    import Markdown from "../Markdown.svelte";

    let { discussion }: { discussion: DiscussionBlockType } = $props();

    let collapsedTurns = $state(new Set<number>());
    let copied = $state(false);

    const colorMap: Record<DiscussionPanelistId, { border: string; bg: string; text: string; badge: string }> = {
        bull: {
            border: 'border-green-500/40',
            bg: 'bg-green-500/5',
            text: 'text-green-400',
            badge: 'bg-green-500/20 text-green-300'
        },
        bear: {
            border: 'border-red-500/40',
            bg: 'bg-red-500/5',
            text: 'text-red-400',
            badge: 'bg-red-500/20 text-red-300'
        },
        moderator: {
            border: 'border-amber-500/40',
            bg: 'bg-amber-500/5',
            text: 'text-amber-400',
            badge: 'bg-amber-500/20 text-amber-300'
        }
    };

    function getRoundLabel(round: number, panelistId: DiscussionPanelistId): string {
        if (round === 0) return 'Introduction';
        if (round === 99) return 'Final Ruling';
        if (round === 2) return `Round ${round} — Rebuttal`;
        return `Round ${round}`;
    }

    function getPanelist(id: DiscussionPanelistId) {
        return discussion.panelists.find(p => p.id === id);
    }

    function toggleTurn(index: number) {
        const next = new Set(collapsedTurns);
        if (next.has(index)) {
            next.delete(index);
        } else {
            next.add(index);
        }
        collapsedTurns = next;
    }

    function collapseAll() {
        collapsedTurns = new Set(discussion.turns.map((_, i) => i));
    }

    function expandAll() {
        collapsedTurns = new Set();
    }

    async function exportAsMarkdown() {
        const lines = [`# AI Discussion: ${discussion.topic}\n`];
        for (const turn of discussion.turns) {
            const p = getPanelist(turn.panelistId);
            const label = getRoundLabel(turn.round, turn.panelistId);
            lines.push(`## ${p?.emoji} ${p?.name} (${turn.model}) — ${label}\n`);
            lines.push(turn.content + '\n');
        }
        await navigator.clipboard.writeText(lines.join('\n'));
        copied = true;
        setTimeout(() => copied = false, 2000);
    }

    function getPreview(content: string): string {
        const firstLine = content.split('\n').find(l => l.trim()) ?? '';
        return firstLine.length > 100 ? firstLine.slice(0, 100) + '...' : firstLine;
    }
</script>

<div class="w-full space-y-1">
    <!-- Header -->
    <div class="flex items-center gap-2 mb-4 px-1">
        <span class="text-lg">&#x1F4AC;</span>
        <h3 class="text-sm font-semibold text-foreground/80">AI Discussion</h3>
        <span class="text-xs text-muted-foreground">— {discussion.topic.length > 60 ? discussion.topic.slice(0, 60) + '...' : discussion.topic}</span>
        {#if discussion.status === 'running'}
            <span class="ml-auto flex items-center gap-1.5 text-xs text-amber-400">
                <span class="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></span>
                Live
            </span>
        {:else if discussion.turns.length > 1}
            <div class="ml-auto flex items-center gap-1">
                <button
                    onclick={exportAsMarkdown}
                    class="p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors rounded"
                    title={copied ? 'Copied!' : 'Copy as Markdown'}
                >
                    {#if copied}
                        <Check size={14} class="text-green-400" />
                    {:else}
                        <Copy size={14} />
                    {/if}
                </button>
                <button
                    onclick={collapseAll}
                    class="p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors rounded"
                    title="Collapse All"
                >
                    <ChevronsDownUp size={14} />
                </button>
                <button
                    onclick={expandAll}
                    class="p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors rounded"
                    title="Expand All"
                >
                    <ChevronsUpDown size={14} />
                </button>
            </div>
        {/if}
    </div>

    <!-- Turns -->
    {#each discussion.turns as turn, i}
        {@const panelist = getPanelist(turn.panelistId)}
        {@const colors = colorMap[turn.panelistId]}
        {@const isStreaming = !turn.completedAt && discussion.status === 'running'}
        {@const isSynthesis = turn.round === 99}
        {@const isCollapsed = collapsedTurns.has(i) && !isStreaming}

        <div class="relative pl-4 border-l-2 {colors.border} {isSynthesis ? 'mt-4' : ''}">
            <div class="{colors.bg} rounded-lg p-3 {isSynthesis ? 'ring-1 ring-amber-500/20' : ''}">
                <!-- Turn Header (clickable to toggle) -->
                <button
                    onclick={() => !isStreaming && toggleTurn(i)}
                    class="flex items-center gap-2 w-full text-left {isStreaming ? 'cursor-default' : 'cursor-pointer'} {isCollapsed ? '' : 'mb-2'}"
                    disabled={isStreaming}
                >
                    {#if !isStreaming}
                        <span class="text-muted-foreground/40">
                            {#if isCollapsed}
                                <ChevronRight size={14} />
                            {:else}
                                <ChevronDown size={14} />
                            {/if}
                        </span>
                    {/if}
                    <span class="text-base">{panelist?.emoji ?? ''}</span>
                    <span class="text-sm font-semibold {colors.text}">{panelist?.name ?? turn.panelistId}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded-full {colors.badge} font-medium">
                        {panelist?.model ?? turn.model}
                    </span>
                    <span class="text-[10px] text-muted-foreground/60 ml-auto">
                        {getRoundLabel(turn.round, turn.panelistId)}
                    </span>
                </button>

                <!-- Turn Content -->
                {#if isCollapsed}
                    <p class="text-xs text-muted-foreground/50 truncate pl-5">{getPreview(turn.content)}</p>
                {:else}
                    <div class="text-sm text-foreground/90 prose-sm">
                        {#if turn.content}
                            <Markdown content={turn.content} />
                        {/if}
                        {#if isStreaming}
                            <span class="inline-block w-2 h-4 bg-current opacity-60 animate-pulse ml-0.5"></span>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    {/each}

    <!-- Skipped Round Indicator -->
    {#if discussion.skippedRounds?.includes(2)}
        <div class="flex items-center gap-2 py-2 px-4 text-xs text-muted-foreground/60 italic">
            <span>&#x23ED;&#xFE0F;</span>
            <span>Round 2 (Rebuttal) skipped — positions were similar enough for the court to proceed to its ruling</span>
        </div>
    {/if}

    <!-- Status Footer -->
    {#if discussion.status === 'complete'}
        <div class="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground/50">
            <span>Court ruling complete</span>
            <span>&#x2022;</span>
            <span>{discussion.turns.length} turns</span>
            {#if discussion.totalUsage && (discussion.totalUsage.promptTokens + discussion.totalUsage.completionTokens) > 0}
                <span>&#x2022;</span>
                <span>~{(discussion.totalUsage.promptTokens + discussion.totalUsage.completionTokens).toLocaleString()} tokens</span>
            {/if}
            <span>&#x2022;</span>
            <span>{discussion.panelists.map(p => p.model).join(', ')}</span>
        </div>
    {/if}
</div>
