import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { checkRateLimit, RATE_LIMITS } from '$lib/server/rateLimiter.server';
import { saveMessageFeedback } from '$lib/server/agentObservability.server';
import { getSupabaseAdminClient } from '$lib/server/supabaseAdmin.server';

function isFeedbackValue(value: unknown): value is 'up' | 'down' {
	return value === 'up' || value === 'down';
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const clientIp = getClientAddress() || 'unknown';
	const rateLimitResult = checkRateLimit(`${clientIp}:feedback`, RATE_LIMITS.default);

	if (!rateLimitResult.allowed) {
		return json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
	}

	let payload: Record<string, unknown>;
	try {
		payload = (await request.json()) as Record<string, unknown>;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const messageId = typeof payload.messageId === 'string' ? payload.messageId : null;
	const runId = typeof payload.runId === 'string' ? payload.runId : null;
	const biglotUserId = typeof payload.biglotUserId === 'string' ? payload.biglotUserId : null;
	const feedback = payload.feedback;
	const reason = typeof payload.reason === 'string' ? payload.reason : undefined;

	if (!messageId) {
		return json({ error: 'messageId is required' }, { status: 400 });
	}

	if (!isFeedbackValue(feedback)) {
		return json({ error: 'feedback must be "up" or "down"' }, { status: 400 });
	}

	// Validate message exists (and optionally check ownership)
	try {
		const supabase = getSupabaseAdminClient();
		const { data: message, error: msgError } = await supabase
			.from('messages')
			.select('id, chat_id')
			.eq('id', messageId)
			.single();

		if (msgError || !message) {
			return json({ error: 'Message not found' }, { status: 404 });
		}

		// Soft ownership check — only enforce if both biglotUserId and chat ownership exist
		if (biglotUserId && message.chat_id) {
			const { data: chat } = await supabase
				.from('chats')
				.select('biglot_user_id')
				.eq('id', message.chat_id)
				.single();

			if (chat?.biglot_user_id && chat.biglot_user_id !== biglotUserId) {
				return json({ error: 'Message not found' }, { status: 404 });
			}
		}
	} catch {
		// If admin client unavailable, skip validation
	}

	await saveMessageFeedback({
		messageId,
		runId,
		biglotUserId,
		feedback,
		reason
	});

	return json({ ok: true });
};
