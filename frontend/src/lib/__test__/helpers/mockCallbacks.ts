import { vi } from 'vitest';
import type { AgentCallbacks } from '$lib/server/agentLoop.server';
import type { DiscussionCallbacks } from '$lib/server/discussionLoop.server';

export function createAgentCallbacks(): AgentCallbacks {
	return {
		onTextDelta: vi.fn(),
		onToolStart: vi.fn(),
		onToolResult: vi.fn(),
		onPlanCreate: vi.fn(),
		onPlanStepUpdate: vi.fn(),
		onPlanComplete: vi.fn(),
		onHandoff: vi.fn(),
		onError: vi.fn()
	};
}

export function createDiscussionCallbacks(): DiscussionCallbacks {
	return {
		onDiscussionStart: vi.fn(),
		onTurnStart: vi.fn(),
		onTextDelta: vi.fn(),
		onTurnEnd: vi.fn(),
		onRoundSkipped: vi.fn(),
		onError: vi.fn()
	};
}
