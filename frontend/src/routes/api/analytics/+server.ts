/**
 * GET /api/analytics - Get user analytics
 */
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getSupabaseAdminClient } from '$lib/server/supabaseAdmin.server';

type ChatRow = {
    id: string;
};

type MessageRow = {
    chat_id: string | null;
    created_at: string | null;
    mode: string | null;
};

export const GET: RequestHandler = async ({ url }) => {
    const biglotUserId = url.searchParams.get('biglotUserId');
    
    if (!biglotUserId) {
        return json({ error: 'biglotUserId is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // Get all chats for the current user so downstream prompt counts stay scoped.
        const { data: chats, error: chatsError } = await supabase
            .from('chats')
            .select('id')
            .eq('biglot_user_id', biglotUserId);

        if (chatsError) {
            throw chatsError;
        }

        const chatIds = (chats ?? []).map((chat: ChatRow) => chat.id);

        let userMessages: MessageRow[] = [];
        if (chatIds.length > 0) {
            const { data: messageRows, error: messagesError } = await supabase
                .from('messages')
                .select('chat_id, created_at, mode')
                .eq('role', 'user')
                .in('chat_id', chatIds);

            if (messagesError) {
                throw messagesError;
            }

            userMessages = (messageRows ?? []) as MessageRow[];
        }

        const modeCounts: Record<string, number> = {};
        userMessages.forEach((msg) => {
            const mode = msg.mode || 'coach';
            modeCounts[mode] = (modeCounts[mode] || 0) + 1;
        });

        const recentChatIds = new Set<string>();
        userMessages.forEach((msg) => {
            if (!msg.chat_id || !msg.created_at) return;
            if (msg.created_at >= sevenDaysAgo) {
                recentChatIds.add(msg.chat_id);
            }
        });

        // Indicator data remains library-wide until the table stores ownership.
        const { count: totalIndicators, error: totalIndicatorsError } = await supabase
            .from('custom_indicators')
            .select('*', { count: 'exact', head: true });

        if (totalIndicatorsError) {
            throw totalIndicatorsError;
        }

        const { data: topIndicators, error: topIndicatorsError } = await supabase
            .from('custom_indicators')
            .select('name, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        if (topIndicatorsError) {
            throw topIndicatorsError;
        }

        return json({
            stats: {
                totalChats: chatIds.length,
                totalMessages: userMessages.length,
                totalIndicators: totalIndicators || 0,
                recentChatsLast7Days: recentChatIds.size
            },
            agentModes: modeCounts,
            recentIndicators: topIndicators || [],
            period: 'last_7_days'
        });
    } catch (error) {
        console.error('Analytics error:', error);
        return json({ error: 'Failed to fetch analytics' }, { status: 500 });
    }
};
