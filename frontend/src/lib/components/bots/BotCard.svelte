<script lang="ts">
	import { Copy, Pencil, Trash2, Wrench } from 'lucide-svelte';
	import type { CustomBot } from '$lib/types/customBot';

	let {
		bot,
		onEdit,
		onDuplicate,
		onDelete
	}: {
		bot: CustomBot;
		onEdit: (bot: CustomBot) => void;
		onDuplicate: (bot: CustomBot) => void;
		onDelete: (bot: CustomBot) => void;
	} = $props();
</script>

<div class="glass-panel p-4 group hover:border-primary/30 transition-colors">
	<div class="flex items-start gap-3">
		<!-- Avatar -->
		<div class="text-3xl shrink-0 w-10 h-10 flex items-center justify-center">
			{bot.avatar}
		</div>

		<!-- Info -->
		<div class="flex-1 min-w-0">
			<h3 class="text-sm font-semibold text-foreground truncate">
				{bot.name}
			</h3>
			{#if bot.description}
				<p class="text-xs text-muted-foreground mt-0.5 line-clamp-2">
					{bot.description}
				</p>
			{/if}
			<div class="flex items-center gap-2 mt-2">
				{#if bot.tools.length > 0}
					<span class="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded">
						<Wrench size={10} />
						{bot.tools.length} tools
					</span>
				{/if}
				{#if bot.default_model}
					<span class="text-[10px] text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded">
						{bot.default_model}
					</span>
				{/if}
			</div>
		</div>

		<!-- Actions -->
		<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
			<button
				onclick={() => onEdit(bot)}
				class="p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
				title="Edit"
			>
				<Pencil size={14} />
			</button>
			<button
				onclick={() => onDuplicate(bot)}
				class="p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
				title="Duplicate"
			>
				<Copy size={14} />
			</button>
			<button
				onclick={() => onDelete(bot)}
				class="p-1.5 rounded-md hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
				title="Delete"
			>
				<Trash2 size={14} />
			</button>
		</div>
	</div>
</div>
