<script lang="ts">
	import { X, Plus, Minus, Save, Loader2 } from 'lucide-svelte';
	import type { CustomBot, CustomBotCreateInput } from '$lib/types/customBot';

	let {
		bot = null,
		onSave,
		onCancel
	}: {
		bot?: CustomBot | null;
		onSave: (input: CustomBotCreateInput) => Promise<void>;
		onCancel: () => void;
	} = $props();

	const isEditing = $derived(!!bot);

	// Form state
	let name = $state('');
	let description = $state('');
	let avatar = $state('🤖');
	let systemPrompt = $state('');
	let selectedTools = $state<string[]>([]);
	let defaultModel = $state<string>('');
	let conversationStarters = $state<string[]>(['']);
	let isSaving = $state(false);
	let error = $state<string | null>(null);

	// Emoji picker
	const EMOJI_OPTIONS = [
		'🤖', '📊', '📈', '📉', '💰', '🪙', '🏦', '🎯',
		'🔍', '🧠', '⚡', '🛡️', '📋', '🔔', '💎', '🐂',
		'🐻', '🌍', '🏛️', '📰', '🧮', '🔥', '⭐', '🎲'
	];
	let showEmojiPicker = $state(false);

	$effect(() => {
		name = bot?.name ?? '';
		description = bot?.description ?? '';
		avatar = bot?.avatar ?? '🤖';
		systemPrompt = bot?.system_prompt ?? '';
		selectedTools = bot?.tools ? [...bot.tools] : [];
		defaultModel = bot?.default_model ?? '';
		conversationStarters =
			bot?.conversation_starters?.length ? [...bot.conversation_starters] : [''];
	});

	// Available tools (grouped)
	const TOOL_GROUPS = [
		{
			label: 'Market Data',
			tools: [
				{ name: 'get_market_data', desc: 'Crypto, forex, commodities prices' },
				{ name: 'get_crypto_chart', desc: 'Candlestick charts' },
				{ name: 'get_technical_analysis', desc: 'RSI, MACD, Bollinger, SMA, EMA' },
				{ name: 'get_fear_greed_index', desc: 'Crypto Fear & Greed' }
			]
		},
		{
			label: 'Gold',
			tools: [
				{ name: 'get_gold_price', desc: 'COMEX + Binance + Thai gold' },
				{ name: 'get_gold_chart', desc: 'Gold historical charts' }
			]
		},
		{
			label: 'Macro',
			tools: [
				{ name: 'get_macro_indicators', desc: 'DXY, 10Y yield, SPX' },
				{ name: 'get_cot_data', desc: 'CFTC COT positioning' },
				{ name: 'get_cross_asset_correlation', desc: 'Gold vs DXY/SPX/10Y correlation' }
			]
		},
		{
			label: 'Search & Memory',
			tools: [
				{ name: 'web_search', desc: 'Real-time news and events' },
				{ name: 'save_memory', desc: 'Save user data across sessions' },
				{ name: 'recall_memory', desc: 'Recall saved data' },
				{ name: 'delete_memory', desc: 'Delete saved data' }
			]
		}
	];

	const MODEL_OPTIONS = [
		{ value: '', label: 'Server Default' },
		{ value: 'gpt-4o', label: 'GPT-4o' },
		{ value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
		{ value: 'o3-mini', label: 'o3 Mini' },
		{ value: 'deepseek', label: 'DeepSeek Chat' },
		{ value: 'deepseek-r1', label: 'DeepSeek R1' },
		{ value: 'claude-sonnet', label: 'Claude Sonnet 4' },
		{ value: 'claude-haiku', label: 'Claude Haiku 4.5' },
		{ value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
		{ value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' }
	];

	function toggleTool(toolName: string) {
		if (selectedTools.includes(toolName)) {
			selectedTools = selectedTools.filter((t) => t !== toolName);
		} else {
			selectedTools = [...selectedTools, toolName];
		}
	}

	function addStarter() {
		if (conversationStarters.length < 6) {
			conversationStarters = [...conversationStarters, ''];
		}
	}

	function removeStarter(index: number) {
		conversationStarters = conversationStarters.filter((_, i) => i !== index);
	}

	async function handleSubmit() {
		error = null;

		if (!name.trim()) {
			error = 'Name is required';
			return;
		}
		if (systemPrompt.length < 10) {
			error = 'Instructions must be at least 10 characters';
			return;
		}

		isSaving = true;
		try {
			const starters = conversationStarters.filter((s) => s.trim().length > 0);
			await onSave({
				name: name.trim(),
				description: description.trim(),
				avatar,
				systemPrompt,
				tools: selectedTools,
				defaultModel: defaultModel || null,
				conversationStarters: starters
			});
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save';
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="space-y-5">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-white">
			{isEditing ? 'Edit Bot' : 'Create New Bot'}
		</h2>
		<button onclick={onCancel} class="p-1.5 rounded-md hover:bg-white/10 text-muted-foreground">
			<X size={18} />
		</button>
	</div>

	{#if error}
		<div class="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
			{error}
		</div>
	{/if}

	<!-- Avatar + Name -->
	<div class="flex items-start gap-3">
		<div class="relative">
			<button
				onclick={() => (showEmojiPicker = !showEmojiPicker)}
				class="w-14 h-14 text-3xl flex items-center justify-center rounded-xl bg-secondary/80 border border-white/10 hover:border-primary/30 transition-colors"
			>
				{avatar}
			</button>
			{#if showEmojiPicker}
				<div class="absolute top-16 left-0 z-10 bg-secondary border border-white/10 rounded-lg p-2 grid grid-cols-6 gap-1 shadow-xl">
					{#each EMOJI_OPTIONS as emoji}
						<button
							onclick={() => { avatar = emoji; showEmojiPicker = false; }}
							class="w-8 h-8 text-lg flex items-center justify-center rounded hover:bg-white/10 transition-colors {avatar === emoji ? 'bg-amber-500/20 ring-1 ring-amber-500/40' : ''}"
						>
							{emoji}
						</button>
					{/each}
				</div>
			{/if}
		</div>
		<div class="flex-1 space-y-2">
			<input
				type="text"
				bind:value={name}
				placeholder="Bot name"
				maxlength={60}
				class="w-full bg-secondary/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
			/>
			<input
				type="text"
				bind:value={description}
				placeholder="Short description (optional)"
				maxlength={500}
				class="w-full bg-secondary/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
			/>
		</div>
	</div>

	<!-- Instructions (System Prompt) -->
	<div>
		<label for="bot-system-prompt" class="block text-sm font-medium text-foreground/80 mb-1.5">Instructions</label>
		<p class="text-[11px] text-muted-foreground mb-2">Tell the bot how to behave, what role to play, and what to avoid.</p>
		<textarea
			id="bot-system-prompt"
			bind:value={systemPrompt}
			placeholder="You are a trading assistant specialized in..."
			maxlength={8000}
			rows={6}
			class="w-full bg-secondary/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 resize-y"
		></textarea>
		<div class="text-right text-[10px] text-muted-foreground mt-1">
			{systemPrompt.length} / 8000
		</div>
	</div>

	<!-- Tools -->
	<div>
		<div id="bot-tools-label" class="block text-sm font-medium text-foreground/80 mb-1.5">Tools</div>
		<p class="text-[11px] text-muted-foreground mb-2">Select which tools this bot can use.</p>
		<div class="space-y-3" role="group" aria-labelledby="bot-tools-label">
			{#each TOOL_GROUPS as group}
				<div>
					<div class="text-[11px] text-muted-foreground font-medium mb-1">{group.label}</div>
					<div class="space-y-1">
						{#each group.tools as tool}
							<label class="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 cursor-pointer">
								<input
									type="checkbox"
									checked={selectedTools.includes(tool.name)}
									onchange={() => toggleTool(tool.name)}
									class="accent-amber-500 w-3.5 h-3.5"
								/>
								<span class="text-xs text-foreground/80">{tool.name}</span>
								<span class="text-[10px] text-muted-foreground">— {tool.desc}</span>
							</label>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Model -->
	<div>
		<label for="bot-model" class="block text-sm font-medium text-foreground/80 mb-1.5">Model (optional)</label>
		<select
			id="bot-model"
			bind:value={defaultModel}
			class="w-full max-w-xs bg-secondary/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/40"
		>
			{#each MODEL_OPTIONS as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	</div>

	<!-- Conversation Starters -->
	<div>
		<div id="bot-starters-label" class="block text-sm font-medium text-foreground/80 mb-1.5">Conversation Starters</div>
		<p class="text-[11px] text-muted-foreground mb-2">Suggested prompts shown when starting a new chat (max 6).</p>
		<div class="space-y-2" role="group" aria-labelledby="bot-starters-label">
			{#each conversationStarters as starter, i}
				<div class="flex items-center gap-2">
					<input
						id={`bot-starter-${i}`}
						type="text"
						bind:value={conversationStarters[i]}
						placeholder="e.g. What's the gold outlook?"
						maxlength={200}
						class="flex-1 bg-secondary/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
					/>
					<button
						onclick={() => removeStarter(i)}
						class="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
					>
						<Minus size={14} />
					</button>
				</div>
			{/each}
			{#if conversationStarters.length < 6}
				<button
					onclick={addStarter}
					class="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors"
				>
					<Plus size={14} />
					Add starter
				</button>
			{/if}
		</div>
	</div>

	<!-- Save Button -->
	<div class="flex justify-end gap-2 pt-2">
		<button
			onclick={onCancel}
			class="px-4 py-2 text-xs text-muted-foreground hover:text-foreground rounded-lg border border-white/10 hover:border-white/20 transition-colors"
		>
			Cancel
		</button>
		<button
			onclick={handleSubmit}
			disabled={isSaving}
			class="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-primary/20 text-primary border border-primary/30 rounded-lg hover:bg-primary/30 transition-colors disabled:opacity-50"
		>
			{#if isSaving}
				<Loader2 size={14} class="animate-spin" />
			{:else}
				<Save size={14} />
			{/if}
			{isEditing ? 'Update Bot' : 'Create Bot'}
		</button>
	</div>
</div>
