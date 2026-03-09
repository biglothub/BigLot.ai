/**
 * BigLot.ai Proprietary Indicator Engine
 * Server-side only — uses private env variables
 * 
 * Uses advanced AI logic for synchronous indicator generation.
 */
import { findBestReference, buildReferenceEnhancedPrompt, buildSearchPrompt, buildTemplatePrompt } from '$lib/pinescriptLibrary';
import { getClientForModel, resolveDefaultAIModel, type AIModel } from '$lib/server/aiProvider.server';
import { validatePineScript, type PineValidationError } from '$lib/server/pineValidator';

// ─── GPT Model Options ───
export type GPTModel = AIModel;

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
4. **Groundedness**: For advanced concepts like "Market Structure", "SMC", "BOS/CHoCH", "Order Blocks", or "Trend Tracer", you MUST strictly follow the logic provided in the REFERENCE BASE CODE if one is available. These codes are based on verified open-source scripts from top authors like LuxAlgo.
5. **Consistency**: Ensure the visual style (plots, colors, shapes) is consistent with the reference provided.
6. Format output as separate code blocks: \`\`\`pine ... \`\`\` and \`\`\`javascript ... \`\`\`.

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

CORRECT COMPLETE EXAMPLE (use this as your formatting reference):
\`\`\`pine
//@version=6
indicator("RSI with Levels", overlay=false)

// Inputs — ALWAYS at global scope
length = input.int(14, "RSI Length", minval=1, maxval=100)
src = input.source(close, "Source")
obLevel = input.int(70, "Overbought", minval=50, maxval=100)
osLevel = input.int(30, "Oversold", minval=0, maxval=50)

// Calculation
rsiVal = ta.rsi(src, length)

// Plotting — ALWAYS at global scope, use conditional values for dynamic behavior
overbought = hline(obLevel, "Overbought", color=color.new(color.red, 50))
oversold = hline(osLevel, "Oversold", color=color.new(color.green, 50))
fill(overbought, oversold, color=color.new(color.blue, 90))
plot(rsiVal, "RSI", color=color.blue, linewidth=2)

// Signals — calculate in variables, plot at global scope
buySignal = ta.crossover(rsiVal, osLevel)
sellSignal = ta.crossunder(rsiVal, obLevel)
plotshape(buySignal, "Buy", shape.triangleup, location.bottom, color.green, size=size.small)
plotshape(sellSignal, "Sell", shape.triangledown, location.top, color.red, size=size.small)
\`\`\`
`;

// ─── INDICATOR GENERATION ───

export type GenerateIndicatorResult = {
  code: string | null;
  previewCode: string | null;
  textOutput: string;
  referenceUsed: string | null;
  model: string;
  retryCount: number;
  validationErrors: PineValidationError[];
};

/**
 * Generate an indicator from a user prompt using OpenAI/DeepSeek.
 * Includes automatic retry (up to 2x) when validation fails.
 */
export async function generateIndicator(
  prompt: string,
  options?: {
    model?: GPTModel;
    postProcess?: (code: string) => string;
  }
): Promise<GenerateIndicatorResult> {
  const model = options?.model ?? resolveDefaultAIModel();
  const { client, apiModel, provider } = getClientForModel(model);
  const MAX_RETRIES = 2;

  // ─── REFERENCE MATCHING ENGINE (3-tier) ───
  let finalPrompt: string;
  let referenceUsed: string | null = null;

  const { match, score, allMatches } = findBestReference(prompt);

  if (match && score >= 0.50) {
    // High-confidence match → template mode (minimal changes only)
    console.log(`[BigLot.ai] Template match: "${match.name}" (score: ${(score * 100).toFixed(0)}%) by ${match.author}`);
    finalPrompt = buildTemplatePrompt(prompt, match);
    referenceUsed = `${match.name} by ${match.author}`;
  } else if (match && score >= 0.15) {
    // Moderate match → reference-enhanced mode
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

  // ─── GENERATION WITH RETRY LOOP ───
  let lastCode: string | null = null;
  let lastJsCode: string | null = null;
  let lastTextOutput = '';
  let lastErrors: PineValidationError[] = [];
  let retryCount = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const isRetry = attempt > 0;
    const temperature = isRetry ? 0.05 : 0.1;
    const currentPrompt = isRetry
      ? buildRetryPrompt(finalPrompt, lastCode!, lastErrors)
      : finalPrompt;

    console.log(`[BigLot.ai] ${isRetry ? `Retry #${attempt}` : 'Generating'} indicator with ${model} (${provider})...`);
    const startTime = Date.now();

    const completion = await client.chat.completions.create({
      model: apiModel,
      messages: [
        { role: 'system', content: INDICATOR_SYSTEM_INSTRUCTION },
        { role: 'user', content: currentPrompt }
      ],
      temperature,
      max_tokens: 8192,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[BigLot.ai] GPT response received in ${elapsed}s (${model})`);

    lastTextOutput = completion.choices[0]?.message?.content ?? '';
    const { pineCode, jsCode } = extractCodeBlocks(lastTextOutput);
    lastCode = pineCode;
    lastJsCode = jsCode ?? lastJsCode; // Keep previous JS if new one is null

    if (!lastCode) {
      // No code block extracted — skip validation, return as-is
      break;
    }

    // Apply post-processing (normalization + auto-fix) before validation
    if (options?.postProcess) {
      lastCode = options.postProcess(lastCode);
    }

    // Validate
    const validation = validatePineScript(lastCode);
    lastErrors = validation.errors;

    if (validation.valid) {
      console.log(`[BigLot.ai] Validation passed${isRetry ? ` (after ${attempt} retry)` : ''}`);
      break;
    }

    const errorCount = lastErrors.filter(e => e.severity === 'error').length;
    if (attempt < MAX_RETRIES) {
      console.log(`[BigLot.ai] Validation failed (${errorCount} errors) — retrying...`);
      retryCount = attempt + 1;
    } else {
      console.log(`[BigLot.ai] Validation failed after ${MAX_RETRIES} retries (${errorCount} errors) — returning best effort`);
    }
  }

  return {
    code: lastCode,
    previewCode: lastJsCode,
    textOutput: lastTextOutput,
    referenceUsed,
    model,
    retryCount,
    validationErrors: lastErrors
  };
}

/**
 * Build a retry prompt that includes the broken code and error details
 */
function buildRetryPrompt(originalPrompt: string, brokenCode: string, errors: PineValidationError[]): string {
  const errorList = errors
    .filter(e => e.severity === 'error')
    .map((e, i) => `${i + 1}. ${e.line > 0 ? `Line ${e.line}: ` : ''}${e.message}`)
    .join('\n');

  return `${originalPrompt}

⚠️ YOUR PREVIOUS CODE HAD ERRORS. Fix ALL of them:

${errorList}

BROKEN CODE:
\`\`\`pine
${brokenCode}
\`\`\`

Fix ALL the errors above and return the CORRECTED PineScript and JavaScript preview.
Remember: ALL plot/hline/fill/bgcolor/plotshape calls MUST be at global scope.
ALL input() calls MUST be at global scope.
Use only valid PineScript v6 namespaced functions.`;
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
