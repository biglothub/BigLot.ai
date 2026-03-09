/**
 * PineScript v6 Structural Validator
 * Static analysis to catch common errors before delivering to user.
 * Intentionally conservative — few false positives, may miss some errors.
 */

export type PineValidationError = {
    line: number;
    message: string;
    severity: 'error' | 'warning';
};

// Valid namespaced functions in PineScript v6
const VALID_TA_FUNCTIONS = new Set([
    'sma', 'ema', 'rsi', 'atr', 'stoch', 'macd', 'bb', 'wma', 'vwma', 'swma',
    'alma', 'hma', 'rma', 'mfi', 'cci', 'cmo', 'cog', 'dmi', 'supertrend',
    'pivothigh', 'pivotlow', 'highest', 'lowest', 'highestbars', 'lowestbars',
    'barssince', 'crossover', 'crossunder', 'cross', 'valuewhen', 'change',
    'mom', 'percentrank', 'variance', 'stdev', 'correlation', 'cum', 'falling',
    'rising', 'tr', 'vwap', 'sar', 'roc', 'kc', 'donchian', 'linreg',
    'median', 'mode', 'percentile_linear_interpolation', 'percentile_nearest_rank',
]);

const VALID_MATH_FUNCTIONS = new Set([
    'abs', 'ceil', 'floor', 'log', 'log10', 'max', 'min', 'pow', 'round',
    'sign', 'sqrt', 'avg', 'sum', 'todegrees', 'toradians', 'random',
    'acos', 'asin', 'atan', 'cos', 'sin', 'tan', 'exp',
]);

const VALID_STR_FUNCTIONS = new Set([
    'tostring', 'format', 'length', 'contains', 'startswith', 'endswith',
    'substring', 'replace', 'replace_all', 'lower', 'upper', 'trim',
    'split', 'tonumber', 'pos', 'match',
]);

const VALID_COLOR_FUNCTIONS = new Set([
    'new', 'rgb', 'r', 'g', 'b', 't', 'from_gradient',
]);

const VALID_REQUEST_FUNCTIONS = new Set([
    'security', 'security_lower_tf', 'financial', 'quandl', 'dividends',
    'earnings', 'splits', 'seed', 'currency_rate',
]);

// Functions that MUST be at global scope in PineScript
const GLOBAL_SCOPE_ONLY = new Set([
    'plot', 'fill', 'hline', 'bgcolor', 'plotshape', 'plotchar',
    'plotbar', 'plotcandle', 'plotarrow', 'barcolor',
]);

// Block-opening keywords
const BLOCK_OPENERS = /^(?:if|else|for|while|switch|(?:export\s+)?(?:method|type)\s+\w+|(\w+)\s*\(.*\)\s*=>)/;

/**
 * Validate PineScript v6 code and return structured errors.
 */
export function validatePineScript(code: string): { valid: boolean; errors: PineValidationError[] } {
    const errors: PineValidationError[] = [];
    const lines = code.split('\n');

    // Track scope depth via indentation
    let baseIndent = -1; // will be set from first non-comment, non-empty line after indicator()
    let insideBlock = false;
    let blockDepth = 0;
    let prevIndent = 0;
    let foundIndicator = false;
    let foundStrategy = false;
    let versionCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const lineNum = i + 1;

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('//')) {
            // Check version directives in comments
            if (/^\s*\/\/@version\s*=?\s*\d+/.test(line)) {
                versionCount++;
            }
            continue;
        }

        // Detect indicator/strategy declaration
        if (/^\s*indicator\s*\(/.test(line)) foundIndicator = true;
        if (/^\s*strategy\s*\(/.test(line)) foundStrategy = true;

        // Calculate indentation (spaces or tabs)
        const indent = line.length - line.trimStart().length;

        // Set base indent from first code line
        if (baseIndent < 0) {
            baseIndent = indent;
        }

        // Simple scope tracking: if indent > base, we're in a block
        const isGlobalScope = indent <= baseIndent;

        // Check global-scope-only functions
        if (!isGlobalScope) {
            for (const fn of GLOBAL_SCOPE_ONLY) {
                // Match function call like: plot(, plotshape(, etc.
                const fnRegex = new RegExp(`\\b${fn}\\s*\\(`);
                if (fnRegex.test(trimmed)) {
                    errors.push({
                        line: lineNum,
                        message: `'${fn}()' must be at global scope — cannot be inside if/for/while/function block. Use conditional values instead: ${fn}(condition ? value : na)`,
                        severity: 'error'
                    });
                }
            }

            // Check input.* at non-global scope
            if (/\binput\s*\.?\s*(int|float|bool|string|source|color)?\s*\(/.test(trimmed)) {
                errors.push({
                    line: lineNum,
                    message: `'input()' must be at global scope — move it outside of any if/for/function block`,
                    severity: 'error'
                });
            }
        }

        // Check for invalid namespaced functions
        const taMatch = trimmed.match(/\bta\.(\w+)\s*\(/g);
        if (taMatch) {
            for (const m of taMatch) {
                const fnName = m.match(/\bta\.(\w+)/)?.[1];
                if (fnName && !VALID_TA_FUNCTIONS.has(fnName)) {
                    errors.push({
                        line: lineNum,
                        message: `Unknown function 'ta.${fnName}()' — this function does not exist in PineScript v6`,
                        severity: 'error'
                    });
                }
            }
        }

        const mathMatch = trimmed.match(/\bmath\.(\w+)\s*\(/g);
        if (mathMatch) {
            for (const m of mathMatch) {
                const fnName = m.match(/\bmath\.(\w+)/)?.[1];
                if (fnName && !VALID_MATH_FUNCTIONS.has(fnName)) {
                    errors.push({
                        line: lineNum,
                        message: `Unknown function 'math.${fnName}()' — this function does not exist in PineScript v6`,
                        severity: 'error'
                    });
                }
            }
        }

        const strMatch = trimmed.match(/\bstr\.(\w+)\s*\(/g);
        if (strMatch) {
            for (const m of strMatch) {
                const fnName = m.match(/\bstr\.(\w+)/)?.[1];
                if (fnName && !VALID_STR_FUNCTIONS.has(fnName)) {
                    errors.push({
                        line: lineNum,
                        message: `Unknown function 'str.${fnName}()' — this function does not exist in PineScript v6`,
                        severity: 'error'
                    });
                }
            }
        }

        const colorMatch = trimmed.match(/\bcolor\.(\w+)\s*\(/g);
        if (colorMatch) {
            for (const m of colorMatch) {
                const fnName = m.match(/\bcolor\.(\w+)/)?.[1];
                if (fnName && !VALID_COLOR_FUNCTIONS.has(fnName)) {
                    // color.red, color.blue etc. are constants not functions — skip if no parens follow
                    // Only flag if it looks like a function call with (
                    errors.push({
                        line: lineNum,
                        message: `Unknown function 'color.${fnName}()' — did you mean color.new() or color.rgb()?`,
                        severity: 'warning'
                    });
                }
            }
        }

        const reqMatch = trimmed.match(/\brequest\.(\w+)\s*\(/g);
        if (reqMatch) {
            for (const m of reqMatch) {
                const fnName = m.match(/\brequest\.(\w+)/)?.[1];
                if (fnName && !VALID_REQUEST_FUNCTIONS.has(fnName)) {
                    errors.push({
                        line: lineNum,
                        message: `Unknown function 'request.${fnName}()' — this function does not exist in PineScript v6`,
                        severity: 'error'
                    });
                }
            }
        }

        prevIndent = indent;
    }

    // Check bracket balance
    let parenDepth = 0;
    let bracketDepth = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        // Skip comments
        if (trimmed.startsWith('//')) continue;
        // Remove string literals to avoid counting brackets inside strings
        const noStrings = trimmed.replace(/"[^"]*"|'[^']*'/g, '""');
        for (const ch of noStrings) {
            if (ch === '(') parenDepth++;
            else if (ch === ')') parenDepth--;
            else if (ch === '[') bracketDepth++;
            else if (ch === ']') bracketDepth--;
        }
    }

    if (parenDepth !== 0) {
        errors.push({
            line: 0,
            message: `Unbalanced parentheses: ${parenDepth > 0 ? `${parenDepth} unclosed '('` : `${Math.abs(parenDepth)} extra ')'`}`,
            severity: 'error'
        });
    }
    if (bracketDepth !== 0) {
        errors.push({
            line: 0,
            message: `Unbalanced brackets: ${bracketDepth > 0 ? `${bracketDepth} unclosed '['` : `${Math.abs(bracketDepth)} extra ']'`}`,
            severity: 'error'
        });
    }

    // Check indicator/strategy presence
    if (!foundIndicator && !foundStrategy) {
        errors.push({
            line: 0,
            message: `Missing indicator() or strategy() declaration — every PineScript must have exactly one`,
            severity: 'error'
        });
    }

    // Check version directive count
    if (versionCount === 0) {
        errors.push({
            line: 1,
            message: `Missing //@version=6 directive`,
            severity: 'error'
        });
    } else if (versionCount > 1) {
        errors.push({
            line: 1,
            message: `Multiple @version directives found (${versionCount}) — must have exactly one`,
            severity: 'warning'
        });
    }

    return {
        valid: errors.filter(e => e.severity === 'error').length === 0,
        errors
    };
}
