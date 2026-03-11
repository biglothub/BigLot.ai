import type { CustomBot, CustomBotCreateInput, CustomBotUpdateInput } from '$lib/types/customBot';

class BotState {
	bots = $state<CustomBot[]>([]);
	isLoading = $state(false);
	error = $state<string | null>(null);
	activeBotId = $state<string | null>(null);

	private static readonly ACTIVE_BOT_STORAGE_KEY = 'biglot.activeBotId';

	get activeBot(): CustomBot | null {
		if (!this.activeBotId) return null;
		return this.bots.find((b) => b.id === this.activeBotId) ?? null;
	}

	constructor() {
		if (typeof localStorage === 'undefined') return;
		const saved = localStorage.getItem(BotState.ACTIVE_BOT_STORAGE_KEY);
		if (saved) {
			this.activeBotId = saved;
		}
	}

	selectBot(botId: string | null) {
		this.activeBotId = botId;
		if (typeof localStorage === 'undefined') return;
		if (botId) {
			localStorage.setItem(BotState.ACTIVE_BOT_STORAGE_KEY, botId);
		} else {
			localStorage.removeItem(BotState.ACTIVE_BOT_STORAGE_KEY);
		}
	}

	async loadBots(biglotUserId: string) {
		this.isLoading = true;
		this.error = null;

		try {
			const response = await fetch(`/api/bots?biglotUserId=${encodeURIComponent(biglotUserId)}`);
			if (!response.ok) {
				throw new Error('Failed to load bots');
			}
			const data = (await response.json()) as { bots: CustomBot[] };
			this.bots = data.bots ?? [];

			// Clear activeBotId if the bot no longer exists
			if (this.activeBotId && !this.bots.find((b) => b.id === this.activeBotId)) {
				this.selectBot(null);
			}
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to load bots';
		} finally {
			this.isLoading = false;
		}
	}

	async createBot(biglotUserId: string, input: CustomBotCreateInput): Promise<CustomBot | null> {
		this.error = null;

		try {
			const response = await fetch('/api/bots', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					biglotUserId,
					name: input.name,
					description: input.description ?? '',
					avatar: input.avatar ?? '🤖',
					systemPrompt: input.systemPrompt,
					tools: input.tools ?? [],
					defaultModel: input.defaultModel ?? null,
					conversationStarters: input.conversationStarters ?? []
				})
			});

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? 'Failed to create bot');
			}

			const data = (await response.json()) as { bot: CustomBot };
			this.bots = [data.bot, ...this.bots];
			return data.bot;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to create bot';
			return null;
		}
	}

	async updateBot(biglotUserId: string, botId: string, input: CustomBotUpdateInput): Promise<CustomBot | null> {
		this.error = null;

		try {
			const body: Record<string, unknown> = { biglotUserId };
			if (input.name !== undefined) body.name = input.name;
			if (input.description !== undefined) body.description = input.description;
			if (input.avatar !== undefined) body.avatar = input.avatar;
			if (input.systemPrompt !== undefined) body.systemPrompt = input.systemPrompt;
			if (input.tools !== undefined) body.tools = input.tools;
			if (input.defaultModel !== undefined) body.defaultModel = input.defaultModel;
			if (input.conversationStarters !== undefined) body.conversationStarters = input.conversationStarters;

			const response = await fetch(`/api/bots/${botId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? 'Failed to update bot');
			}

			const data = (await response.json()) as { bot: CustomBot };
			this.bots = this.bots.map((b) => (b.id === botId ? data.bot : b));
			return data.bot;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to update bot';
			return null;
		}
	}

	async deleteBot(biglotUserId: string, botId: string): Promise<boolean> {
		this.error = null;

		try {
			const response = await fetch(`/api/bots/${botId}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ biglotUserId })
			});

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? 'Failed to delete bot');
			}

			this.bots = this.bots.filter((b) => b.id !== botId);
			if (this.activeBotId === botId) {
				this.selectBot(null);
			}
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to delete bot';
			return false;
		}
	}

	async duplicateBot(biglotUserId: string, botId: string): Promise<CustomBot | null> {
		this.error = null;

		try {
			const response = await fetch(`/api/bots/${botId}/duplicate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ biglotUserId })
			});

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? 'Failed to duplicate bot');
			}

			const data = (await response.json()) as { bot: CustomBot };
			this.bots = [data.bot, ...this.bots];
			return data.bot;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to duplicate bot';
			return null;
		}
	}
}

export const botState = new BotState();
