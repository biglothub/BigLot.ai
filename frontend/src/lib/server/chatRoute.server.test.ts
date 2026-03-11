import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockClient, textChunks } from '$lib/__test__/helpers/mockOpenAI';

const {
	checkRateLimitMock,
	resolveChatModelRuntimeMock,
	createChatRecordMock,
	deleteChatRecordMock,
	saveChatMessageMock,
	validateBiglotUserIdMock,
	buildChatTitleMock,
	createAgentRunMock,
	updateAgentRunMock,
	logToolExecutionMock,
	upsertAgentStepRunMock,
	classifyChatRouteMock,
	shouldEnablePlanningMock,
	getSystemPromptMock,
	getCustomBotSystemPromptMock,
	normalizeAgentModeMock,
	getMemoryContextMock,
	runWithMemoryToolUserIdMock,
	getSupabaseAdminClientMock
} = vi.hoisted(() => ({
	checkRateLimitMock: vi.fn(),
	resolveChatModelRuntimeMock: vi.fn(),
	createChatRecordMock: vi.fn(),
	deleteChatRecordMock: vi.fn(),
	saveChatMessageMock: vi.fn(),
	validateBiglotUserIdMock: vi.fn(),
	buildChatTitleMock: vi.fn(),
	createAgentRunMock: vi.fn(),
	updateAgentRunMock: vi.fn(),
	logToolExecutionMock: vi.fn(),
	upsertAgentStepRunMock: vi.fn(),
	classifyChatRouteMock: vi.fn(),
	shouldEnablePlanningMock: vi.fn(),
	getSystemPromptMock: vi.fn(),
	getCustomBotSystemPromptMock: vi.fn(),
	normalizeAgentModeMock: vi.fn(),
	getMemoryContextMock: vi.fn(),
	runWithMemoryToolUserIdMock: vi.fn(),
	getSupabaseAdminClientMock: vi.fn()
}));

vi.mock('$lib/server/rateLimiter.server', () => ({
	checkRateLimit: checkRateLimitMock,
	RATE_LIMITS: { chat: {} }
}));

vi.mock('$lib/server/chatModelRuntime.server', () => ({
	resolveChatModelRuntime: resolveChatModelRuntimeMock
}));

vi.mock('$lib/server/chatPersistence.server', () => ({
	buildChatTitle: buildChatTitleMock,
	createChatRecord: createChatRecordMock,
	deleteChatRecord: deleteChatRecordMock,
	saveChatMessage: saveChatMessageMock,
	validateBiglotUserId: validateBiglotUserIdMock
}));

vi.mock('$lib/server/agentObservability.server', () => ({
	createAgentRun: createAgentRunMock,
	updateAgentRun: updateAgentRunMock,
	logToolExecution: logToolExecutionMock,
	upsertAgentStepRun: upsertAgentStepRunMock
}));

vi.mock('$lib/server/chatRouting.server', () => ({
	classifyChatRoute: classifyChatRouteMock,
	shouldEnablePlanning: shouldEnablePlanningMock
}));

vi.mock('$lib/agent/systemPrompts', () => ({
	getSystemPrompt: getSystemPromptMock,
	getCustomBotSystemPrompt: getCustomBotSystemPromptMock,
	normalizeAgentMode: normalizeAgentModeMock
}));

vi.mock('$lib/server/memory.server', () => ({
	getMemoryContext: getMemoryContextMock
}));

vi.mock('$lib/server/tools/memory.tool', () => ({
	runWithMemoryToolUserId: runWithMemoryToolUserIdMock
}));

vi.mock('$lib/server/supabaseAdmin.server', () => ({
	getSupabaseAdminClient: getSupabaseAdminClientMock
}));

vi.mock('$lib/server/agentLoop.server', () => ({
	runAgentLoop: vi.fn()
}));

vi.mock('$lib/server/discussionLoop.server', () => ({
	runDiscussionLoop: vi.fn()
}));

import { POST } from '../../routes/api/chat/+server';

function buildClient(text: string) {
	return {
		client: createMockClient([textChunks(text)]) as any,
		apiModel: 'gpt-4o-mini',
		provider: 'openai',
		supportsImageInput: false
	};
}

function buildRequest(body: Record<string, unknown>) {
	return {
		request: new Request('https://biglot.test/api/chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		getClientAddress: () => '127.0.0.1'
	} as Parameters<typeof POST>[0];
}

describe('POST /api/chat', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		checkRateLimitMock.mockReturnValue({ allowed: true });
		validateBiglotUserIdMock.mockImplementation((value: string) => value);
		buildChatTitleMock.mockReturnValue('Hello');
		getSystemPromptMock.mockReturnValue('system');
		getCustomBotSystemPromptMock.mockReturnValue('system');
		normalizeAgentModeMock.mockReturnValue('coach');
		classifyChatRouteMock.mockReturnValue('direct_answer');
		shouldEnablePlanningMock.mockReturnValue(false);
		getMemoryContextMock.mockResolvedValue(null);
		runWithMemoryToolUserIdMock.mockImplementation((_userId: string, callback: () => unknown) => callback());
		createAgentRunMock.mockResolvedValue(null);
		updateAgentRunMock.mockResolvedValue(undefined);
		logToolExecutionMock.mockResolvedValue(undefined);
		upsertAgentStepRunMock.mockResolvedValue(undefined);
		getSupabaseAdminClientMock.mockReturnValue({
			from: vi.fn(() => ({
				select: vi.fn().mockReturnThis(),
				eq: vi.fn().mockReturnThis(),
				single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
			}))
		});
		resolveChatModelRuntimeMock.mockReturnValue({
			selectedModel: 'gpt-4o-mini',
			runModelLabel: 'gpt-4o-mini',
			runProviderLabel: 'openai',
			clientBundle: buildClient('Hello back')
		});
	});

	it('emits chat_created and returns the persisted assistant message id for a new chat', async () => {
		createChatRecordMock.mockResolvedValue({
			id: 'chat-1',
			title: 'Hello',
			created_at: '2026-03-11T12:00:00.000Z'
		});
		saveChatMessageMock
			.mockResolvedValueOnce({ id: 'user-msg-1' })
			.mockResolvedValueOnce({ id: 'assistant-msg-1' });

		const response = await POST(
			buildRequest({
				biglotUserId: 'user-12345',
				messages: [{ role: 'user', content: 'hello' }],
				mode: 'coach',
				chatMode: 'normal'
			})
		);

		expect(response.status).toBe(200);
		const body = await response.text();

		expect(body).toContain('event: chat_created');
		expect(body).toContain('"chatId":"chat-1"');
		expect(body).toContain('"messageId":"assistant-msg-1"');
		expect(saveChatMessageMock).toHaveBeenCalledTimes(2);
		expect(createChatRecordMock).toHaveBeenCalledWith({
			biglotUserId: 'user-12345',
			title: 'Hello'
		});
	});

	it('returns a visible JSON error and cleans up the new chat when user-message persistence fails', async () => {
		createChatRecordMock.mockResolvedValue({
			id: 'chat-1',
			title: 'Hello',
			created_at: '2026-03-11T12:00:00.000Z'
		});
		saveChatMessageMock.mockRejectedValueOnce(new Error('user insert failed'));

		const response = await POST(
			buildRequest({
				biglotUserId: 'user-12345',
				messages: [{ role: 'user', content: 'hello' }],
				mode: 'coach',
				chatMode: 'normal'
			})
		);

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({ error: 'user insert failed' });
		expect(deleteChatRecordMock).toHaveBeenCalledWith({
			chatId: 'chat-1',
			biglotUserId: 'user-12345'
		});
	});

	it('surfaces assistant-message persistence failures after streaming completes', async () => {
		saveChatMessageMock
			.mockResolvedValueOnce({ id: 'user-msg-1' })
			.mockRejectedValueOnce(new Error('assistant save failed'));

		const response = await POST(
			buildRequest({
				chatId: 'chat-1',
				biglotUserId: 'user-12345',
				messages: [{ role: 'user', content: 'hello' }],
				mode: 'coach',
				chatMode: 'normal'
			})
		);

		const body = await response.text();
		expect(body).toContain('event: error');
		expect(body).toContain('assistant save failed');
		expect(body).toContain('event: done');
	});

	it('emits provider errors as SSE error events', async () => {
		saveChatMessageMock.mockResolvedValueOnce({ id: 'user-msg-1' });
		resolveChatModelRuntimeMock.mockReturnValue({
			selectedModel: 'gpt-4o-mini',
			runModelLabel: 'gpt-4o-mini',
			runProviderLabel: 'openai',
			clientBundle: {
				client: {
					chat: {
						completions: {
							create: vi.fn(async () => {
								throw new Error('provider offline');
							})
						}
					}
				},
				apiModel: 'gpt-4o-mini',
				provider: 'openai',
				supportsImageInput: false
			}
		});

		const response = await POST(
			buildRequest({
				chatId: 'chat-1',
				biglotUserId: 'user-12345',
				messages: [{ role: 'user', content: 'hello' }],
				mode: 'coach',
				chatMode: 'normal'
			})
		);

		const body = await response.text();
		expect(body).toContain('event: error');
		expect(body).toContain('provider offline');
	});
});
