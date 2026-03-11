import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getSupabaseAdminClient } from '$lib/server/supabaseAdmin.server';

const MAX_BOTS_PER_USER = 20;

// POST /api/bots/[id]/duplicate — clone a bot
export const POST: RequestHandler = async ({ params, request }) => {
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

	// Fetch original bot
	const { data: original, error: fetchError } = await supabase
		.from('custom_bots')
		.select('*')
		.eq('id', botId)
		.eq('is_active', true)
		.single();

	if (fetchError || !original) {
		return json({ error: 'Bot not found' }, { status: 404 });
	}
	if (original.biglot_user_id !== biglotUserId) {
		return json({ error: 'Bot not found' }, { status: 404 });
	}

	// Check max bots
	const { count } = await supabase
		.from('custom_bots')
		.select('id', { count: 'exact', head: true })
		.eq('biglot_user_id', biglotUserId)
		.eq('is_active', true);

	if ((count ?? 0) >= MAX_BOTS_PER_USER) {
		return json({ error: `Maximum ${MAX_BOTS_PER_USER} bots per user` }, { status: 400 });
	}

	const copyName = `Copy of ${original.name}`.slice(0, 60);

	const { data, error } = await supabase
		.from('custom_bots')
		.insert({
			biglot_user_id: biglotUserId,
			name: copyName,
			description: original.description,
			avatar: original.avatar,
			system_prompt: original.system_prompt,
			tools: original.tools,
			default_model: original.default_model,
			conversation_starters: original.conversation_starters
		})
		.select()
		.single();

	if (error) {
		return json({ error: 'Failed to duplicate bot' }, { status: 500 });
	}

	return json({ bot: data }, { status: 201 });
};
