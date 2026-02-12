/**
 * POST /api/manus/webhook — Receive Manus webhook events
 */
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import type { ManusWebhookEvent } from '$lib/types/indicator';

type StoredWebhookEvent = {
    event: ManusWebhookEvent;
    receivedAt: number;
};

// In-memory store for webhook events (in production, use Redis/DB)
const webhookEvents = new Map<string, StoredWebhookEvent[]>();

export const POST: RequestHandler = async ({ request }) => {
    try {
        const event: ManusWebhookEvent = await request.json();

        console.log('Manus webhook received:', event.event_type, event);

        const taskId = event.task_detail?.task_id || event.progress_detail?.task_id;

        if (taskId) {
            const existing = webhookEvents.get(taskId) || [];
            existing.push({
                event,
                receivedAt: Date.now()
            });
            webhookEvents.set(taskId, existing);

            // Keep only last 50 events per task to prevent memory leak
            if (existing.length > 50) {
                webhookEvents.set(taskId, existing.slice(-50));
            }
        }

        return json({ received: true });
    } catch (err: any) {
        console.error('Webhook processing error:', err);
        return json({ error: err.message }, { status: 500 });
    }
};

// GET endpoint to retrieve webhook events for a task (used by frontend polling)
export const GET: RequestHandler = async ({ url }) => {
    const taskId = url.searchParams.get('taskId');

    if (!taskId) {
        return json({ error: 'taskId is required' }, { status: 400 });
    }

    const events = webhookEvents.get(taskId) || [];

    // Get latest progress message
    const latestProgress = events
        .filter(e => e.event.event_type === 'task_progress')
        .pop();

    const stoppedEvent = events
        .find(e => e.event.event_type === 'task_stopped');

    const activityLog = events.map((item, idx) => {
        const event = item.event;
        let message = 'AI event received';
        if (event.event_type === 'task_created') {
            message = event.task_detail?.message || 'Task created';
        } else if (event.event_type === 'task_progress') {
            message = event.progress_detail?.message || 'Working...';
        } else if (event.event_type === 'task_stopped') {
            const reason = event.task_detail?.stop_reason;
            message = reason ? `Task stopped (${reason})` : 'Task completed';
        }

        return {
            id: event.event_id || `${event.event_type}-${idx}`,
            type: event.event_type,
            message,
            receivedAt: item.receivedAt
        };
    });

    return json({
        taskId,
        events: events.length,
        latestStep: latestProgress?.event.progress_detail?.message,
        activityLog,
        isCompleted: !!stoppedEvent,
        stopReason: stoppedEvent?.event.task_detail?.stop_reason,
        attachments: stoppedEvent?.event.task_detail?.attachments
    });
};
