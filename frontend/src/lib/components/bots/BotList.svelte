<script lang="ts">
	import { Plus, Loader2 } from 'lucide-svelte';
	import type { CustomBot } from '$lib/types/customBot';
	import BotCard from './BotCard.svelte';

	let {
		bots,
		isLoading = false,
		onCreate,
		onEdit,
		onDuplicate,
		onDelete
	}: {
		bots: CustomBot[];
		isLoading?: boolean;
		onCreate: () => void;
		onEdit: (bot: CustomBot) => void;
		onDuplicate: (bot: CustomBot) => void;
		onDelete: (bot: CustomBot) => void;
	} = $props();
</script>

<div class="space-y-3">
	<!-- Create Button -->
	<button
		onclick={onCreate}
		class="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-primary/80 border border-dashed border-primary/30 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-colors"
	>
		<Plus size={16} />
		Create New Bot
	</button>

	{#if isLoading}
		<div class="flex items-center justify-center py-8">
			<Loader2 size={20} class="animate-spin text-muted-foreground" />
		</div>
	{:else if bots.length === 0}
		<div class="text-center py-8">
			<div class="text-3xl mb-2">🤖</div>
			<p class="text-sm text-muted-foreground">No bots yet</p>
			<p class="text-xs text-muted-foreground/60 mt-1">Create your first custom bot to get started</p>
		</div>
	{:else}
		<div class="space-y-2">
			{#each bots as bot (bot.id)}
				<BotCard {bot} {onEdit} {onDuplicate} {onDelete} />
			{/each}
		</div>
	{/if}
</div>
