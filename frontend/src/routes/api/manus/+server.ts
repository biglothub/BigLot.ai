/**
 * POST /api/manus — Create indicator generation task
 * GET  /api/manus?taskId=xxx — Get task status & result
 */
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { generateIndicator, getTask, extractIndicatorCode, downloadFile } from '$lib/manus';
import type { ManusAgentProfile } from '$lib/types/indicator';

export const POST: RequestHandler = async ({ request }) => {
    const { prompt, agentProfile, projectId, existingTaskId } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
        return json({ error: 'Prompt is required' }, { status: 400 });
    }

    try {
        const result = await generateIndicator(prompt, {
            agentProfile: (agentProfile as ManusAgentProfile) ?? 'manus-1.6',
            projectId,
            existingTaskId
        });

        return json({
            taskId: result.task_id,
            taskTitle: result.task_title,
            taskUrl: result.task_url,
            status: 'running'
        });
    } catch (err: any) {
        console.error('Manus API error:', err);
        return json({ error: err.message || 'Failed to create task' }, { status: 500 });
    }
};

export const GET: RequestHandler = async ({ url }) => {
    const taskId = url.searchParams.get('taskId');

    if (!taskId) {
        return json({ error: 'taskId is required' }, { status: 400 });
    }

    try {
        const task = await getTask(taskId);

        if (!task) {
            return json({ error: 'Task not found' }, { status: 404 });
        }

        const response: any = {
            taskId: task.id,
            status: task.status,
            taskUrl: task.metadata?.task_url,
            creditUsage: task.credit_usage
        };

        // If completed, extract the indicator code
        if (task.status === 'completed') {
            const { code, previewCode, fileUrl, textOutput } = extractIndicatorCode(task);

            // If we got a file URL but no inline code, download the file
            let finalCode = code;
            if (!finalCode && fileUrl) {
                try {
                    finalCode = await downloadFile(fileUrl);
                } catch (e) {
                    console.warn('Failed to download indicator file:', e);
                }
            }

            response.code = finalCode;
            response.previewCode = previewCode; // Pass the TS preview
            response.textOutput = textOutput;

            // Try to parse config from PineScript
            if (finalCode) {
                try {
                    response.config = parsePineScriptConfig(finalCode);
                } catch (e) {
                    console.warn('Config parsing failed', e);
                    // Fallback config
                    response.config = { name: 'Custom Indicator', description: 'PineScript Indicator', overlayType: 'separate', params: {} };
                }
            } else {
                response.config = { name: 'Generating...', description: '', overlayType: 'separate', params: {} };
            }
        }

        if (task.status === 'failed') {
            response.error = task.error || 'Task failed';
        }

        return json(response);
    } catch (err: any) {
        console.error('Error fetching task:', err);
        return json({ error: err.message || 'Failed to fetch task' }, { status: 500 });
    }
};

/**
 * Parse metadata from PineScript code
 */
function parsePineScriptConfig(code: string): any {
    const config: any = {
        name: 'Custom Indicator',
        description: 'Generated PineScript Indicator',
        params: {},
        overlayType: 'separate'
    };

    // Extract indicator title
    const titleMatch = code.match(/indicator\s*\(\s*(?:title\s*=\s*)?(?:"|')([^"']+)(?:"|')/);
    if (titleMatch) {
        config.name = titleMatch[1];
        config.description = titleMatch[1];
    }

    // Extract overlay setting
    const overlayMatch = code.match(/overlay\s*=\s*(true|false)/);
    if (overlayMatch && overlayMatch[1] === 'true') {
        config.overlayType = 'overlay';
    }

    return config;
}
