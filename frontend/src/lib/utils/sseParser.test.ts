import { describe, it, expect } from 'vitest';
import { parseSSEStream, type ParsedSSEEvent } from './sseParser';

/** Helper: create a ReadableStream from string chunks */
function createStream(chunks: string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	return new ReadableStream({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(encoder.encode(chunk));
			}
			controller.close();
		}
	});
}

/** Collect all events from the async generator */
async function collectEvents(stream: ReadableStream<Uint8Array>): Promise<ParsedSSEEvent[]> {
	const events: ParsedSSEEvent[] = [];
	for await (const event of parseSSEStream(stream)) {
		events.push(event);
	}
	return events;
}

describe('parseSSEStream', () => {
	it('parses a single complete event', async () => {
		const stream = createStream(['event: text_delta\ndata: {"content":"hi"}\n\n']);
		const events = await collectEvents(stream);
		expect(events).toEqual([{ event: 'text_delta', data: '{"content":"hi"}' }]);
	});

	it('parses multiple events in one chunk', async () => {
		const stream = createStream([
			'event: text_delta\ndata: hello\n\nevent: done\ndata: {}\n\n'
		]);
		const events = await collectEvents(stream);
		expect(events).toHaveLength(2);
		expect(events[0]).toEqual({ event: 'text_delta', data: 'hello' });
		expect(events[1]).toEqual({ event: 'done', data: '{}' });
	});

	it('handles events split across chunks', async () => {
		const stream = createStream([
			'event: text_de',
			'lta\ndata: split\n',
			'\n'
		]);
		const events = await collectEvents(stream);
		expect(events).toEqual([{ event: 'text_delta', data: 'split' }]);
	});

	it('ignores comment lines (keepalive)', async () => {
		const stream = createStream([': keepalive\n\nevent: text_delta\ndata: real\n\n']);
		const events = await collectEvents(stream);
		expect(events).toEqual([{ event: 'text_delta', data: 'real' }]);
	});

	it('yields nothing for empty stream', async () => {
		const stream = createStream([]);
		const events = await collectEvents(stream);
		expect(events).toHaveLength(0);
	});

	it('defaults event type to "message" when no event line', async () => {
		const stream = createStream(['data: no-event-type\n\n']);
		const events = await collectEvents(stream);
		expect(events).toEqual([{ event: 'message', data: 'no-event-type' }]);
	});

	it('handles remaining buffer at end of stream', async () => {
		// No trailing \n\n — buffer should be flushed
		const stream = createStream(['event: final\ndata: last']);
		const events = await collectEvents(stream);
		expect(events).toEqual([{ event: 'final', data: 'last' }]);
	});

	it('skips events with no data', async () => {
		const stream = createStream(['event: empty\n\nevent: real\ndata: value\n\n']);
		const events = await collectEvents(stream);
		// First event has no data line, should be skipped
		expect(events).toEqual([{ event: 'real', data: 'value' }]);
	});

	it('concatenates multiple data lines', async () => {
		const stream = createStream(['event: multi\ndata: part1\ndata: part2\n\n']);
		const events = await collectEvents(stream);
		expect(events).toEqual([{ event: 'multi', data: 'part1part2' }]);
	});
});
