<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import BotList from '$lib/components/bots/BotList.svelte';
	import BotCreateEditForm from '$lib/components/bots/BotCreateEditForm.svelte';
	import { chatState } from '$lib/state/chat.svelte';
	import { botState } from '$lib/state/bots.svelte';
	import type { CustomBot, CustomBotCreateInput } from '$lib/types/customBot';
	import { onMount } from 'svelte';
	import { Bot } from 'lucide-svelte';

	let sidebarOpen = $state(true);
	let showForm = $state(false);
	let editingBot = $state<CustomBot | null>(null);

	onMount(() => {
		void botState.loadBots(chatState.biglotUserId);
	});

	function handleCreate() {
		editingBot = null;
		showForm = true;
	}

	function handleEdit(bot: CustomBot) {
		editingBot = bot;
		showForm = true;
	}

	async function handleDuplicate(bot: CustomBot) {
		await botState.duplicateBot(chatState.biglotUserId, bot.id);
	}

	async function handleDelete(bot: CustomBot) {
		if (!confirm(`Delete "${bot.name}"? This cannot be undone.`)) return;
		await botState.deleteBot(chatState.biglotUserId, bot.id);
	}

	async function handleSave(input: CustomBotCreateInput) {
		if (editingBot) {
			const result = await botState.updateBot(chatState.biglotUserId, editingBot.id, input);
			if (result) {
				showForm = false;
				editingBot = null;
			} else {
				throw new Error(botState.error ?? 'Failed to update bot');
			}
		} else {
			const result = await botState.createBot(chatState.biglotUserId, input);
			if (result) {
				showForm = false;
			} else {
				throw new Error(botState.error ?? 'Failed to create bot');
			}
		}
	}

	function handleCancel() {
		showForm = false;
		editingBot = null;
	}
</script>

<div class="flex h-full overflow-hidden bg-background text-foreground font-sans">
	<Sidebar bind:isOpen={sidebarOpen} />

	<main
		class="flex-1 flex flex-col overflow-hidden h-full transition-all duration-300"
		class:ml-64={sidebarOpen}
		class:ml-0={!sidebarOpen}
	>
		<!-- Header -->
		<div class="flex items-center gap-3 px-6 py-4 border-b border-border/50">
			<div class="p-2 rounded-lg bg-primary/20 text-primary">
				<Bot size={20} />
			</div>
			<div class="flex-1">
				<h1 class="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-white">
					My Bots
				</h1>
				<p class="text-xs text-muted-foreground">
					Create and manage your custom AI assistants
				</p>
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto px-6 py-6">
			<div class="max-w-2xl mx-auto">
				{#if showForm}
					<div class="glass-panel p-5">
						<BotCreateEditForm
							bot={editingBot}
							onSave={handleSave}
							onCancel={handleCancel}
						/>
					</div>
				{:else}
					<BotList
						bots={botState.bots}
						isLoading={botState.isLoading}
						onCreate={handleCreate}
						onEdit={handleEdit}
						onDuplicate={handleDuplicate}
						onDelete={handleDelete}
					/>
				{/if}

				{#if botState.error && !showForm}
					<div class="mt-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
						{botState.error}
					</div>
				{/if}
			</div>
		</div>
	</main>
</div>
