import { beforeEach, describe, expect, it } from 'vitest';
import { env } from '$env/dynamic/private';
import { resolveChatModelRuntime } from './chatModelRuntime.server';

const ENV_KEYS = [
	'AI_MODEL',
	'NORMAL_AI_MODEL',
	'AGENT_AI_MODEL',
	'RESEARCH_AI_MODEL',
	'OPENAI_API_KEY',
	'DEEPSEEK_API_KEY',
	'MINIMAX_API_KEY',
	'DISCUSSION_BULL_MODEL',
	'DISCUSSION_BEAR_MODEL',
	'DISCUSSION_MODERATOR_MODEL'
] as const;

function setEnv(vars: Record<string, string>) {
	for (const [key, value] of Object.entries(vars)) {
		(env as Record<string, string>)[key] = value;
	}
}

function resetEnv() {
	for (const key of ENV_KEYS) {
		delete (env as Record<string, string | undefined>)[key];
	}
}

beforeEach(() => {
	resetEnv();
});

describe('resolveChatModelRuntime', () => {
	it('uses NORMAL_AI_MODEL for normal chat', () => {
		setEnv({
			AI_MODEL: 'deepseek',
			NORMAL_AI_MODEL: 'minimax-m2.5',
			MINIMAX_API_KEY: 'sk-minimax'
		});

		const result = resolveChatModelRuntime('normal');

		expect(result.selectedModel).toBe('minimax-m2.5');
		expect(result.clientBundle?.provider).toBe('minimax');
		expect(result.runModelLabel).toBe('minimax-m2.5');
	});

	it('uses AGENT_AI_MODEL for agent chat', () => {
		setEnv({
			AI_MODEL: 'minimax-m2.5',
			AGENT_AI_MODEL: 'gpt-4o',
			OPENAI_API_KEY: 'sk-openai'
		});

		const result = resolveChatModelRuntime('agent');

		expect(result.selectedModel).toBe('gpt-4o');
		expect(result.clientBundle?.provider).toBe('openai');
		expect(result.runModelLabel).toBe('gpt-4o');
	});

	it('uses RESEARCH_AI_MODEL for research chat', () => {
		setEnv({
			AI_MODEL: 'gpt-4o',
			RESEARCH_AI_MODEL: 'deepseek',
			DEEPSEEK_API_KEY: 'sk-deepseek'
		});

		const result = resolveChatModelRuntime('research');

		expect(result.selectedModel).toBe('deepseek');
		expect(result.clientBundle?.provider).toBe('deepseek');
		expect(result.runModelLabel).toBe('deepseek');
	});

	it('falls back to AI_MODEL for research when RESEARCH_AI_MODEL is unset', () => {
		setEnv({
			AI_MODEL: 'deepseek',
			NORMAL_AI_MODEL: 'minimax-m2.5',
			DEEPSEEK_API_KEY: 'sk-deepseek'
		});

		const result = resolveChatModelRuntime('research');

		expect(result.selectedModel).toBe('deepseek');
		expect(result.clientBundle?.provider).toBe('deepseek');
		expect(result.runModelLabel).toBe('deepseek');
	});

	it('falls back to AI_MODEL for research when RESEARCH_AI_MODEL is invalid', () => {
		setEnv({
			AI_MODEL: 'deepseek',
			RESEARCH_AI_MODEL: 'invalid-model',
			DEEPSEEK_API_KEY: 'sk-deepseek'
		});

		const result = resolveChatModelRuntime('research');

		expect(result.selectedModel).toBe('deepseek');
		expect(result.clientBundle?.provider).toBe('deepseek');
		expect(result.runModelLabel).toBe('deepseek');
	});

	it('does not require a single-model client for discussion mode', () => {
		setEnv({
			MINIMAX_API_KEY: 'sk-minimax',
			DISCUSSION_BULL_MODEL: 'minimax-m2.5',
			DISCUSSION_BEAR_MODEL: 'minimax-m2.5',
			DISCUSSION_MODERATOR_MODEL: 'minimax-m2.5'
		});

		const result = resolveChatModelRuntime('discussion');

		expect(result.clientBundle).toBeNull();
		expect(result.runProviderLabel).toBe('minimax');
		expect(result.runModelLabel).toContain('bull=minimax-m2.5');
		expect(result.runModelLabel).toContain('bear=minimax-m2.5');
		expect(result.runModelLabel).toContain('moderator=minimax-m2.5');
	});

	it('still validates configured provider keys for normal chat', () => {
		expect(() => resolveChatModelRuntime('normal')).toThrow('OPENAI_API_KEY is not configured');
	});

	it('uses a valid custom bot model for non-discussion chat', () => {
		setEnv({ MINIMAX_API_KEY: 'sk-minimax' });

		const result = resolveChatModelRuntime('agent', 'minimax-m2.5');

		expect(result.selectedModel).toBe('minimax-m2.5');
		expect(result.clientBundle?.provider).toBe('minimax');
		expect(result.runModelLabel).toBe('minimax-m2.5');
	});
});
