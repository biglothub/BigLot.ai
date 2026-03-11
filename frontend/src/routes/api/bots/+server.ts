import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getSupabaseAdminClient } from '$lib/server/supabaseAdmin.server';
import { isAIModel } from '$lib/server/aiProvider.server';
import { getAllTools } from '$lib/server/tools/registry';

// Import tool files so they register themselves
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

const MAX_BOTS_PER_USER = 20;
const MAX_STARTERS = 6;
const MAX_STARTER_LENGTH = 200;

function getValidToolNames(): Set<string> {
	return new Set(getAllTools().map((t) => t.name));
}

function validateBotPayload(
	payload: Record<string, unknown>,
	validToolNames: Set<string>,
	partial = false
): { error: string } | null {
	if (!partial || 'name' in payload) {
		const name = payload.name;
		if (typeof name !== 'string' || name.length < 1 || name.length > 60) {
			return { error: 'name must be 1-60 characters' };
		}
	}

	if (!partial || 'description' in payload) {
		const desc = payload.description;
		if (desc !== undefined && (typeof desc !== 'string' || desc.length > 500)) {
			return { error: 'description must be at most 500 characters' };
		}
	}

	if (!partial || 'avatar' in payload) {
		const avatar = payload.avatar;
		if (avatar !== undefined && (typeof avatar !== 'string' || avatar.length > 10)) {
			return { error: 'avatar must be at most 10 characters' };
		}
	}

	if (!partial || 'systemPrompt' in payload) {
		const sp = payload.systemPrompt;
		if (typeof sp !== 'string' || sp.length < 10 || sp.length > 8000) {
			return { error: 'systemPrompt must be 10-8000 characters' };
		}
	}

	if (!partial || 'tools' in payload) {
		const tools = payload.tools;
		if (tools !== undefined) {
			if (!Array.isArray(tools) || !tools.every((t) => typeof t === 'string')) {
				return { error: 'tools must be an array of strings' };
			}
			const invalid = tools.filter((t: string) => !validToolNames.has(t));
			if (invalid.length > 0) {
				return { error: `Invalid tool names: ${invalid.join(', ')}` };
			}
		}
	}

	if (!partial || 'defaultModel' in payload) {
		const model = payload.defaultModel;
		if (model !== undefined && model !== null && !isAIModel(model)) {
			return { error: `Invalid model: ${String(model)}` };
		}
	}

	if (!partial || 'conversationStarters' in payload) {
		const starters = payload.conversationStarters;
		if (starters !== undefined) {
			if (!Array.isArray(starters) || starters.length > MAX_STARTERS) {
				return { error: `conversationStarters must be an array of at most ${MAX_STARTERS} items` };
			}
			if (!starters.every((s) => typeof s === 'string' && s.length <= MAX_STARTER_LENGTH)) {
				return { error: `Each conversation starter must be at most ${MAX_STARTER_LENGTH} characters` };
			}
		}
	}

	return null;
}

// GET /api/bots?biglotUserId=xxx — list user's active bots
export const GET: RequestHandler = async ({ url }) => {
	const biglotUserId = url.searchParams.get('biglotUserId');
	if (!biglotUserId) {
		return json({ error: 'biglotUserId query parameter is required' }, { status: 400 });
	}

	const supabase = getSupabaseAdminClient();
	const { data, error } = await supabase
		.from('custom_bots')
		.select('*')
		.eq('biglot_user_id', biglotUserId)
		.eq('is_active', true)
		.order('updated_at', { ascending: false });

	if (error) {
		return json({ error: 'Failed to fetch bots' }, { status: 500 });
	}

	return json({ bots: data ?? [] });
};

// POST /api/bots — create a new bot
export const POST: RequestHandler = async ({ request }) => {
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

	const validToolNames = getValidToolNames();
	const validationError = validateBotPayload(payload, validToolNames);
	if (validationError) {
		return json(validationError, { status: 400 });
	}

	const supabase = getSupabaseAdminClient();

	// Check max bots per user
	const { count } = await supabase
		.from('custom_bots')
		.select('id', { count: 'exact', head: true })
		.eq('biglot_user_id', biglotUserId)
		.eq('is_active', true);

	if ((count ?? 0) >= MAX_BOTS_PER_USER) {
		return json({ error: `Maximum ${MAX_BOTS_PER_USER} bots per user` }, { status: 400 });
	}

	const { data, error } = await supabase
		.from('custom_bots')
		.insert({
			biglot_user_id: biglotUserId,
			name: payload.name as string,
			description: (payload.description as string) ?? '',
			avatar: (payload.avatar as string) ?? '🤖',
			system_prompt: payload.systemPrompt as string,
			tools: (payload.tools as string[]) ?? [],
			default_model: (payload.defaultModel as string) ?? null,
			conversation_starters: (payload.conversationStarters as string[]) ?? []
		})
		.select()
		.single();

	if (error) {
		return json({ error: 'Failed to create bot' }, { status: 500 });
	}

	return json({ bot: data }, { status: 201 });
};
