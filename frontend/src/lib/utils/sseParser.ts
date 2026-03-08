// Client-side SSE parser for ReadableStream responses

export type ParsedSSEEvent = {
	event: string;
	data: string;
};

export async function* parseSSEStream(
	stream: ReadableStream<Uint8Array>
): AsyncGenerator<ParsedSSEEvent> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });

			// SSE events are separated by double newlines
			const parts = buffer.split('\n\n');
			// Keep the last part as it may be incomplete
			buffer = parts.pop() || '';

			for (const part of parts) {
				const trimmed = part.trim();
				if (!trimmed) continue;

				let eventType = 'message';
				let data = '';

				for (const line of trimmed.split('\n')) {
					if (line.startsWith('event:')) {
						eventType = line.slice(6).trim();
					} else if (line.startsWith('data:')) {
						data += line.slice(5).trim();
					} else if (line.startsWith(':')) {
						// Comment line, ignore (used for keep-alive)
					}
				}

				if (data) {
					yield { event: eventType, data };
				}
			}
		}

		// Process any remaining buffer
		if (buffer.trim()) {
			let eventType = 'message';
			let data = '';
			for (const line of buffer.trim().split('\n')) {
				if (line.startsWith('event:')) {
					eventType = line.slice(6).trim();
				} else if (line.startsWith('data:')) {
					data += line.slice(5).trim();
				}
			}
			if (data) {
				yield { event: eventType, data };
			}
		}
	} finally {
		reader.releaseLock();
	}
}
