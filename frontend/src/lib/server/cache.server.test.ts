import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toolCache } from './cache.server';

describe('toolCache', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	describe('get / set', () => {
		it('returns null for missing key', () => {
			expect(toolCache.get('nonexistent')).toBeNull();
		});

		it('returns stored value within TTL', () => {
			toolCache.set('test-key', { price: 42 }, 60_000);
			expect(toolCache.get('test-key')).toEqual({ price: 42 });
		});

		it('returns null after TTL expires', () => {
			const now = Date.now();
			vi.spyOn(Date, 'now').mockReturnValue(now);

			toolCache.set('expire-key', 'data', 1000);

			// Advance time past TTL
			vi.spyOn(Date, 'now').mockReturnValue(now + 1001);
			expect(toolCache.get('expire-key')).toBeNull();
		});

		it('returns value at exactly TTL boundary (not expired)', () => {
			const now = Date.now();
			vi.spyOn(Date, 'now').mockReturnValue(now);

			toolCache.set('boundary-key', 'data', 1000);

			// At exactly TTL (expiresAt = now + 1000, check at now + 1000)
			vi.spyOn(Date, 'now').mockReturnValue(now + 1000);
			expect(toolCache.get('boundary-key')).toBe('data');
		});
	});

	describe('generateKey', () => {
		it('produces deterministic keys', () => {
			const key1 = toolCache.generateKey('tool_a', { x: 1, y: 2 });
			const key2 = toolCache.generateKey('tool_a', { x: 1, y: 2 });
			expect(key1).toBe(key2);
		});

		it('sorts args for consistent keys', () => {
			const key1 = toolCache.generateKey('tool_a', { b: 2, a: 1 });
			const key2 = toolCache.generateKey('tool_a', { a: 1, b: 2 });
			expect(key1).toBe(key2);
		});

		it('different tools produce different keys', () => {
			const key1 = toolCache.generateKey('tool_a', { x: 1 });
			const key2 = toolCache.generateKey('tool_b', { x: 1 });
			expect(key1).not.toBe(key2);
		});

		it('different args produce different keys', () => {
			const key1 = toolCache.generateKey('tool_a', { x: 1 });
			const key2 = toolCache.generateKey('tool_a', { x: 2 });
			expect(key1).not.toBe(key2);
		});

		it('includes tool name prefix', () => {
			const key = toolCache.generateKey('my_tool', { a: 1 });
			expect(key).toMatch(/^my_tool:/);
		});
	});
});
