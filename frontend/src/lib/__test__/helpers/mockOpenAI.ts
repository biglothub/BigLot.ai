import { vi } from 'vitest';

type MockChunk = {
	choices: Array<{
		delta: {
			content?: string;
			tool_calls?: Array<{
				index: number;
				id?: string;
				function?: { name?: string; arguments?: string };
			}>;
		};
		finish_reason?: string | null;
	}>;
	usage?: { prompt_tokens: number; completion_tokens: number };
};

/**
 * Create a mock OpenAI-like async iterable from an array of chunks.
 */
function createAsyncIterable(chunks: MockChunk[]): AsyncIterable<MockChunk> {
	return {
		[Symbol.asyncIterator]() {
			let index = 0;
			return {
				async next() {
					if (index < chunks.length) {
						return { done: false, value: chunks[index++] };
					}
					return { done: true, value: undefined };
				}
			};
		}
	};
}

/** Build chunks for a simple text response */
export function textChunks(text: string, finishReason = 'stop'): MockChunk[] {
	const chunks: MockChunk[] = [];
	// Split text into character groups for realistic streaming
	const chunkSize = Math.max(1, Math.ceil(text.length / 3));
	for (let i = 0; i < text.length; i += chunkSize) {
		chunks.push({
			choices: [{ delta: { content: text.slice(i, i + chunkSize) }, finish_reason: null }]
		});
	}
	// Final chunk with finish reason
	chunks.push({
		choices: [{ delta: {}, finish_reason: finishReason }]
	});
	return chunks;
}

/** Build chunks for a tool call response */
export function toolCallChunks(
	toolCalls: Array<{ id: string; name: string; arguments: string }>,
	prefixText = ''
): MockChunk[] {
	const chunks: MockChunk[] = [];

	if (prefixText) {
		chunks.push({
			choices: [{ delta: { content: prefixText }, finish_reason: null }]
		});
	}

	// Emit tool calls
	for (let i = 0; i < toolCalls.length; i++) {
		const tc = toolCalls[i];
		// First chunk introduces the tool call
		chunks.push({
			choices: [{
				delta: {
					tool_calls: [{
						index: i,
						id: tc.id,
						function: { name: tc.name, arguments: '' }
					}]
				},
				finish_reason: null
			}]
		});
		// Second chunk streams arguments
		chunks.push({
			choices: [{
				delta: {
					tool_calls: [{
						index: i,
						function: { arguments: tc.arguments }
					}]
				},
				finish_reason: null
			}]
		});
	}

	// Final chunk
	chunks.push({
		choices: [{ delta: {}, finish_reason: 'tool_calls' }]
	});
	return chunks;
}

/**
 * Create a mock OpenAI client.
 * Accepts a sequence of chunk arrays — one per call to create().
 */
export function createMockClient(callResponses: MockChunk[][]) {
	let callIndex = 0;

	return {
		chat: {
			completions: {
				create: vi.fn(async () => {
					const chunks = callResponses[callIndex] ?? textChunks('');
					callIndex++;
					return createAsyncIterable(chunks);
				})
			}
		}
	};
}

/**
 * Create a mock client for non-streaming (discussion eval) calls.
 */
export function createMockNonStreamingClient(responses: Array<{ content: string }>) {
	let callIndex = 0;

	return {
		chat: {
			completions: {
				create: vi.fn(async (params: any) => {
					if (params.stream) {
						// Streaming call — return async iterable
						const resp = responses[callIndex] ?? { content: '' };
						callIndex++;
						return createAsyncIterable(textChunks(resp.content));
					}
					// Non-streaming — return direct response
					const resp = responses[callIndex] ?? { content: '' };
					callIndex++;
					return {
						choices: [{ message: { content: resp.content } }]
					};
				})
			}
		}
	};
}
