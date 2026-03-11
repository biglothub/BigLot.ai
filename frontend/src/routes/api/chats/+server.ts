import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	buildChatTitle,
	createChatRecord,
	listChats,
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

export const GET: RequestHandler = async ({ url }) => {
	const biglotUserId = url.searchParams.get('biglotUserId');
	try {
		const userId = validateBiglotUserId(biglotUserId);
		const chats = await listChats(userId);
		return json({ chats });
	} catch (error) {
		const status = getErrorStatus(error, 400);
		return json({ error: getErrorMessage(error, 'Failed to load chats') }, { status });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	let payload: Record<string, unknown>;
	try {
		payload = (await request.json()) as Record<string, unknown>;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	try {
		const biglotUserId = validateBiglotUserId(payload.biglotUserId);
		const title = buildChatTitle({
			content: typeof payload.title === 'string' ? payload.title : '',
			fileName: typeof payload.fileName === 'string' ? payload.fileName : undefined,
			hasImage: payload.hasImage === true
		});
		const chat = await createChatRecord({ biglotUserId, title });
		return json({ chat }, { status: 201 });
	} catch (error) {
		const status = getErrorStatus(error, 400);
		return json({ error: getErrorMessage(error, 'Failed to create chat') }, { status });
	}
};
