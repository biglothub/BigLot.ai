/**
 * OpenAI GPT Client for BigLot.ai Indicator Builder
 * Server-side only — uses private env variables
 * 
 * Uses OpenAI GPT for synchronous indicator generation (no polling needed).
 */
import { env } from '$env/dynamic/private';
import { findBestReference, buildReferenceEnhancedPrompt, buildSearchPrompt } from '$lib/pinescriptLibrary';
import OpenAI from 'openai';

function getOpenAI(): OpenAI {
    const key = env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is not configured in .env');
    return new OpenAI({ apiKey: key });
}

// ─── GPT Model Options ───
export type GPTModel = 'gpt-4o' | 'gpt-4o-mini' | 'o3-mini';

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

// ─── INDICATOR GENERATION ───

export type GenerateIndicatorResult = {
    code: string | null;
    previewCode: string | null;
    textOutput: string;
    referenceUsed: string | null;
    model: string;
};

/**
 * Generate an indicator from a user prompt using OpenAI GPT.
 * Returns the result directly — no polling needed.
 */
export async function generateIndicator(
    prompt: string,
    options?: {
        model?: GPTModel;
    }
): Promise<GenerateIndicatorResult> {
    const openai = getOpenAI();
    const model = options?.model ?? 'gpt-4o';

    // ─── REFERENCE MATCHING ENGINE ───
    let finalPrompt: string;
    let referenceUsed: string | null = null;

    const { match, score, allMatches } = findBestReference(prompt);

    if (match && score >= 0.05) {
        console.log(`[BigLot.ai] Reference matched: "${match.name}" (score: ${(score * 100).toFixed(0)}%) by ${match.author}`);
        if (allMatches.length > 1) {
            console.log(`[BigLot.ai] Other candidates: ${allMatches.slice(1).map(m => `"${m.ref.name}" (${(m.score * 100).toFixed(0)}%)`).join(', ')}`);
        }
        finalPrompt = buildReferenceEnhancedPrompt(prompt, match);
        referenceUsed = `${match.name} by ${match.author}`;
    } else {
        console.log(`[BigLot.ai] No library match found for: "${prompt}" — using community search mode`);
        finalPrompt = buildSearchPrompt(prompt);
    }

    // ─── CALL GPT ───
    console.log(`[BigLot.ai] Generating indicator with ${model}...`);
    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
        model,
        messages: [
            { role: 'system', content: INDICATOR_SYSTEM_INSTRUCTION },
            { role: 'user', content: finalPrompt }
        ],
        temperature: 0.3,
        max_tokens: 8192,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[BigLot.ai] GPT response received in ${elapsed}s (${model})`);

    const textOutput = completion.choices[0]?.message?.content ?? '';

    // ─── EXTRACT CODE BLOCKS ───
    const { pineCode, jsCode } = extractCodeBlocks(textOutput);

    return {
        code: pineCode,
        previewCode: jsCode,
        textOutput,
        referenceUsed,
        model
    };
}

/**
 * Extract PineScript and JavaScript code blocks from GPT response text
 */
function extractCodeBlocks(text: string): { pineCode: string | null; jsCode: string | null } {
    let pineCode: string | null = null;
    let jsCode: string | null = null;

    const blocks = [...text.matchAll(/```(\w+)?\s*\r?\n([\s\S]*?)```/g)];

    for (const block of blocks) {
        const lang = (block[1] ?? '').toLowerCase();
        const blockText = block[2].trim();
        if (!blockText) continue;

        if (!pineCode && (lang.includes('pine') || isLikelyPineCode(blockText))) {
            pineCode = blockText;
        }
        if (!jsCode && (isJavaScriptBlock(lang) || isLikelyPreviewCode(blockText))) {
            jsCode = blockText;
        }
    }

    return { pineCode, jsCode };
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
