import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	deleteChatRecord,
	getChatMessages,
	validateBiglotUserId
} from '$lib/server/chatPersistence.server';

function getErrorStatus(error: unknown, fallback = 500): number {
	if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number') {
		return error.status;
	}

	return fallback;
}

function getErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const biglotUserId = validateBiglotUserId(url.searchParams.get('biglotUserId'));
		const messages = await getChatMessages({ chatId: params.id, biglotUserId });
		return json({ messages });
	} catch (error) {
		const status = getErrorStatus(error, 400);
		return json({ error: getErrorMessage(error, 'Failed to load chat') }, { status });
	}
};

export const DELETE: RequestHandler = async ({ params, request }) => {
	let payload: Record<string, unknown>;
	try {
		payload = (await request.json()) as Record<string, unknown>;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	try {
		const biglotUserId = validateBiglotUserId(payload.biglotUserId);
		await deleteChatRecord({ chatId: params.id, biglotUserId });
		return json({ ok: true });
	} catch (error) {
		const status = getErrorStatus(error, 400);
		return json({ error: getErrorMessage(error, 'Failed to delete chat') }, { status });
	}
};
