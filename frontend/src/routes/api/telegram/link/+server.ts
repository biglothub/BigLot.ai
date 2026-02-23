import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getSupabaseAdminClient } from '$lib/server/supabaseAdmin.server';
import {
    createLinkToken,
    getTelegramBotUsername,
    hashLinkToken,
    isValidBigLotUserId,
    toDisplayName,
    type TelegramLinkRecord
} from '$lib/server/telegram.server';

type LinkRequestBody = {
    biglotUserId?: unknown;
};

export const GET: RequestHandler = async ({ url }) => {
    try {
        const biglotUserId = url.searchParams.get('biglotUserId');
        if (!isValidBigLotUserId(biglotUserId)) {
            return json({ error: 'Invalid biglotUserId' }, { status: 400 });
        }

        const supabase = getSupabaseAdminClient();
        const { data, error } = await supabase
            .from('telegram_links')
            .select('*')
            .eq('biglot_user_id', biglotUserId)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

        if (error) {
            return json({ error: error.message }, { status: 500 });
        }

        const link = data as TelegramLinkRecord | null;

        if (!link) {
            return json({ linked: false });
        }

        return json({
            linked: true,
            displayName: toDisplayName(link),
            linkedAt: link.linked_at
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch Telegram link status';
        return json({ error: message }, { status: 500 });
    }
};

export const POST: RequestHandler = async ({ request }) => {
    try {
        let payload: LinkRequestBody;
        try {
            payload = (await request.json()) as LinkRequestBody;
        } catch {
            return json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const biglotUserId = payload.biglotUserId;
        if (!isValidBigLotUserId(biglotUserId)) {
            return json({ error: 'Invalid biglotUserId' }, { status: 400 });
        }

        const token = createLinkToken();
        const tokenHash = hashLinkToken(token);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        const supabase = getSupabaseAdminClient();
        const { error } = await supabase.from('telegram_link_tokens').insert({
            token_hash: tokenHash,
            biglot_user_id: biglotUserId,
            expires_at: expiresAt.toISOString()
        });

        if (error) {
            return json({ error: error.message }, { status: 500 });
        }

        const botUsername = getTelegramBotUsername();
        const deepLink = `https://t.me/${botUsername}?start=${token}`;

        return json({
            deepLink,
            expiresAt: expiresAt.toISOString()
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create Telegram link';
        return json({ error: message }, { status: 500 });
    }
};
