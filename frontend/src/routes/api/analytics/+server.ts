/**
 * GET /api/analytics - Get user analytics
 */
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getSupabaseAdminClient } from '$lib/server/supabaseAdmin.server';

export const GET: RequestHandler = async ({ url }) => {
    const biglotUserId = url.searchParams.get('biglotUserId');
    
    if (!biglotUserId) {
        return json({ error: 'biglotUserId is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    try {
        // Get total chats
        const { count: totalChats } = await supabase
            .from('chats')
            .select('*', { count: 'exact', head: true })
            .eq('biglot_user_id', biglotUserId);

        // Get total messages
        const { count: totalMessages } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'user');

        // Get total custom indicators
        const { count: totalIndicators } = await supabase
            .from('custom_indicators')
            .select('*', { count: 'exact', head: true });

        // Get recent activity (last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        
        const { data: recentChats } = await supabase
            .from('chats')
            .select('id, created_at')
            .eq('biglot_user_id', biglotUserId)
            .gte('created_at', sevenDaysAgo);

        // Get most used agent modes
        const { data: modeData } = await supabase
            .from('messages')
            .select('mode')
            .eq('role', 'user')
            .not('mode', 'is', null);

        const modeCounts: Record<string, number> = {};
        if (modeData) {
            modeData.forEach((msg: any) => {
                const mode = msg.mode || 'coach';
                modeCounts[mode] = (modeCounts[mode] || 0) + 1;
            });
        }

        // Get top indicators (most recently created)
        const { data: topIndicators } = await supabase
            .from('custom_indicators')
            .select('name, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        return json({
            stats: {
                totalChats: totalChats || 0,
                totalMessages: totalMessages || 0,
                totalIndicators: totalIndicators || 0,
                recentChatsLast7Days: recentChats?.length || 0
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
