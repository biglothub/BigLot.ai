/**
 * Webhook endpoint — kept for backward compatibility
 * No longer actively used with GPT-based generation (synchronous)
 */
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async () => {
    return json({ received: true });
};

export const GET: RequestHandler = async () => {
    return json({ events: 0, activityLog: [] });
};
