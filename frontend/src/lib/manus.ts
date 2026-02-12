/**
 * Manus AI API Client for BigLot.ai Indicator Builder
 * Server-side only — uses private env variables
 */
import { env } from '$env/dynamic/private';
import type {
    ManusCreateTaskRequest,
    ManusCreateTaskResponse,
    ManusTask,
    ManusGetTasksResponse,
    ManusAgentProfile
} from '$lib/types/indicator';

const MANUS_BASE_URL = 'https://api.manus.ai/v1';

function getApiKey(): string {
    const key = env.MANUS_API_KEY;
    if (!key) throw new Error('MANUS_API_KEY is not configured');
    return key;
}

function headers(): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'API_KEY': getApiKey()
    };
}

// ─── DUAL-MODE SYSTEM PROMPT ───
const INDICATOR_SYSTEM_INSTRUCTION = `You are an expert Trading Indicator Engineer for BigLot.ai.

YOUR GOAL:
Generate a TradingView PineScript indicator AND a corresponding JavaScript simulation for previewing it.

OUTPUT REQUIREMENTS:
You must output TWO separate code blocks/files:

--- FILE 1: "indicator.pine" ---
- Full PineScript v5 code.
- Official functionality with inputs, plots, and alerts.
- Use standard TradingView syntax.

--- FILE 2: "preview.js" ---
- A JavaScript (ES6) simulation of the SAME logic for our web visualizations.
- MUST export a function \`calculate(data, params)\` that returns an array of result objects.
- MUST be self-contained (no external imports).
- Logic must match the PineScript functionality as closely as possible.
- Do NOT use TypeScript types. Use standard JavaScript.

DATA STRUCTURES:
- data: Array of { timestamp, open, high, low, close, volume }
- return: Array of { timestamp, values: { [plotName]: number }, signal?: 'buy' | 'sell' | 'neutral' }

RULES:
1. The PineScript is the "Product" (what the user wants).
2. The JavaScript is the "Preview" (so the user can see it works).
3. Ensure parameters in PineScript match the hardcoded defaults in JavaScript or simple params.
4. In JavaScript, handle array looping carefully to simulate the "series" nature of PineScript.
`;

// ─── PROJECT MANAGEMENT ───

export async function createIndicatorProject(): Promise<string> {
    const res = await fetch(`${MANUS_BASE_URL}/projects`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
            name: 'BigLot.ai Indicator Builder',
            instruction: INDICATOR_SYSTEM_INSTRUCTION
        })
    });

    if (!res.ok) {
        const error = await res.text();
        throw new Error(`Failed to create project: ${error}`);
    }

    const data = await res.json();
    return data.id;
}

// ─── TASK MANAGEMENT ───

/**
 * Generate an indicator from a user prompt
 */
export async function generateIndicator(
    prompt: string,
    options?: {
        agentProfile?: ManusAgentProfile;
        projectId?: string;
        existingTaskId?: string; // for multi-turn refinement
    }
): Promise<ManusCreateTaskResponse> {
    const body: ManusCreateTaskRequest = {
        prompt: options?.existingTaskId
            ? prompt  // follow-up: just the refinement prompt
            : `Create a dual-output response for:\n\n${prompt}\n\n1. PineScript v5 (indicator.pine)\n2. JavaScript Preview (preview.js)\n\nFollow the project instructions exactly.`,
        agentProfile: options?.agentProfile ?? 'manus-1.6',
        task_mode: 'agent',
        hide_in_task_list: true
    };

    if (options?.projectId) {
        body.project_id = options.projectId;
    }

    if (options?.existingTaskId) {
        body.task_id = options.existingTaskId;
    }

    const res = await fetch(`${MANUS_BASE_URL}/tasks`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const error = await res.text();
        throw new Error(`Failed to create indicator task: ${error}`);
    }

    return res.json();
}

/**
 * Get a specific task by ID
 */
export async function getTask(taskId: string): Promise<ManusTask | null> {
    // Try direct task endpoint first
    const res = await fetch(`${MANUS_BASE_URL}/tasks?limit=100`, {
        method: 'GET',
        headers: headers()
    });

    if (!res.ok) return null;

    try {
        const data = await res.json();
        const tasks = data?.data;
        if (!Array.isArray(tasks)) return null;
        return tasks.find((t: ManusTask) => t.id === taskId) ?? null;
    } catch {
        return null;
    }
}

/**
 * Extract generated indicator code from a completed task
 */
export function extractIndicatorCode(task: ManusTask): {
    code: string | null;      // PineScript
    previewCode: string | null; // TypeScript for preview
    fileUrl: string | null;
    textOutput: string;
} {
    let code: string | null = null;
    let previewCode: string | null = null;
    let fileUrl: string | null = null;
    let textOutput = '';

    if (!task.output) return { code, previewCode, fileUrl, textOutput };

    for (const msg of task.output) {
        if (msg.role !== 'assistant') continue;

        for (const content of msg.content) {
            if (content.type === 'output_text' && content.text) {
                textOutput += content.text + '\n';

                // 1. Extract PineScript
                const pineMatch = content.text.match(/```(?:pinescript|pine)\s*\n([\s\S]*?)```/);
                if (pineMatch) {
                    code = pineMatch[1].trim();
                } else if (content.text.includes('//@version=5')) {
                    // Fallback for unlabeled code block
                    const blockMatch = content.text.match(/```\s*\n(.*?@version=5[\s\S]*?)```/);
                    if (blockMatch) code = blockMatch[1].trim();
                }

                // 2. Extract JavaScript Preview (try multiple code-block labels)
                const jsPatterns = [
                    /```(?:javascript|js)\s*\n([\s\S]*?)```/,
                    /```(?:typescript|ts)\s*\n([\s\S]*?)```/,
                ];
                for (const pattern of jsPatterns) {
                    if (previewCode) break;
                    const jsMatch = content.text.match(pattern);
                    if (jsMatch) {
                        const extracted = jsMatch[1].trim();
                        if (extracted.includes('calculate')) {
                            previewCode = extracted;
                        }
                    }
                }
                // Fallback: scan all unlabeled code blocks for a calculate function
                if (!previewCode) {
                    const allBlocks = [...content.text.matchAll(/```\w*\s*\n([\s\S]*?)```/g)];
                    for (const block of allBlocks) {
                        const blockText = block[1].trim();
                        if (blockText.includes('function calculate') || blockText.includes('const calculate')) {
                            previewCode = blockText;
                            break;
                        }
                    }
                }
            }

            if (content.type === 'output_file') {
                if (content.fileName?.endsWith('.pine')) {
                    fileUrl = content.fileUrl ?? null;
                    // If we haven't found code yet, maybe we can fetch this later (handled in +server.ts)
                }
            }
        }
    }

    return { code, previewCode, fileUrl, textOutput };
}

/**
 * Download a file from Manus file URL
 */
export async function downloadFile(fileUrl: string): Promise<string> {
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error(`Failed to download file: ${res.statusText}`);
    return res.text();
}
