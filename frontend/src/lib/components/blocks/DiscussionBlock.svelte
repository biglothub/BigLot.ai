<script lang="ts">
    import type { DiscussionBlock as DiscussionBlockType, DiscussionPanelistId } from "$lib/types/contentBlock";
    import Markdown from "../Markdown.svelte";

    let { discussion }: { discussion: DiscussionBlockType } = $props();

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
        if (round === 99) return 'Final Synthesis';
        if (round === 2) return `Round ${round} — Rebuttal`;
        return `Round ${round}`;
    }

    function getPanelist(id: DiscussionPanelistId) {
        return discussion.panelists.find(p => p.id === id);
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
        {/if}
    </div>

    <!-- Turns -->
    {#each discussion.turns as turn, i}
        {@const panelist = getPanelist(turn.panelistId)}
        {@const colors = colorMap[turn.panelistId]}
        {@const isStreaming = !turn.completedAt && discussion.status === 'running' && i === discussion.turns.length - 1}
        {@const isSynthesis = turn.round === 99}

        <div class="relative pl-4 border-l-2 {colors.border} {isSynthesis ? 'mt-4' : ''}">
            <div class="{colors.bg} rounded-lg p-3 {isSynthesis ? 'ring-1 ring-amber-500/20' : ''}">
                <!-- Turn Header -->
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-base">{panelist?.emoji ?? ''}</span>
                    <span class="text-sm font-semibold {colors.text}">{panelist?.name ?? turn.panelistId}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded-full {colors.badge} font-medium">
                        {panelist?.model ?? turn.model}
                    </span>
                    <span class="text-[10px] text-muted-foreground/60 ml-auto">
                        {getRoundLabel(turn.round, turn.panelistId)}
                    </span>
                </div>

                <!-- Turn Content -->
                <div class="text-sm text-foreground/90 prose-sm">
                    {#if turn.content}
                        <Markdown content={turn.content} />
                    {/if}
                    {#if isStreaming}
                        <span class="inline-block w-2 h-4 bg-current opacity-60 animate-pulse ml-0.5"></span>
                    {/if}
                </div>
            </div>
        </div>
    {/each}

    <!-- Status Footer -->
    {#if discussion.status === 'complete'}
        <div class="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground/50">
            <span>Discussion complete</span>
            <span>&#x2022;</span>
            <span>{discussion.turns.length} turns</span>
            <span>&#x2022;</span>
            <span>{discussion.panelists.map(p => p.model).join(', ')}</span>
        </div>
    {/if}
</div>
