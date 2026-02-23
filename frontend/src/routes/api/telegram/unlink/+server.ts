import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getSupabaseAdminClient } from '$lib/server/supabaseAdmin.server';
import { isValidBigLotUserId } from '$lib/server/telegram.server';

type UnlinkRequestBody = {
    biglotUserId?: unknown;
};

export const POST: RequestHandler = async ({ request }) => {
    let payload: UnlinkRequestBody;
    try {
        payload = (await request.json()) as UnlinkRequestBody;
    } catch {
        return json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const biglotUserId = payload.biglotUserId;
    if (!isValidBigLotUserId(biglotUserId)) {
        return json({ error: 'Invalid biglotUserId' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();

    const { error } = await supabase
        .from('telegram_links')
        .update({
            is_active: false,
            unlinked_at: now,
            updated_at: now
        })
        .eq('biglot_user_id', biglotUserId)
        .eq('is_active', true);

    if (error) {
        return json({ error: error.message }, { status: 500 });
    }

    return json({ ok: true });
};
