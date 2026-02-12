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
            referenceUsed: result.referenceUsed ?? null,
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
            const { code, previewCode, pineFileUrl, previewFileUrl, textOutput } = extractIndicatorCode(task);

            // Resolve PineScript source (inline text first, then output file)
            let finalCode = code;
            if (!finalCode && pineFileUrl) {
                try {
                    finalCode = await downloadFile(pineFileUrl);
                } catch (e) {
                    console.warn('Failed to download indicator file:', e);
                }
            }
            if (finalCode) {
                finalCode = normalizePineToV6(finalCode);
                // Validate and auto-fix common PineScript issues
                finalCode = validateAndFixPineScript(finalCode);
            }

            // Resolve preview JS source (inline text first, then output file)
            let finalPreviewCode = previewCode ? stripCodeFences(previewCode) : null;
            if (!finalPreviewCode && previewFileUrl) {
                try {
                    finalPreviewCode = stripCodeFences(await downloadFile(previewFileUrl));
                } catch (e) {
                    console.warn('Failed to download preview file:', e);
                }
            }

            response.code = finalCode;
            response.previewCode = finalPreviewCode;
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
 * Parse metadata and parameters from PineScript code
 */
function parsePineScriptConfig(code: string): any {
    const config: any = {
        name: 'Custom Indicator',
        description: 'Generated PineScript Indicator',
        params: {},
        overlayType: 'separate'
    };

    // Extract indicator title — handle both quoted styles and title= keyword
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

    // Extract input parameters — support input.int(), input.float(), input.source(), input()
    const inputRegex = /(\w+)\s*=\s*input(?:\.(int|float|bool|string|source|color))?\s*\(\s*(?:defval\s*=\s*)?([^,)]+)(?:.*?title\s*=\s*(?:"|')([^"']+)(?:"|'))?/g;
    let inputMatch;
    while ((inputMatch = inputRegex.exec(code)) !== null) {
        const varName = inputMatch[1];
        const inputType = inputMatch[2] || '';
        const defaultRaw = inputMatch[3].trim();
        const label = inputMatch[4] || varName;

        // Only parse numeric params for our config
        if (inputType === 'bool' || inputType === 'color' || inputType === 'string' || inputType === 'source') continue;

        const defaultVal = parseFloat(defaultRaw);
        if (!isNaN(defaultVal)) {
            config.params[varName] = {
                default: defaultVal,
                label: label
            };

            // Try to extract minval/maxval/step
            const fullCall = code.substring(inputMatch.index, code.indexOf(')', inputMatch.index) + 1);
            const minMatch = fullCall.match(/minval\s*=\s*([0-9.]+)/);
            const maxMatch = fullCall.match(/maxval\s*=\s*([0-9.]+)/);
            const stepMatch = fullCall.match(/step\s*=\s*([0-9.]+)/);
            if (minMatch) config.params[varName].min = parseFloat(minMatch[1]);
            if (maxMatch) config.params[varName].max = parseFloat(maxMatch[1]);
            if (stepMatch) config.params[varName].step = parseFloat(stepMatch[1]);
        }
    }

    return config;
}

function normalizePineToV6(rawCode: string): string {
    const clean = stripCodeFences(rawCode)
        .replace(/\r\n/g, '\n')
        .trim();
    if (!clean) return clean;

    // Remove ALL existing @version directives (with or without spaces around =)
    const body = clean.replace(/^\s*\/\/\s*@version\s*=?\s*\d+\s*$/gm, '').trimStart();

    // Also handle the format //@version=6 (no space)
    const bodyFinal = body.replace(/^\s*\/\/@version\s*=?\s*\d+\s*$/gm, '').trimStart();

    return `//@version=6\n${bodyFinal}`;
}

function stripCodeFences(raw: string): string {
    return raw
        .replace(/^```[a-zA-Z]*\s*\r?\n/, '')
        .replace(/\r?\n```[\t ]*$/, '')
        .trim();
}

/**
 * Validate and auto-fix common PineScript issues before delivering to user
 * This is a safety net — the AI should produce correct code, but this catches edge cases.
 */
function validateAndFixPineScript(code: string): string {
    let fixed = code;

    // 1. Fix legacy function calls without namespace (most common error source)
    const legacyFnMap: Record<string, string> = {
        'sma(': 'ta.sma(',
        'ema(': 'ta.ema(',
        'rsi(': 'ta.rsi(',
        'atr(': 'ta.atr(',
        'stoch(': 'ta.stoch(',
        'macd(': 'ta.macd(',
        'bb(': 'ta.bb(',
        'wma(': 'ta.wma(',
        'vwma(': 'ta.vwma(',
        'swma(': 'ta.swma(',
        'alma(': 'ta.alma(',
        'hma(': 'ta.hma(',
        'rma(': 'ta.rma(',
        'mfi(': 'ta.mfi(',
        'cci(': 'ta.cci(',
        'cmo(': 'ta.cmo(',
        'cog(': 'ta.cog(',
        'dmi(': 'ta.dmi(',
        'supertrend(': 'ta.supertrend(',
        'pivothigh(': 'ta.pivothigh(',
        'pivotlow(': 'ta.pivotlow(',
        'highest(': 'ta.highest(',
        'lowest(': 'ta.lowest(',
        'highestbars(': 'ta.highestbars(',
        'lowestbars(': 'ta.lowestbars(',
        'barssince(': 'ta.barssince(',
        'crossover(': 'ta.crossover(',
        'crossunder(': 'ta.crossunder(',
        'cross(': 'ta.cross(',
        'valuewhen(': 'ta.valuewhen(',
        'change(': 'ta.change(',
        'mom(': 'ta.mom(',
        'percentrank(': 'ta.percentrank(',
        'variance(': 'ta.variance(',
        'stdev(': 'ta.stdev(',
        'correlation(': 'ta.correlation(',
        'cum(': 'ta.cum(',
        'falling(': 'ta.falling(',
        'rising(': 'ta.rising(',
        'tr(': 'ta.tr(',
        'vwap(': 'ta.vwap(',
        'sar(': 'ta.sar(',
        // math functions
        'abs(': 'math.abs(',
        'ceil(': 'math.ceil(',
        'floor(': 'math.floor(',
        'log(': 'math.log(',
        'log10(': 'math.log10(',
        'max(': 'math.max(',
        'min(': 'math.min(',
        'pow(': 'math.pow(',
        'round(': 'math.round(',
        'sign(': 'math.sign(',
        'sqrt(': 'math.sqrt(',
        'avg(': 'math.avg(',
        'sum(': 'math.sum(',
        // string functions
        'tostring(': 'str.tostring(',
    };

    for (const [legacy, modern] of Object.entries(legacyFnMap)) {
        // Only replace if NOT already namespaced (avoid ta.ta.sma)
        // Use a regex that checks there's no dot immediately before the function name
        const fnName = legacy.replace('(', '');
        const regex = new RegExp(`(?<!\\.)\\b${fnName}\\s*\\(`, 'g');
        fixed = fixed.replace(regex, modern);
    }

    // 2. Ensure there's exactly one //@version=6 at the top
    const lines = fixed.split('\n');
    const versionLines = lines.filter(l => /^\s*\/\/@version\s*=?\s*\d+/.test(l));
    if (versionLines.length > 1) {
        // Remove all version lines and re-add one at top
        const filtered = lines.filter(l => !/^\s*\/\/@version\s*=?\s*\d+/.test(l));
        fixed = `//@version=6\n${filtered.join('\n')}`;
    }

    // 3. Fix common color references without namespace
    const colorMap: Record<string, string> = {
        'color.red': 'color.red',       // already correct, no-op
        'color.green': 'color.green',
        'color.blue': 'color.blue',
    };
    // Fix bare color() constructor usage — color(r,g,b) should be color.rgb(r,g,b)  
    fixed = fixed.replace(/(?<!\.)(?<!\w)color\s*\(\s*(\d)/g, 'color.rgb($1');

    // 4. Fix input() to input.int() / input.float() where type can be inferred
    // Only do this if the code uses old-style input() with integer defaults
    // (Don't touch if already using input.int/input.float)

    return fixed;
}
