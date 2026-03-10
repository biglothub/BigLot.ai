import { env } from '$env/dynamic/private';
import { getClientForModel, isAIModel, type AIModel } from './aiProvider.server';
import type {
	DiscussionBlock,
	DiscussionPanelist,
	DiscussionPanelistId,
	ContentBlock
} from '$lib/types/contentBlock';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// --- Types ---

export type DiscussionCallbacks = {
	onDiscussionStart: (block: DiscussionBlock) => void;
	onTurnStart: (discussionId: string, panelistId: DiscussionPanelistId, round: number, model: string) => void;
	onTextDelta: (text: string, panelistId: DiscussionPanelistId) => void;
	onTurnEnd: (discussionId: string, panelistId: DiscussionPanelistId, round: number) => void;
	onRoundSkipped: (round: number, reason: string) => void;
	onError: (message: string) => void;
};

export type DiscussionConfig = {
	topic: string;
	conversationHistory: ChatCompletionMessageParam[];
	callbacks: DiscussionCallbacks;
};

type PanelistConfig = {
	id: DiscussionPanelistId;
	model: AIModel;
	temperature: number;
};

// --- Panelist Definitions ---

const PANELIST_META: Record<DiscussionPanelistId, Omit<DiscussionPanelist, 'model'>> = {
	bull: { id: 'bull', name: 'Bull Analyst', color: 'green', emoji: '🐂' },
	bear: { id: 'bear', name: 'Bear Analyst', color: 'red', emoji: '🐻' },
	moderator: { id: 'moderator', name: 'Moderator', color: 'amber', emoji: '⚖️' }
};

// --- Max Tokens Per Turn Role ---

const MAX_TOKENS_PER_ROLE: Record<string, number> = {
	intro: 200,
	argument: 600,
	rebuttal: 500,
	synthesis: 800
};

// --- Turn Schedule ---

type TurnDef = { panelistId: DiscussionPanelistId; round: number; role: string };

const INTRO_TURN: TurnDef = { panelistId: 'moderator', round: 0, role: 'intro' };

const ROUND_1_ARGUMENTS: TurnDef[] = [
	{ panelistId: 'bull', round: 1, role: 'argument' },
	{ panelistId: 'bear', round: 1, role: 'argument' }
];

const ROUND_2_TURNS: TurnDef[] = [
	{ panelistId: 'bull', round: 2, role: 'rebuttal' },
	{ panelistId: 'bear', round: 2, role: 'rebuttal' }
];

const SYNTHESIS_TURN: TurnDef = { panelistId: 'moderator', round: 99, role: 'synthesis' };

// --- Model Resolution ---

function resolveDiscussionModels(): PanelistConfig[] {
	// Check env overrides first
	const envBull = isAIModel(env.DISCUSSION_BULL_MODEL) ? env.DISCUSSION_BULL_MODEL as AIModel : null;
	const envBear = isAIModel(env.DISCUSSION_BEAR_MODEL) ? env.DISCUSSION_BEAR_MODEL as AIModel : null;
	const envMod = isAIModel(env.DISCUSSION_MODERATOR_MODEL) ? env.DISCUSSION_MODERATOR_MODEL as AIModel : null;

	if (envBull || envBear || envMod) {
		const fallback = envBull || envBear || envMod;
		return [
			{ id: 'bull', model: envBull || fallback!, temperature: 0.7 },
			{ id: 'bear', model: envBear || fallback!, temperature: 0.7 },
			{ id: 'moderator', model: envMod || fallback!, temperature: 0.5 }
		];
	}

	// Auto-detect from available API keys
	const hasOpenAI = !!env.OPENAI_API_KEY;
	const hasDeepSeek = !!env.DEEPSEEK_API_KEY;

	if (hasOpenAI && hasDeepSeek) {
		return [
			{ id: 'bull', model: 'gpt-4o', temperature: 0.7 },
			{ id: 'bear', model: 'deepseek', temperature: 0.7 },
			{ id: 'moderator', model: 'deepseek-r1', temperature: 0.5 }
		];
	}

	if (hasOpenAI) {
		return [
			{ id: 'bull', model: 'gpt-4o', temperature: 0.8 },
			{ id: 'bear', model: 'gpt-4o-mini', temperature: 0.6 },
			{ id: 'moderator', model: 'gpt-4o', temperature: 0.4 }
		];
	}

	if (hasDeepSeek) {
		return [
			{ id: 'bull', model: 'deepseek', temperature: 0.8 },
			{ id: 'bear', model: 'deepseek', temperature: 0.5 },
			{ id: 'moderator', model: 'deepseek-r1', temperature: 0.4 }
		];
	}

	throw new Error('No AI provider available. Set OPENAI_API_KEY or DEEPSEEK_API_KEY in .env');
}

// --- System Prompts ---

function buildSystemPrompt(panelistId: DiscussionPanelistId, topic: string, turnRole: string): string {
	const langInstruction = 'Always respond in the same language as the user\'s question. If the user writes in Thai, respond in Thai. If in English, respond in English.';

	if (panelistId === 'moderator' && turnRole === 'intro') {
		return [
			'You are a neutral moderator opening a structured Bull vs Bear debate on a financial/trading topic.',
			`The topic is: "${topic}"`,
			'Write a brief introduction (2-3 sentences) framing the key question and what the debate will explore.',
			'Do NOT take sides. Be concise.',
			langInstruction
		].join('\n');
	}

	if (panelistId === 'moderator' && turnRole === 'synthesis') {
		return [
			'You are a neutral moderator delivering the final synthesis of a Bull vs Bear debate.',
			`The topic was: "${topic}"`,
			'You have the full transcript of the debate. Your task:',
			'1. Identify the 3 strongest points from the Bull side',
			'2. Identify the 3 strongest points from the Bear side',
			'3. Highlight areas of agreement',
			'4. Deliver a balanced conclusion with actionable takeaways',
			'Be fair, thorough, and structured. Use headers/bullets for clarity.',
			langInstruction
		].join('\n');
	}

	if (panelistId === 'bull') {
		const base = [
			'You are a bullish market analyst participating in a structured debate.',
			`The topic is: "${topic}"`,
			'Argue the optimistic/bullish case. Be specific with data points, scenarios, and reasoning.',
			'Be persuasive but professional. Acknowledge risks briefly but focus on upside catalysts.',
			langInstruction
		];
		if (turnRole === 'rebuttal') {
			base.push('This is the REBUTTAL round. You must directly address and counter the Bear analyst\'s specific arguments from the previous round. Do not simply repeat your initial points.');
		}
		return base.join('\n');
	}

	if (panelistId === 'bear') {
		const base = [
			'You are a bearish/risk-aware market analyst participating in a structured debate.',
			`The topic is: "${topic}"`,
			'Argue the cautious/pessimistic case. Highlight risks, overvaluations, macro headwinds, and downside scenarios.',
			'Be persuasive but professional. Acknowledge potential upside briefly but focus on risk factors.',
			langInstruction
		];
		if (turnRole === 'rebuttal') {
			base.push('This is the REBUTTAL round. You must directly address and counter the Bull analyst\'s specific arguments from the previous round. Do not simply repeat your initial points.');
		}
		return base.join('\n');
	}

	return `You are a financial analyst discussing "${topic}". ${langInstruction}`;
}

function formatTranscript(completedTurns: { panelistId: DiscussionPanelistId; round: number; content: string }[]): string {
	if (completedTurns.length === 0) return '';

	const lines = completedTurns.map((t) => {
		const meta = PANELIST_META[t.panelistId];
		const roundLabel = t.round === 0 ? 'Introduction' : t.round === 99 ? 'Synthesis' : `Round ${t.round}`;
		return `[${meta.emoji} ${meta.name} — ${roundLabel}]:\n${t.content}`;
	});

	return '\n\n--- Debate Transcript ---\n' + lines.join('\n\n');
}

// --- AI Auto-Stop: evaluate whether Round 2 is needed ---

async function shouldContinueDebate(
	topic: string,
	completedTurns: { panelistId: DiscussionPanelistId; round: number; content: string }[],
	moderatorConfig: PanelistConfig
): Promise<boolean> {
	const transcript = formatTranscript(completedTurns);

	// Use a fast, cheap model for the evaluation call
	// Prefer gpt-4o-mini or the moderator's own model
	let evalModel: AIModel = moderatorConfig.model;
	// If moderator is deepseek-r1, use deepseek instead (faster for simple classification)
	if (evalModel === 'deepseek-r1') evalModel = 'deepseek';

	let client, apiModel;
	try {
		({ client, apiModel } = getClientForModel(evalModel));
	} catch {
		// If the eval model isn't available, default to continuing
		return true;
	}

	const evalPrompt = [
		'You are evaluating a Bull vs Bear debate to decide if a rebuttal round is needed.',
		`Topic: "${topic}"`,
		'',
		transcript,
		'',
		'Evaluate:',
		'1. Do Bull and Bear substantially AGREE on the key points? (If yes → skip rebuttal)',
		'2. Are there clear contradictions or opposing claims that need to be addressed? (If yes → continue)',
		'3. Would a rebuttal round add meaningful new insight? (If no → skip)',
		'',
		'Respond with ONLY one word: CONTINUE or SKIP',
		'CONTINUE = rebuttal round needed (positions are clearly opposed)',
		'SKIP = go straight to synthesis (positions are similar or rebuttal would not add value)'
	].join('\n');

	try {
		const response = await client.chat.completions.create({
			model: apiModel,
			messages: [{ role: 'user', content: evalPrompt }],
			max_tokens: 10,
			temperature: 0
		});

		const answer = (response.choices[0]?.message?.content ?? '').trim().toUpperCase();
		return answer.includes('CONTINUE');
	} catch {
		// On error, default to continuing the debate
		return true;
	}
}

// --- Execute a single turn ---

async function executeTurn(
	turnDef: TurnDef,
	topic: string,
	pConfig: PanelistConfig,
	conversationHistory: ChatCompletionMessageParam[],
	completedTurns: { panelistId: DiscussionPanelistId; round: number; content: string }[],
	discussionBlock: DiscussionBlock,
	discussionId: string,
	callbacks: DiscussionCallbacks
): Promise<void> {
	callbacks.onTurnStart(discussionId, turnDef.panelistId, turnDef.round, pConfig.model);

	try {
		const systemPrompt = buildSystemPrompt(turnDef.panelistId, topic, turnDef.role);
		const transcript = formatTranscript(completedTurns);

		const messages: ChatCompletionMessageParam[] = [
			{ role: 'system', content: systemPrompt }
		];

		// Include conversation context (last few messages for richer context)
		const recentHistory = conversationHistory
			.filter((m) => m.role === 'user' || m.role === 'assistant')
			.slice(-5);

		if (recentHistory.length > 0) {
			const contextStr = recentHistory
				.map((m) => {
					const content = typeof m.content === 'string' ? m.content : '';
					return `[${m.role}]: ${content}`;
				})
				.join('\n')
				.slice(0, 2000);

			messages.push({
				role: 'user',
				content: `Previous conversation context:\n${contextStr}`
			});
		}

		// Add transcript of prior debate turns
		if (transcript) {
			messages.push({
				role: 'user',
				content: `Here is the debate so far:${transcript}\n\nNow it's your turn. Respond as your role.`
			});
		}

		const { client, apiModel } = getClientForModel(pConfig.model);

		// DeepSeek-R1 (deepseek-reasoner) doesn't support temperature parameter
		const createParams: Record<string, unknown> = {
			model: apiModel,
			messages,
			stream: true,
			stream_options: { include_usage: true }
		};
		if (apiModel !== 'deepseek-reasoner') {
			createParams.temperature = pConfig.temperature;
		}
		createParams.max_tokens = MAX_TOKENS_PER_ROLE[turnDef.role] ?? 600;

		const stream = await (client.chat.completions.create as Function)(createParams);

		let turnText = '';
		let turnUsage = { promptTokens: 0, completionTokens: 0 };
		for await (const chunk of stream as AsyncIterable<any>) {
			const text = chunk.choices?.[0]?.delta?.content;
			if (text) {
				turnText += text;
				callbacks.onTextDelta(text, turnDef.panelistId);
			}
			if (chunk.usage) {
				turnUsage.promptTokens = chunk.usage.prompt_tokens ?? 0;
				turnUsage.completionTokens = chunk.usage.completion_tokens ?? 0;
			}
		}

		completedTurns.push({
			panelistId: turnDef.panelistId,
			round: turnDef.round,
			content: turnText
		});

		discussionBlock.turns.push({
			panelistId: turnDef.panelistId,
			round: turnDef.round,
			content: turnText,
			model: pConfig.model,
			usage: turnUsage,
			startedAt: Date.now(),
			completedAt: Date.now()
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error during discussion turn';
		callbacks.onError(`${PANELIST_META[turnDef.panelistId].name} error: ${message}`);

		completedTurns.push({
			panelistId: turnDef.panelistId,
			round: turnDef.round,
			content: `[Error: ${message}]`
		});

		discussionBlock.turns.push({
			panelistId: turnDef.panelistId,
			round: turnDef.round,
			content: `[Error: ${message}]`,
			model: pConfig.model,
			startedAt: Date.now(),
			completedAt: Date.now()
		});
	}

	callbacks.onTurnEnd(discussionId, turnDef.panelistId, turnDef.round);
}

// --- Main Loop ---

export async function runDiscussionLoop(config: DiscussionConfig): Promise<ContentBlock[]> {
	const { topic, conversationHistory, callbacks } = config;
	const panelistConfigs = resolveDiscussionModels();
	const modelMap = new Map(panelistConfigs.map((p) => [p.id, p]));

	const discussionId = `disc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

	const panelists: DiscussionPanelist[] = panelistConfigs.map((p) => ({
		...PANELIST_META[p.id],
		model: p.model
	}));

	const discussionBlock: DiscussionBlock = {
		type: 'discussion',
		discussionId,
		topic,
		panelists,
		turns: [],
		status: 'running',
		createdAt: Date.now(),
		updatedAt: Date.now()
	};

	callbacks.onDiscussionStart(discussionBlock);

	const completedTurns: { panelistId: DiscussionPanelistId; round: number; content: string }[] = [];

	// Phase 1a: Moderator intro (sequential)
	const introConfig = modelMap.get(INTRO_TURN.panelistId)!;
	await executeTurn(INTRO_TURN, topic, introConfig, conversationHistory, completedTurns, discussionBlock, discussionId, callbacks);

	// Phase 1b: Bull + Bear Round 1 (parallel — they don't need each other's transcript)
	await Promise.all(ROUND_1_ARGUMENTS.map((turnDef) => {
		const pConfig = modelMap.get(turnDef.panelistId)!;
		return executeTurn(turnDef, topic, pConfig, conversationHistory, completedTurns, discussionBlock, discussionId, callbacks);
	}));

	// Phase 2: AI evaluates whether Round 2 (rebuttal) is needed
	const moderatorConfig = modelMap.get('moderator')!;
	const needsRebuttal = await shouldContinueDebate(topic, completedTurns, moderatorConfig);

	if (needsRebuttal) {
		for (const turnDef of ROUND_2_TURNS) {
			const pConfig = modelMap.get(turnDef.panelistId)!;
			await executeTurn(turnDef, topic, pConfig, conversationHistory, completedTurns, discussionBlock, discussionId, callbacks);
		}
	} else {
		discussionBlock.skippedRounds = [2];
		callbacks.onRoundSkipped(2, 'AI determined positions are similar enough to skip rebuttal');
	}

	// Phase 3: Synthesis (always runs)
	const synthConfig = modelMap.get(SYNTHESIS_TURN.panelistId)!;
	await executeTurn(SYNTHESIS_TURN, topic, synthConfig, conversationHistory, completedTurns, discussionBlock, discussionId, callbacks);

	// Accumulate total usage
	discussionBlock.totalUsage = discussionBlock.turns.reduce(
		(acc, t) => ({
			promptTokens: acc.promptTokens + (t.usage?.promptTokens ?? 0),
			completionTokens: acc.completionTokens + (t.usage?.completionTokens ?? 0)
		}),
		{ promptTokens: 0, completionTokens: 0 }
	);

	discussionBlock.status = 'complete';
	discussionBlock.updatedAt = Date.now();

	return [discussionBlock];
}
