import { describe, it, expect } from 'vitest';
import { normalizeAgentMode, getSystemPrompt } from './systemPrompts';

describe('normalizeAgentMode', () => {
	it.each([
		'coach', 'recovery', 'analyst', 'pinescript', 'gold', 'macro', 'portfolio'
	])('returns "%s" for valid mode "%s"', (mode) => {
		expect(normalizeAgentMode(mode)).toBe(mode);
	});

	it('defaults to "coach" for undefined', () => {
		expect(normalizeAgentMode(undefined)).toBe('coach');
	});

	it('defaults to "coach" for null', () => {
		expect(normalizeAgentMode(null)).toBe('coach');
	});

	it('defaults to "coach" for empty string', () => {
		expect(normalizeAgentMode('')).toBe('coach');
	});

	it('defaults to "coach" for invalid string', () => {
		expect(normalizeAgentMode('invalid')).toBe('coach');
	});

	it('defaults to "coach" for number', () => {
		expect(normalizeAgentMode(123)).toBe('coach');
	});

	it('defaults to "coach" for object', () => {
		expect(normalizeAgentMode({})).toBe('coach');
	});
});

describe('getSystemPrompt', () => {
	it('returns a string', () => {
		expect(typeof getSystemPrompt('coach')).toBe('string');
	});

	// Mode-specific content
	it('gold mode includes XAUUSD', () => {
		expect(getSystemPrompt('gold')).toContain('XAUUSD');
	});

	it('pinescript mode includes @version=6', () => {
		expect(getSystemPrompt('pinescript')).toContain('//@version=6');
	});

	it('macro mode includes global macro', () => {
		const prompt = getSystemPrompt('macro').toLowerCase();
		expect(prompt).toContain('global macro');
	});

	it('portfolio mode includes portfolio', () => {
		expect(getSystemPrompt('portfolio').toLowerCase()).toContain('portfolio');
	});

	it('recovery mode includes recovery', () => {
		expect(getSystemPrompt('recovery')).toContain('Recovery');
	});

	it('analyst mode includes analyst', () => {
		expect(getSystemPrompt('analyst')).toContain('Analyst');
	});

	it('coach mode includes Trading Coach', () => {
		expect(getSystemPrompt('coach')).toContain('Trading Coach');
	});

	// Tool addendum always included
	it('always includes tool use addendum', () => {
		expect(getSystemPrompt('coach')).toContain('get_market_data');
		expect(getSystemPrompt('gold')).toContain('web_search');
	});

	// Planning addendum
	it('includes planning protocol when planningEnabled=true', () => {
		expect(getSystemPrompt('coach', true)).toContain('PLANNING PROTOCOL');
	});

	it('does NOT include planning protocol by default', () => {
		expect(getSystemPrompt('coach')).not.toContain('PLANNING PROTOCOL');
	});

	// Deep research addendum
	it('includes deep research protocol when isDeepResearch=true', () => {
		expect(getSystemPrompt('coach', false, true)).toContain('DEEP RESEARCH PROTOCOL');
	});

	it('deep research takes precedence over planning', () => {
		const prompt = getSystemPrompt('coach', true, true);
		expect(prompt).toContain('DEEP RESEARCH PROTOCOL');
		expect(prompt).not.toContain('PLANNING PROTOCOL');
	});

	it('does NOT include deep research by default', () => {
		expect(getSystemPrompt('coach')).not.toContain('DEEP RESEARCH PROTOCOL');
	});

	// Planning with deep_research=false explicitly
	it('includes planning when planningEnabled=true and isDeepResearch=false', () => {
		const prompt = getSystemPrompt('coach', true, false);
		expect(prompt).toContain('PLANNING PROTOCOL');
		expect(prompt).not.toContain('DEEP RESEARCH PROTOCOL');
	});
});
