/**
 * Manus AI API Client for BigLot.ai Indicator Builder
 * Server-side only — uses private env variables
 */
import { env } from '$env/dynamic/private';
import type {
    ManusCreateTaskRequest,
    ManusCreateTaskResponse,
    ManusTask,
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
You must output TWO separate code blocks/files in this exact order:

--- FILE 1: "indicator.pine" ---
- Full PineScript v6 code.
- The very first line MUST be: //@version=6
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
5. Output code only in fenced blocks:
   - \`\`\`pine ... \`\`\`
   - \`\`\`javascript ... \`\`\`
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
            : `Create a dual-output response for:\n\n${prompt}\n\n1. PineScript v6 (indicator.pine) starting with //@version=6\n2. JavaScript Preview (preview.js) with calculate(data, params)\n\nFollow the project instructions exactly.`,
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
    previewCode: string | null; // JavaScript for preview
    pineFileUrl: string | null;
    previewFileUrl: string | null;
    textOutput: string;
} {
    let code: string | null = null;
    let previewCode: string | null = null;
    let pineFileUrl: string | null = null;
    let previewFileUrl: string | null = null;
    let textOutput = '';

    if (!task.output) return { code, previewCode, pineFileUrl, previewFileUrl, textOutput };

    for (const msg of task.output) {
        if (msg.role !== 'assistant') continue;

        for (const content of msg.content) {
            if (content.type === 'output_text' && content.text) {
                textOutput += content.text + '\n';

                const blocks = [...content.text.matchAll(/```(\w+)?\s*\r?\n([\s\S]*?)```/g)];
                for (const block of blocks) {
                    const lang = (block[1] ?? '').toLowerCase();
                    const blockText = block[2].trim();
                    if (!blockText) continue;

                    if (!code && (lang.includes('pine') || isLikelyPineCode(blockText))) {
                        code = blockText;
                    }
                    if (!previewCode && (isJavaScriptBlock(lang) || isLikelyPreviewCode(blockText))) {
                        previewCode = blockText;
                    }
                }
            }

            if (content.type === 'output_file') {
                const fileName = content.fileName?.toLowerCase() ?? '';
                const fileUrl = content.fileUrl ?? null;
                if (!fileUrl) continue;

                if (!pineFileUrl && fileName.endsWith('.pine')) {
                    pineFileUrl = fileUrl;
                }
                if (!previewFileUrl && (fileName.endsWith('.js') || fileName.endsWith('.ts'))) {
                    previewFileUrl = fileUrl;
                }
            }
        }
    }

    return { code, previewCode, pineFileUrl, previewFileUrl, textOutput };
}

function isJavaScriptBlock(lang: string): boolean {
    return lang === 'javascript' || lang === 'js' || lang === 'typescript' || lang === 'ts';
}

function isLikelyPineCode(code: string): boolean {
    return /@version\s*=\s*[56]/.test(code)
        || /\bindicator\s*\(/.test(code)
        || /\bstrategy\s*\(/.test(code)
        || /\bta\./.test(code);
}

function isLikelyPreviewCode(code: string): boolean {
    return /function\s+calculate\s*\(/.test(code)
        || /const\s+calculate\s*=/.test(code)
        || /module\.exports\s*=/.test(code);
}

/**
 * Download a file from Manus file URL
 */
export async function downloadFile(fileUrl: string): Promise<string> {
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error(`Failed to download file: ${res.statusText}`);
    return res.text();
}
