/**
 * POST /api/engine — Generate indicator via BigLot.ai proprietary engine
 */
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { generateIndicator, type GPTModel } from '$lib/aiEngine';

export const POST: RequestHandler = async ({ request }) => {
    const { prompt, model } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
        return json({ error: 'Prompt is required' }, { status: 400 });
    }

    try {
        const result = await generateIndicator(prompt, {
            model: (model as GPTModel) ?? 'gpt-4o'
        });

        // Post-process PineScript
        let finalCode = result.code;
        if (finalCode) {
            finalCode = normalizePineToV6(finalCode);
            finalCode = validateAndFixPineScript(finalCode);
        }

        let finalPreviewCode = result.previewCode ? stripCodeFences(result.previewCode) : null;

        // Parse config from PineScript
        let config;
        if (finalCode) {
            try {
                config = parsePineScriptConfig(finalCode);
            } catch (e) {
                console.warn('Config parsing failed', e);
                config = { name: 'Custom Indicator', description: 'PineScript Indicator', overlayType: 'separate', params: {} };
            }
        } else {
            config = { name: 'Generating...', description: '', overlayType: 'separate', params: {} };
        }

        return json({
            status: 'completed',
            code: finalCode,
            previewCode: finalPreviewCode,
            textOutput: result.textOutput,
            config,
            referenceUsed: result.referenceUsed,
            model: result.model
        });
    } catch (err: any) {
        console.error('GPT Indicator generation error:', err);
        return json({ error: err.message || 'Failed to generate indicator' }, { status: 500 });
    }
};

// ─── HELPERS ───

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

    // Remove ALL existing @version directives
    let body = clean.replace(/^\s*\/\/\s*@version\s*=?\s*\d+\s*$/gm, '').trimStart();

    // Remove credits, authors and external links to keep it proprietary
    body = body
        .replace(/^\s*\/\/\s*@author.*$/gm, '')
        .replace(/^\s*\/\/\s*©.*$/gm, '')
        .replace(/https?:\/\/(?:www\.)?(?:tradingview\.com|pinescriptpc\.com)[^\s]*/gi, '')
        .replace(/^\s*\/\/\s*Source:.*$/gm, '')
        .trim();

    return `//@version=6\n${body}`;
}

function stripCodeFences(raw: string): string {
    return raw
        .replace(/^```[a-zA-Z]*\s*\r?\n/, '')
        .replace(/\r?\n```[\t ]*$/, '')
        .trim();
}

/**
 * Validate and auto-fix common PineScript issues before delivering to user
 */
function validateAndFixPineScript(code: string): string {
    let fixed = code;

    // 1. Fix legacy function calls without namespace
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
        const fnName = legacy.replace('(', '');
        const regex = new RegExp(`(?<!\\.)\\b${fnName}\\s*\\(`, 'g');
        fixed = fixed.replace(regex, modern);
    }

    // 2. Ensure there's exactly one //@version=6 at the top
    const lines = fixed.split('\n');
    const versionLines = lines.filter(l => /^\s*\/\/@version\s*=?\s*\d+/.test(l));
    if (versionLines.length > 1) {
        const filtered = lines.filter(l => !/^\s*\/\/@version\s*=?\s*\d+/.test(l));
        fixed = `//@version=6\n${filtered.join('\n')}`;
    }

    // 3. Fix bare color() constructor → color.rgb()
    fixed = fixed.replace(/(?<!\.)(?<!\w)color\s*\(\s*(\d)/g, 'color.rgb($1');

    return fixed;
}
