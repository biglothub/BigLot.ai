import type { AgentMode } from '$lib/agent/systemPrompts';
import type { AgentRouteType } from '$lib/types/contentBlock';

type ChatMode = 'normal' | 'agent';

type RouteInput = {
	chatMode: ChatMode;
	mode: AgentMode;
	lastUserMessage: string;
	hasImageInput: boolean;
};

const MULTI_STEP_SIGNALS = [
	'วิเคราะห์',
	'วางแผน',
	'เปรียบเทียบ',
	'full analysis',
	'full report',
	'market outlook',
	'scenario',
	'macro',
	'ทอง',
	'gold',
	'portfolio'
];

const SINGLE_TOOL_SIGNALS = [
	'price',
	'ราคา',
	'chart',
	'กราฟ',
	'rsi',
	'macd',
	'fear',
	'greed',
	'dxy',
	'yield',
	'cot',
	'xau',
	'btc',
	'eth'
];

const LATIN_RE = /^[a-z0-9]/i;

/** Use word-boundary regex for short Latin keywords, includes() for Thai/long phrases */
function signalMatches(text: string, signal: string): boolean {
	if (signal.length <= 4 && LATIN_RE.test(signal)) {
		const re = new RegExp(`(?:^|[\\s,;:.!?()\\[\\]{}"\\/'#@])${signal}(?:$|[\\s,;:.!?()\\[\\]{}"\\/'#@])`, 'i');
		return re.test(text);
	}
	return text.includes(signal);
}

export function classifyChatRoute(input: RouteInput): AgentRouteType {
	if (input.chatMode !== 'agent') return 'direct_answer';
	if (input.hasImageInput) return 'direct_answer';

	const text = input.lastUserMessage.toLowerCase().trim();
	if (!text) return 'direct_answer';

	if (input.mode === 'gold' || input.mode === 'macro' || input.mode === 'portfolio') {
		return 'plan_then_execute';
	}

	if (MULTI_STEP_SIGNALS.some((signal) => signalMatches(text, signal))) {
		return 'plan_then_execute';
	}

	if (SINGLE_TOOL_SIGNALS.some((signal) => signalMatches(text, signal))) {
		return 'single_tool';
	}

	return text.length > 180 ? 'plan_then_execute' : 'direct_answer';
}

export function shouldEnablePlanning(chatMode: ChatMode, routeType: AgentRouteType): boolean {
	return chatMode === 'agent' && routeType === 'plan_then_execute';
}
