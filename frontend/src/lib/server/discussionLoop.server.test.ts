import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { env } from '$env/dynamic/private';
import { createDiscussionCallbacks } from '$lib/__test__/helpers/mockCallbacks';

// Mock aiProvider to return controllable clients
vi.mock('./aiProvider.server', () => {
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
		isAIModel: vi.fn((val: string) => ['gpt-4o', 'gpt-4o-mini', 'deepseek', 'deepseek-r1'].includes(val)),
		getClientForModel: vi.fn((model: string) => {
			const responses: Record<string, string> = {
				'gpt-4o': 'Bull perspective text',
				'gpt-4o-mini': 'Bear perspective text',
				'deepseek': 'DeepSeek response',
				'deepseek-r1': 'Reasoner response'
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

	it('streams text deltas with panelist ID', async () => {
		setEnv({ OPENAI_API_KEY: 'sk-test' });

		const callbacks = createDiscussionCallbacks();
		await runDiscussionLoop(createConfig({ callbacks }));
		const onTextDeltaMock = callbacks.onTextDelta as Mock;

		// onTextDelta should have been called with text and panelist IDs
		expect(callbacks.onTextDelta).toHaveBeenCalled();
		const panelistIds = onTextDeltaMock.mock.calls.map((call) => call[1]);
		expect(panelistIds).toContain('moderator');
		expect(panelistIds).toContain('bull');
		expect(panelistIds).toContain('bear');
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

	it('handles error in a turn gracefully', async () => {
		setEnv({ OPENAI_API_KEY: 'sk-test' });

		// Make getClientForModel throw for one specific model to simulate error
		const { getClientForModel } = await import('./aiProvider.server');
		let callCount = 0;
		(getClientForModel as any).mockImplementation((model: string) => {
			callCount++;
			// Fail on the 2nd call (bull round 1)
			if (callCount === 2) {
				throw new Error('Model unavailable');
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
});
