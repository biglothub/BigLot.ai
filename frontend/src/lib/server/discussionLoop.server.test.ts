import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { env } from '$env/dynamic/private';
import { createDiscussionCallbacks } from '$lib/__test__/helpers/mockCallbacks';

// Mock aiProvider to return controllable clients
vi.mock('./aiProvider.server', async () => {
	const actual = await vi.importActual<typeof import('./aiProvider.server')>('./aiProvider.server');

	const createStreamingClient = (text: string) => ({
		chat: {
			completions: {
				create: vi.fn(async (params: any) => {
					if (params.stream) {
						return {
							[Symbol.asyncIterator]() {
								let sent = false;
								let done = false;
								return {
									async next() {
										if (!sent) {
											sent = true;
											return {
												done: false,
												value: {
													choices: [{ delta: { content: text } }],
													usage: { prompt_tokens: 10, completion_tokens: 20 }
												}
											};
										}
										if (!done) {
											done = true;
											return { done: false, value: { choices: [{ delta: {}, finish_reason: 'stop' }] } };
										}
										return { done: true, value: undefined };
									}
								};
							}
						};
					}
					// Non-streaming (eval call)
					return {
						choices: [{ message: { content: text } }]
					};
				})
			}
		}
	});

	return {
		...actual,
		isAIModel: vi.fn((val: string) => actual.isAIModel(val)),
		getClientForModel: vi.fn((model: string) => {
			const responses: Record<string, string> = {
				'gpt-4o': 'Bull perspective text',
				'gpt-4o-mini': 'Bear perspective text',
				'deepseek': 'DeepSeek response',
				'deepseek-r1': 'Reasoner response',
				'minimax-text-01': 'MiniMax text',
				'minimax-m1': 'MiniMax judge',
				'minimax-m2.5': 'MiniMax M2.5 response',
				'minimax-m2.5-highspeed': 'MiniMax M2.5 Highspeed response'
			};
			const client = createStreamingClient(responses[model] || 'Default text');
			return {
				client,
				apiModel: model,
				provider: 'openai',
				supportsImageInput: true
			};
		})
	};
});

import { runDiscussionLoop, type DiscussionConfig } from './discussionLoop.server';

function setEnv(vars: Record<string, string>) {
	for (const [key, value] of Object.entries(vars)) {
		(env as Record<string, string>)[key] = value;
	}
}

function createConfig(overrides: Partial<DiscussionConfig> = {}): DiscussionConfig {
	return {
		topic: 'Is gold going to $3000?',
		conversationHistory: [
			{ role: 'user', content: 'Discuss gold outlook' }
		],
		callbacks: createDiscussionCallbacks(),
		...overrides
	};
}

describe('runDiscussionLoop', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('runs full discussion flow with OpenAI keys', async () => {
		setEnv({ OPENAI_API_KEY: 'sk-test' });

		const callbacks = createDiscussionCallbacks();
		const config = createConfig({ callbacks });
		const result = await runDiscussionLoop(config);

		// Should return exactly one discussion block
		expect(result).toHaveLength(1);
		const block = result[0] as any;
		expect(block.type).toBe('discussion');
		expect(block.status).toBe('complete');
		expect(block.topic).toBe('Is gold going to $3000?');

		// Should have panelists
		expect(block.panelists).toHaveLength(3);

		// Should have called onDiscussionStart
		expect(callbacks.onDiscussionStart).toHaveBeenCalledTimes(1);

		// Should have turns (at minimum: intro + bull + bear + synthesis = 4)
		expect(block.turns.length).toBeGreaterThanOrEqual(4);
	});

	it('calls onTurnStart and onTurnEnd for each turn', async () => {
		setEnv({ OPENAI_API_KEY: 'sk-test' });

		const callbacks = createDiscussionCallbacks();
		await runDiscussionLoop(createConfig({ callbacks }));
		const onTurnStartMock = callbacks.onTurnStart as Mock;
		const onTurnEndMock = callbacks.onTurnEnd as Mock;

		// At least 4 turns (intro, bull R1, bear R1, synthesis)
		expect(callbacks.onTurnStart).toHaveBeenCalledTimes(onTurnEndMock.mock.calls.length);
		expect(onTurnStartMock.mock.calls.length).toBeGreaterThanOrEqual(4);
	});

	it('reuses the same turnId across start, delta, end, and final block output', async () => {
		setEnv({ OPENAI_API_KEY: 'sk-test' });

		const callbacks = createDiscussionCallbacks();
		const result = await runDiscussionLoop(createConfig({ callbacks }));
		const block = result[0] as any;
		const onTurnStartMock = callbacks.onTurnStart as Mock;
		const onTextDeltaMock = callbacks.onTextDelta as Mock;
		const onTurnEndMock = callbacks.onTurnEnd as Mock;

		const startEvents = onTurnStartMock.mock.calls.map(([event]) => event);
		const deltaEvents = onTextDeltaMock.mock.calls.map(([event]) => event);
		const endEvents = onTurnEndMock.mock.calls.map(([event]) => event);
		const blockTurnIds = block.turns.map((turn: any) => turn.turnId);
		const startedTurnIds = startEvents.map((event: any) => event.turnId);
		const endedTurnIds = endEvents.map((event: any) => event.turnId);

		expect(new Set(startedTurnIds).size).toBe(startEvents.length);
		expect(blockTurnIds).toEqual(startedTurnIds);
		expect(endedTurnIds).toEqual(startedTurnIds);
		expect(deltaEvents.length).toBeGreaterThan(0);

		for (const event of deltaEvents) {
			expect(startedTurnIds).toContain(event.turnId);
			expect(typeof event.panelistId).toBe('string');
		}
	});

	it('accumulates total usage across turns', async () => {
		setEnv({ OPENAI_API_KEY: 'sk-test' });

		const result = await runDiscussionLoop(createConfig());
		const block = result[0] as any;

		expect(block.totalUsage).toBeDefined();
		expect(block.totalUsage.promptTokens).toBeGreaterThan(0);
		expect(block.totalUsage.completionTokens).toBeGreaterThan(0);
	});


	it('uses env override models when set', async () => {
		setEnv({
			OPENAI_API_KEY: 'sk-test',
			DISCUSSION_BULL_MODEL: 'gpt-4o',
			DISCUSSION_BEAR_MODEL: 'gpt-4o-mini',
			DISCUSSION_MODERATOR_MODEL: 'gpt-4o'
		});

		const result = await runDiscussionLoop(createConfig());
		const block = result[0] as any;

		// Panelists should have the env-specified models
		const bull = block.panelists.find((p: any) => p.id === 'bull');
		const bear = block.panelists.find((p: any) => p.id === 'bear');
		expect(bull.model).toBe('gpt-4o');
		expect(bear.model).toBe('gpt-4o-mini');
	});

	it('throws when no API keys are available', async () => {
		// env is reset by setup.ts — no keys set
		await expect(runDiscussionLoop(createConfig())).rejects.toThrow('No AI provider');
	});

	it('handles non-retriable turn errors gracefully', async () => {
		setEnv({ OPENAI_API_KEY: 'sk-test' });

		// Make getClientForModel throw for one specific model to simulate error
		const { getClientForModel } = await import('./aiProvider.server');
		let callCount = 0;
		(getClientForModel as any).mockImplementation((model: string) => {
			callCount++;
			// Fail on the 2nd call (bull round 1)
			if (callCount === 2) {
				throw new Error('Prompt serialization failed');
			}
			const client = {
				chat: {
					completions: {
						create: vi.fn(async () => ({
							[Symbol.asyncIterator]() {
								let sent = false;
								return {
									async next() {
										if (!sent) {
											sent = true;
											return { done: false, value: { choices: [{ delta: { content: 'response' } }] } };
										}
										return { done: true, value: undefined };
									}
								};
							}
						}))
					}
				}
			};
			return { client, apiModel: model, provider: 'openai', supportsImageInput: true };
		});

		const callbacks = createDiscussionCallbacks();
		const result = await runDiscussionLoop(createConfig({ callbacks }));

		// Should still complete despite error
		expect(result).toHaveLength(1);
		expect((result[0] as any).status).toBe('complete');

		// Should have called onError
		expect(callbacks.onError).toHaveBeenCalled();
	});

	it('falls back to another provider when MiniMax returns insufficient balance', async () => {
		setEnv({
			OPENAI_API_KEY: 'sk-test',
			MINIMAX_API_KEY: 'sk-minimax-test',
			DISCUSSION_BULL_MODEL: 'minimax-text-01',
			DISCUSSION_BEAR_MODEL: 'minimax-text-01',
			DISCUSSION_MODERATOR_MODEL: 'minimax-m1'
		});

		const createStreamingClient = (text: string) => ({
			chat: {
				completions: {
					create: vi.fn(async (params: any) => {
						if (params.stream) {
							return {
								[Symbol.asyncIterator]() {
									let sent = false;
									let done = false;
									return {
										async next() {
											if (!sent) {
												sent = true;
												return {
													done: false,
													value: {
														choices: [{ delta: { content: text } }],
														usage: { prompt_tokens: 10, completion_tokens: 20 }
													}
												};
											}
											if (!done) {
												done = true;
												return { done: false, value: { choices: [{ delta: {}, finish_reason: 'stop' }] } };
											}
											return { done: true, value: undefined };
										}
									};
								}
							};
						}

						return {
							choices: [{ message: { content: 'CONTINUE' } }]
						};
					})
				}
			}
		});

		const createFailingClient = () => ({
			chat: {
				completions: {
					create: vi.fn(async () => {
						throw new Error('insufficient balance (1008)');
					})
				}
			}
		});

		const { getClientForModel } = await import('./aiProvider.server');
		(getClientForModel as any).mockImplementation((model: string) => {
			if (model === 'minimax-text-01' || model === 'minimax-m1') {
				return {
					client: createFailingClient(),
					apiModel: model,
					provider: 'minimax',
					supportsImageInput: false
				};
			}

			const openAiResponses: Record<string, string> = {
				'gpt-4o': 'Fallback gpt-4o response',
				'gpt-4o-mini': 'Fallback gpt-4o-mini response',
				'o3-mini': 'Fallback o3-mini response'
			};
			const text = openAiResponses[model];
			if (text) {
				return {
					client: createStreamingClient(text),
					apiModel: model,
					provider: 'openai',
					supportsImageInput: false
				};
			}

			throw new Error(`${model} is not configured in .env`);
		});

		const callbacks = createDiscussionCallbacks();
		const result = await runDiscussionLoop(createConfig({ callbacks }));
		const block = result[0] as any;

		expect(block.status).toBe('complete');
		expect(block.turns.some((turn: any) => String(turn.content).includes('[Error:'))).toBe(false);
		expect(block.turns.some((turn: any) => turn.model === 'gpt-4o')).toBe(true);
		expect(block.turns.some((turn: any) => turn.model === 'gpt-4o-mini')).toBe(true);
		expect(block.panelists.find((p: any) => p.id === 'bull').model).toBe('gpt-4o');
		expect(block.panelists.find((p: any) => p.id === 'bear').model).toBe('gpt-4o-mini');
		expect(block.panelists.find((p: any) => p.id === 'moderator').model).toBe('gpt-4o');
		expect(callbacks.onError).not.toHaveBeenCalled();
	});
});
