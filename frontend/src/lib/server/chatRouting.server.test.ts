import { describe, it, expect } from 'vitest';
import { classifyChatRoute, shouldEnablePlanning } from './chatRouting.server';

describe('classifyChatRoute', () => {
	const base = { chatMode: 'agent' as const, mode: 'coach' as const, hasImageInput: false };

	// --- Early exits ---

	it('returns direct_answer for normal chat mode', () => {
		expect(classifyChatRoute({ ...base, chatMode: 'normal', lastUserMessage: 'gold price' })).toBe('direct_answer');
	});

	it('returns direct_answer for discussion chat mode', () => {
		expect(classifyChatRoute({ ...base, chatMode: 'discussion', lastUserMessage: 'gold price' })).toBe('direct_answer');
	});

	it('returns direct_answer when image input is present', () => {
		expect(classifyChatRoute({ ...base, hasImageInput: true, lastUserMessage: 'what is this chart' })).toBe('direct_answer');
	});

	it('returns direct_answer for empty message', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: '' })).toBe('direct_answer');
	});

	it('returns direct_answer for whitespace-only message', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: '   ' })).toBe('direct_answer');
	});

	// --- Deep research signals (highest priority) ---

	it('detects "deep research" signal', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'deep research on gold' })).toBe('deep_research');
	});

	it('detects "research report" signal', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'give me a research report' })).toBe('deep_research');
	});

	it('detects "comprehensive analysis" signal', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'comprehensive analysis of BTC' })).toBe('deep_research');
	});

	it('detects Thai deep research signal "วิจัยเชิงลึก"', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'วิจัยเชิงลึก ทองคำ' })).toBe('deep_research');
	});

	it('detects Thai "วิจัย" signal', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'วิจัยทองคำ' })).toBe('deep_research');
	});

	it('deep research takes priority over mode-based routing', () => {
		expect(classifyChatRoute({ ...base, mode: 'gold', lastUserMessage: 'deep research on gold' })).toBe('deep_research');
	});

	// --- Mode-based routing (gold/macro/portfolio) ---

	it('returns plan_then_execute for gold mode', () => {
		expect(classifyChatRoute({ ...base, mode: 'gold', lastUserMessage: 'hello' })).toBe('plan_then_execute');
	});

	it('returns plan_then_execute for macro mode', () => {
		expect(classifyChatRoute({ ...base, mode: 'macro', lastUserMessage: 'hello' })).toBe('plan_then_execute');
	});

	it('returns plan_then_execute for portfolio mode', () => {
		expect(classifyChatRoute({ ...base, mode: 'portfolio', lastUserMessage: 'hello' })).toBe('plan_then_execute');
	});

	// --- Multi-step signals ---

	it('detects Thai multi-step signal "วิเคราะห์"', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'วิเคราะห์ตลาด' })).toBe('plan_then_execute');
	});

	it('detects "full analysis" signal', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'full analysis of the market' })).toBe('plan_then_execute');
	});

	it('detects "fomc" signal with word boundary', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'what about FOMC impact' })).toBe('plan_then_execute');
	});

	it('detects "scenario" signal', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'give me a scenario analysis' })).toBe('plan_then_execute');
	});

	// --- Single tool signals ---

	it('detects "price" signal', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'BTC price now' })).toBe('single_tool');
	});

	it('detects Thai "ราคา" signal (but "ทอง" is multi-step, which has priority)', () => {
		// "ราคาทอง" contains both "ราคา" (single_tool) and "ทอง" (multi_step)
		// Multi-step is checked first, so plan_then_execute wins
		expect(classifyChatRoute({ ...base, lastUserMessage: 'ราคาทอง' })).toBe('plan_then_execute');
	});

	it('detects Thai "ราคา" signal without multi-step overlap', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'ราคา BTC' })).toBe('single_tool');
	});

	it('detects "rsi" signal with word boundary', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'show me RSI' })).toBe('single_tool');
	});

	it('detects "btc" with word boundary', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'btc now' })).toBe('single_tool');
	});

	it('detects "eth" with word boundary', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'eth balance' })).toBe('single_tool');
	});

	it('detects "news" signal', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'latest news' })).toBe('single_tool');
	});

	it('detects Thai "ข่าว" signal', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'ข่าววันนี้' })).toBe('single_tool');
	});

	// --- Word boundary edge cases ---

	it('does NOT match "eth" inside "something"', () => {
		// "something" contains "eth" but should NOT trigger word boundary match
		expect(classifyChatRoute({ ...base, lastUserMessage: 'something is happening' })).not.toBe('single_tool');
	});

	it('does NOT match "eth" inside "fetch"', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'fetch data from server' })).not.toBe('single_tool');
	});

	it('matches "cot" at start of sentence', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'cot data please' })).toBe('single_tool');
	});

	it('matches "dxy" followed by punctuation', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'what is dxy?' })).toBe('single_tool');
	});

	// --- Length-based fallback ---

	it('returns plan_then_execute for messages >180 chars without signals', () => {
		const longMsg = 'a'.repeat(181);
		expect(classifyChatRoute({ ...base, lastUserMessage: longMsg })).toBe('plan_then_execute');
	});

	it('returns direct_answer for messages <=180 chars without signals', () => {
		const shortMsg = 'hello there how are you doing today';
		expect(classifyChatRoute({ ...base, lastUserMessage: shortMsg })).toBe('direct_answer');
	});

	it('returns direct_answer for exactly 180 chars', () => {
		const msg = 'a'.repeat(180);
		expect(classifyChatRoute({ ...base, lastUserMessage: msg })).toBe('direct_answer');
	});

	// --- Priority order ---

	it('deep_research > multi_step: "deep research วิเคราะห์"', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'deep research วิเคราะห์' })).toBe('deep_research');
	});

	it('multi_step > single_tool: "full analysis price chart"', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'full analysis with price chart' })).toBe('plan_then_execute');
	});

	// --- Case insensitive ---

	it('is case insensitive for signals', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'DEEP RESEARCH on gold' })).toBe('deep_research');
	});

	it('is case insensitive for single tool signals', () => {
		expect(classifyChatRoute({ ...base, lastUserMessage: 'BTC' })).toBe('single_tool');
	});
});

describe('shouldEnablePlanning', () => {
	it('returns true for agent + plan_then_execute', () => {
		expect(shouldEnablePlanning('agent', 'plan_then_execute')).toBe(true);
	});

	it('returns true for agent + deep_research', () => {
		expect(shouldEnablePlanning('agent', 'deep_research')).toBe(true);
	});

	it('returns false for agent + single_tool', () => {
		expect(shouldEnablePlanning('agent', 'single_tool')).toBe(false);
	});

	it('returns false for agent + direct_answer', () => {
		expect(shouldEnablePlanning('agent', 'direct_answer')).toBe(false);
	});

	it('returns false for normal mode even with plan_then_execute', () => {
		expect(shouldEnablePlanning('normal', 'plan_then_execute')).toBe(false);
	});

	it('returns false for discussion mode', () => {
		expect(shouldEnablePlanning('discussion', 'plan_then_execute')).toBe(false);
	});
});
