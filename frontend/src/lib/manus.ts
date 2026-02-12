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
import { findBestReference, buildReferenceEnhancedPrompt, buildSearchPrompt } from '$lib/pinescriptLibrary';

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
const INDICATOR_SYSTEM_INSTRUCTION = `You are the World-Class Trading Indicator Engineer for BigLot.ai, specializing in high-performance, error-free TradingView PineScript v6.

YOUR MISSION:
Generate an industrial-grade TradingView PineScript indicator AND a matching JavaScript simulation for web previewing. Your code must be production-ready and follow the strictest TradingView coding standards.

--- FILE 1: "indicator.pine" (The Primary Product) ---
- **Version**: MUST use //@version=6.
- **Namespacing**: Use explicit namespaces for ALL built-in functions (ta.*, math.*, request.*, color.*, input.*, str.*, plot.*). NEVER use legacy names without namespaces.
- **Type Safety**: Use the most specific input functions (input.int(), input.float(), input.bool(), input.source(), input.color()).
- **Global Scope Rule**: All ploting functions (plot, fill, hline, plotshape, plotchar, plotbar, plotcandle) MUST be in the global scope. NEVER place them inside 'if', 'for', or custom functions.
- **Initialization**: Use 'var' for variables that only need initialization on the first bar (counters, states).
- **Edge Case Handling**: Always handle 'na' values using nz() or na() checks to prevent broken charts.
- **Documentation**: Use detailed inline comments explaining the logic and math. Use meaningful variable names.
- **Visuals**: Use professional color palettes (e.g., color.new(color.blue, 20)).

--- FILE 2: "preview.js" (The Visualization Bridge) ---
- **Engine**: Pure ES6 JavaScript. No external dependencies.
- **Interface**: Export a function \`calculate(data, params)\`.
- **Data Input**: \`data\` is an array of { timestamp, open, high, low, close, volume }.
- **Data Output**: Return an array of objects: { timestamp, values: { [plotName]: number }, signal?: 'buy'|'sell'|'neutral' }.
- **Parity**: The logic MUST exactly mirror the PineScript version. Handle SMA/EMA/RSI loops correctly using the previous bars' state where necessary.
- **Stability**: Ensure no 'undefined' or 'NaN' values in the output array.

CRITICAL RULES:
1. Always prioritize accuracy and technical correctness over brevity.
2. In PineScript, if a plot depends on a condition, calculate the value in an 'if' block but perform the 'plot()' at the top level using 'na' if the condition isn't met.
3. Use 'ta.sma()', 'ta.ema()', 'ta.rsi()' etc., instead of writing the math from scratch unless specifically asked.
4. Format output as separate code blocks: \`\`\`pine ... \`\`\` and \`\`\`javascript ... \`\`\`.

COMMON PINESCRIPT ERRORS YOU MUST AVOID:
- ERROR: "Cannot call 'plot' / 'hline' / 'fill' / 'bgcolor' / 'plotshape' inside local scope."
  FIX: ALWAYS place ALL drawing/plotting functions at GLOBAL scope. Use conditional values (ternary or pre-calculated variables) instead.
  WRONG: if condition \\n    plot(value)
  CORRECT: plot(condition ? value : na)

- ERROR: "Could not find function or function reference 'sma'."
  FIX: Use namespaced 'ta.sma()', 'ta.ema()', 'ta.rsi()', 'ta.atr()', 'ta.crossover()', 'ta.crossunder()', 'ta.stoch()', 'ta.macd()', 'ta.bb()' etc.
  
- ERROR: "Cannot use 'plot' in local scope."
  FIX: Move plot() calls outside of any function, if, for, while, or switch block.

- ERROR: "line/label/box/table limit exceeded."
  FIX: Always delete old drawings before creating new ones. Use 'var' for persistent objects.

- ERROR: "The 'timeframe' argument is incompatible with functions 'request.security'."
  FIX: Use string timeframe values like "D", "W", "60", "240".

- ERROR: "Cannot modify a const variable."
  FIX: Use 'var' for mutable state that persists across bars. Use ':=' for reassignment instead of '='.

- ERROR: "Undeclared identifier 'na'."
  FIX: 'na' is a keyword, not a function. Use na(value) to check, nz(value) to replace.

- ERROR: "The function 'input' should be called at the top indentation level."
  FIX: ALL input() calls must be at global scope, never inside if/for/functions.

- ERROR: Mismatched types in ternary or if/else.
  FIX: Both branches must return the same type. Use float(na) or int(na) for explicit na typing.

- ERROR: "Cannot call 'strategy.*' from indicator."
  FIX: Use indicator() for indicators, strategy() for strategies. Never mix them.

- WARNING: Repainting issues.
  FIX: Avoid using request.security() with lookahead=barmerge.lookahead_on unless intentional. Use barstate.isconfirmed for signal confirmation.
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
 * Uses reference library matching: finds the closest open-source indicator as a base
 */
export async function generateIndicator(
    prompt: string,
    options?: {
        agentProfile?: ManusAgentProfile;
        projectId?: string;
        existingTaskId?: string; // for multi-turn refinement
    }
): Promise<ManusCreateTaskResponse & { referenceUsed?: string }> {

    let finalPrompt: string;
    let referenceUsed: string | undefined;

    if (options?.existingTaskId) {
        // Follow-up refinement: just send the prompt as-is
        finalPrompt = prompt;
    } else {
        // ─── REFERENCE MATCHING ENGINE ───
        // Search curated library of battle-tested LuxAlgo & TradingView indicators
        const { match, score, allMatches } = findBestReference(prompt);

        if (match && score >= 0.05) {
            // Found a relevant reference! Use it as the base
            console.log(`[BigLot.ai] Reference matched: "${match.name}" (score: ${(score * 100).toFixed(0)}%) by ${match.author}`);
            if (allMatches.length > 1) {
                console.log(`[BigLot.ai] Other candidates: ${allMatches.slice(1).map(m => `"${m.ref.name}" (${(m.score * 100).toFixed(0)}%)`).join(', ')}`);
            }
            finalPrompt = buildReferenceEnhancedPrompt(prompt, match);
            referenceUsed = `${match.name} by ${match.author}`;
        } else {
            // No match in library — tell AI to search TradingView community for inspiration
            console.log(`[BigLot.ai] No library match found for: "${prompt}" — using community search mode`);
            finalPrompt = buildSearchPrompt(prompt);
        }
    }

    const body: ManusCreateTaskRequest = {
        prompt: finalPrompt,
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

    const result = await res.json();
    return { ...result, referenceUsed };
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
