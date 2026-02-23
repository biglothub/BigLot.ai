import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

let adminClient: SupabaseClient | null = null;

function resolveSupabaseUrl(): string {
    const candidates = [env.SUPABASE_URL, PUBLIC_SUPABASE_URL].filter(
        (value): value is string => typeof value === 'string' && value.length > 0
    );

    if (candidates.length === 0) {
        throw new Error('Supabase URL is not configured. Set SUPABASE_URL or PUBLIC_SUPABASE_URL.');
    }

    return candidates[0];
}

export function getSupabaseAdminClient(): SupabaseClient {
    if (adminClient) return adminClient;

    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
    }

    adminClient = createClient(resolveSupabaseUrl(), serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    return adminClient;
}
