import { describe, it, expect, beforeEach } from 'vitest';
import { env } from '$env/dynamic/private';
import { isAIModel, resolveDefaultAIModel, getClientForModel, getClientWithFallback, getModelConfig } from './aiProvider.server';

function setEnv(vars: Record<string, string>) {
	for (const [key, value] of Object.entries(vars)) {
		(env as Record<string, string>)[key] = value;
	}
}

describe('isAIModel', () => {
	it.each([
		'gpt-4o', 'gpt-4o-mini', 'o3-mini',
		'deepseek', 'deepseek-r1',
		'claude-sonnet', 'claude-haiku',
		'gemini-2.5-flash', 'gemini-2.5-pro',
		'minimax-text-01', 'minimax-m1', 'minimax-m2.5', 'minimax-m2.5-highspeed'
	])('returns true for "%s"', (model) => {
		expect(isAIModel(model)).toBe(true);
	});

	it('returns false for invalid model', () => {
		expect(isAIModel('gpt-99')).toBe(false);
	});

	it('returns false for non-string', () => {
		expect(isAIModel(123)).toBe(false);
		expect(isAIModel(null)).toBe(false);
	});
});

describe('resolveDefaultAIModel', () => {
	it('defaults to gpt-4o when AI_MODEL is not set', () => {
		expect(resolveDefaultAIModel()).toBe('gpt-4o');
	});

	it('returns configured model', () => {
		setEnv({ AI_MODEL: 'deepseek' });
		expect(resolveDefaultAIModel()).toBe('deepseek');
	});

	it('maps deepseek-chat alias to deepseek', () => {
		setEnv({ AI_MODEL: 'deepseek-chat' });
		expect(resolveDefaultAIModel()).toBe('deepseek');
	});

	it('falls back to gpt-4o for invalid model', () => {
		setEnv({ AI_MODEL: 'invalid-model' });
		expect(resolveDefaultAIModel()).toBe('gpt-4o');
	});

	it('trims whitespace from AI_MODEL', () => {
		setEnv({ AI_MODEL: '  gpt-4o  ' });
		expect(resolveDefaultAIModel()).toBe('gpt-4o');
	});
});

describe('getModelConfig', () => {
	it('returns correct config for gpt-4o', () => {
		const config = getModelConfig('gpt-4o');
		expect(config.provider).toBe('openai');
		expect(config.apiModel).toBe('gpt-4o');
		expect(config.supportsImageInput).toBe(true);
	});

	it('returns correct config for deepseek', () => {
		const config = getModelConfig('deepseek');
		expect(config.provider).toBe('deepseek');
		expect(config.apiModel).toBe('deepseek-chat');
		expect(config.supportsImageInput).toBe(false);
	});

	it('returns correct config for claude-sonnet', () => {
		const config = getModelConfig('claude-sonnet');
		expect(config.provider).toBe('anthropic');
		expect(config.supportsImageInput).toBe(true);
	});

	it('returns correct config for gemini-2.5-flash', () => {
		const config = getModelConfig('gemini-2.5-flash');
		expect(config.provider).toBe('google');
		expect(config.supportsImageInput).toBe(true);
	});

	it('o3-mini does not support image input', () => {
		expect(getModelConfig('o3-mini').supportsImageInput).toBe(false);
	});

	it('returns correct config for minimax-m2.5', () => {
		const config = getModelConfig('minimax-m2.5');
		expect(config.provider).toBe('minimax');
		expect(config.apiModel).toBe('MiniMax-M2.5');
		expect(config.supportsImageInput).toBe(false);
	});
});

describe('getClientForModel', () => {
	it('returns client for gpt-4o with API key', () => {
		setEnv({ OPENAI_API_KEY: 'sk-test' });
		const result = getClientForModel('gpt-4o');
		expect(result.apiModel).toBe('gpt-4o');
		expect(result.provider).toBe('openai');
		expect(result.client).toBeDefined();
	});

	it('throws when API key is missing', () => {
		expect(() => getClientForModel('gpt-4o')).toThrow('OPENAI_API_KEY is not configured');
	});

	it('returns client for deepseek with API key', () => {
		setEnv({ DEEPSEEK_API_KEY: 'sk-deep' });
		const result = getClientForModel('deepseek');
		expect(result.provider).toBe('deepseek');
		expect(result.apiModel).toBe('deepseek-chat');
	});

	it('throws for anthropic without key', () => {
		expect(() => getClientForModel('claude-sonnet')).toThrow('ANTHROPIC_API_KEY');
	});

	it('throws for google without key', () => {
		expect(() => getClientForModel('gemini-2.5-flash')).toThrow('GOOGLE_AI_API_KEY');
	});
});

describe('getClientWithFallback', () => {
	it('uses primary model when key is available', () => {
		setEnv({ OPENAI_API_KEY: 'sk-test' });
		const result = getClientWithFallback('gpt-4o', ['deepseek']);
		expect(result.model).toBe('gpt-4o');
	});

	it('falls back when primary key is missing', () => {
		setEnv({ DEEPSEEK_API_KEY: 'sk-deep' });
		const result = getClientWithFallback('gpt-4o', ['deepseek']);
		expect(result.model).toBe('deepseek');
	});

	it('throws when no keys are available', () => {
		expect(() => getClientWithFallback('gpt-4o', ['deepseek', 'claude-sonnet'])).toThrow('No AI provider available');
	});

	it('tries fallbacks in order', () => {
		setEnv({ ANTHROPIC_API_KEY: 'sk-ant-test' });
		const result = getClientWithFallback('gpt-4o', ['deepseek', 'claude-sonnet']);
		expect(result.model).toBe('claude-sonnet');
	});
});
