import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getSupabaseAdminClient } from '$lib/server/supabaseAdmin.server';
import { isAIModel } from '$lib/server/aiProvider.server';
import { getAllTools } from '$lib/server/tools/registry';

import '$lib/server/tools/marketData.tool';
import '$lib/server/tools/charts.tool';
import '$lib/server/tools/gold.tool';
import '$lib/server/tools/macro.tool';
import '$lib/server/tools/cot.tool';
import '$lib/server/tools/crossAsset.tool';
import '$lib/server/tools/webSearch.tool';
import '$lib/server/tools/webExtract.tool';
import '$lib/server/tools/webCrawl.tool';
import '$lib/server/tools/memory.tool';

const MAX_STARTERS = 6;
const MAX_STARTER_LENGTH = 200;

function getValidToolNames(): Set<string> {
	return new Set(getAllTools().map((t) => t.name));
}

// PUT /api/bots/[id] — update a bot
export const PUT: RequestHandler = async ({ params, request }) => {
	const botId = params.id;
	let payload: Record<string, unknown>;
	try {
		payload = (await request.json()) as Record<string, unknown>;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const biglotUserId = typeof payload.biglotUserId === 'string' ? payload.biglotUserId : null;
	if (!biglotUserId) {
		return json({ error: 'biglotUserId is required' }, { status: 400 });
	}

	const supabase = getSupabaseAdminClient();

	// Verify ownership
	const { data: existing, error: fetchError } = await supabase
		.from('custom_bots')
		.select('biglot_user_id')
		.eq('id', botId)
		.eq('is_active', true)
		.single();

	if (fetchError || !existing) {
		return json({ error: 'Bot not found' }, { status: 404 });
	}
	if (existing.biglot_user_id !== biglotUserId) {
		return json({ error: 'Bot not found' }, { status: 404 });
	}

	// Build update object from allowed fields
	const validToolNames = getValidToolNames();
	const update: Record<string, unknown> = {};

	if ('name' in payload) {
		const name = payload.name;
		if (typeof name !== 'string' || name.length < 1 || name.length > 60) {
			return json({ error: 'name must be 1-60 characters' }, { status: 400 });
		}
		update.name = name;
	}

	if ('description' in payload) {
		const desc = payload.description;
		if (typeof desc !== 'string' || desc.length > 500) {
			return json({ error: 'description must be at most 500 characters' }, { status: 400 });
		}
		update.description = desc;
	}

	if ('avatar' in payload) {
		const avatar = payload.avatar;
		if (typeof avatar !== 'string' || avatar.length > 10) {
			return json({ error: 'avatar must be at most 10 characters' }, { status: 400 });
		}
		update.avatar = avatar;
	}

	if ('systemPrompt' in payload) {
		const sp = payload.systemPrompt;
		if (typeof sp !== 'string' || sp.length < 10 || sp.length > 8000) {
			return json({ error: 'systemPrompt must be 10-8000 characters' }, { status: 400 });
		}
		update.system_prompt = sp;
	}

	if ('tools' in payload) {
		const tools = payload.tools;
		if (!Array.isArray(tools) || !tools.every((t) => typeof t === 'string')) {
			return json({ error: 'tools must be an array of strings' }, { status: 400 });
		}
		const invalid = tools.filter((t: string) => !validToolNames.has(t));
		if (invalid.length > 0) {
			return json({ error: `Invalid tool names: ${invalid.join(', ')}` }, { status: 400 });
		}
		update.tools = tools;
	}

	if ('defaultModel' in payload) {
		const model = payload.defaultModel;
		if (model !== null && !isAIModel(model)) {
			return json({ error: `Invalid model: ${String(model)}` }, { status: 400 });
		}
		update.default_model = model;
	}

	if ('conversationStarters' in payload) {
		const starters = payload.conversationStarters;
		if (!Array.isArray(starters) || starters.length > MAX_STARTERS) {
			return json({ error: `conversationStarters must be at most ${MAX_STARTERS} items` }, { status: 400 });
		}
		if (!starters.every((s) => typeof s === 'string' && s.length <= MAX_STARTER_LENGTH)) {
			return json({ error: `Each starter must be at most ${MAX_STARTER_LENGTH} characters` }, { status: 400 });
		}
		update.conversation_starters = starters;
	}

	if (Object.keys(update).length === 0) {
		return json({ error: 'No fields to update' }, { status: 400 });
	}

	const { data, error } = await supabase
		.from('custom_bots')
		.update(update)
		.eq('id', botId)
		.select()
		.single();

	if (error) {
		return json({ error: 'Failed to update bot' }, { status: 500 });
	}

	return json({ bot: data });
};

// DELETE /api/bots/[id] — soft-delete a bot
export const DELETE: RequestHandler = async ({ params, request }) => {
	const botId = params.id;
	let payload: Record<string, unknown>;
	try {
		payload = (await request.json()) as Record<string, unknown>;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const biglotUserId = typeof payload.biglotUserId === 'string' ? payload.biglotUserId : null;
	if (!biglotUserId) {
		return json({ error: 'biglotUserId is required' }, { status: 400 });
	}

	const supabase = getSupabaseAdminClient();

	// Verify ownership
	const { data: existing, error: fetchError } = await supabase
		.from('custom_bots')
		.select('biglot_user_id')
		.eq('id', botId)
		.eq('is_active', true)
		.single();

	if (fetchError || !existing) {
		return json({ error: 'Bot not found' }, { status: 404 });
	}
	if (existing.biglot_user_id !== biglotUserId) {
		return json({ error: 'Bot not found' }, { status: 404 });
	}

	const { error } = await supabase
		.from('custom_bots')
		.update({ is_active: false })
		.eq('id', botId);

	if (error) {
		return json({ error: 'Failed to delete bot' }, { status: 500 });
	}

	return json({ ok: true });
};
