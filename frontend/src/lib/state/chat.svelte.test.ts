import { beforeEach, describe, expect, it, vi } from 'vitest';

class LocalStorageMock {
	private store = new Map<string, string>();

	clear() {
		this.store.clear();
	}

	getItem(key: string) {
		return this.store.get(key) ?? null;
	}

	setItem(key: string, value: string) {
		this.store.set(key, value);
	}

	removeItem(key: string) {
		this.store.delete(key);
	}
}

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

function sseResponse(events: string[]) {
	const text = events.join('');
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(new TextEncoder().encode(text));
			controller.close();
		}
	});

	return new Response(stream, {
		status: 200,
		headers: { 'Content-Type': 'text/event-stream' }
	});
}

async function loadChatState() {
	vi.resetModules();
	const module = await import('./chat.svelte.ts');
	return module.chatState;
}

describe('chatState', () => {
	beforeEach(() => {
		const localStorageMock = new LocalStorageMock();
		localStorageMock.setItem('biglot.userId', 'user-12345');
		vi.stubGlobal('localStorage', localStorageMock);
		vi.stubGlobal('fetch', vi.fn());
	});

	it('updates the current chat from chat_created and stores the assistant message id from done', async () => {
		const fetchMock = vi.mocked(fetch);
		fetchMock.mockResolvedValueOnce(
			sseResponse([
				'event: chat_created\ndata: {"chatId":"chat-1","title":"Hello"}\n\n',
				'event: run_start\ndata: {"runId":null,"routeType":"direct_answer","mode":"coach","chatMode":"normal","model":"gpt-4o-mini"}\n\n',
				'event: text_delta\ndata: {"content":"Hello there"}\n\n',
				'event: done\ndata: {"runId":null,"routeType":"direct_answer","contentBlocks":[],"messageId":"assistant-msg-1"}\n\n'
			])
		);

		const chatState = await loadChatState();
		await chatState.sendMessage('hello');

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/chat');
		expect(chatState.currentChatId).toBe('chat-1');
		expect(chatState.allChats[0]).toMatchObject({ id: 'chat-1', title: 'Hello' });
		expect(chatState.messages).toHaveLength(2);
		expect(chatState.messages[0]).toMatchObject({ role: 'user', content: 'hello' });
		expect(chatState.messages[1]).toMatchObject({
			role: 'assistant',
			content: 'Hello there',
			id: 'assistant-msg-1'
		});
	});

	it('surfaces the real API error message when /api/chat returns non-ok', async () => {
		const fetchMock = vi.mocked(fetch);
		fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'permission denied' }, 500));

		const chatState = await loadChatState();
		await chatState.sendMessage('hello');

		expect(chatState.messages).toHaveLength(2);
		expect(chatState.messages[1]?.content).toContain('permission denied');
		expect(chatState.lastDbError).toBe('permission denied');
	});

	it('loads chats, loads a specific chat, and deletes through the server routes', async () => {
		const fetchMock = vi.mocked(fetch);
		fetchMock
			.mockResolvedValueOnce(
				jsonResponse({
					chats: [{ id: 'chat-1', title: 'First', created_at: '2026-03-11T00:00:00.000Z' }]
				})
			)
			.mockResolvedValueOnce(
				jsonResponse({
					messages: [
						{
							id: 'msg-1',
							role: 'assistant',
							content: 'Stored reply',
							run_id: 'run-1',
							content_blocks: []
						}
					]
				})
			)
			.mockResolvedValueOnce(jsonResponse({ ok: true }));

		const chatState = await loadChatState();
		await chatState.loadAllChats();
		await chatState.loadChat('chat-1');
		await chatState.deleteChat('chat-1');

		expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/chats?biglotUserId=user-12345');
		expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/chats/chat-1?biglotUserId=user-12345');
		expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/chats/chat-1');
		expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: 'DELETE' });
		expect(chatState.currentChatId).toBeNull();
		expect(chatState.allChats).toEqual([]);
		expect(chatState.messages).toEqual([]);
	});
});
