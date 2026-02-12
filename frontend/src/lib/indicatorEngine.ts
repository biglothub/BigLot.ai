/**
 * Indicator Runtime Engine
 * Safely executes generated indicator code in the browser
 */
import type { OHLCV, IndicatorValue, IndicatorConfig } from '$lib/types/indicator';

export type IndicatorModule = {
    indicatorConfig: IndicatorConfig;
    calculate: (data: OHLCV[], params: Record<string, number>) => IndicatorValue[];
};

/**
 * Parse and validate indicator code, returning an executable module
 * Uses Function constructor for sandboxed execution
 */
export function loadIndicatorModule(code: string): IndicatorModule {
    try {
        // Wrap the code in a module-like function
        // Replace export statements to make it work inside Function constructor
        const cleanCode = code
            .replace(/export\s+/g, '')
            .replace(/import\s+.*?;/g, ''); // Remove any import statements

        const fn = new Function(`
            ${cleanCode}
            return { indicatorConfig, calculate };
        `);

        const mod = fn() as IndicatorModule;

        // Validate the module structure
        if (!mod.indicatorConfig || typeof mod.indicatorConfig !== 'object') {
            throw new Error('Missing or invalid indicatorConfig');
        }
        if (typeof mod.calculate !== 'function') {
            throw new Error('Missing or invalid calculate function');
        }
        if (!mod.indicatorConfig.name || !mod.indicatorConfig.params) {
            throw new Error('indicatorConfig must have name and params');
        }

        return mod;
    } catch (err: any) {
        throw new Error(`Failed to load indicator: ${err.message}`);
    }
}

/**
 * Execute an indicator's calculate function with safety checks
 */
export function executeIndicator(
    mod: IndicatorModule,
    data: OHLCV[],
    params?: Record<string, number>
): IndicatorValue[] {
    // Merge default params with user overrides
    const mergedParams: Record<string, number> = {};
    for (const [key, paramDef] of Object.entries(mod.indicatorConfig.params)) {
        mergedParams[key] = params?.[key] ?? paramDef.default;
    }

    try {
        const result = mod.calculate(data, mergedParams);

        // Basic validation of output
        if (!Array.isArray(result)) {
            throw new Error('calculate() must return an array');
        }

        return result;
    } catch (err: any) {
        throw new Error(`Indicator execution error: ${err.message}`);
    }
}

/**
 * Generate sample OHLCV data for testing indicators
 */
export function generateSampleData(bars: number = 100): OHLCV[] {
    const data: OHLCV[] = [];
    let price = 100;
    const now = Date.now();

    for (let i = 0; i < bars; i++) {
        const change = (Math.random() - 0.48) * 3;
        const open = price;
        const close = price + change;
        const high = Math.max(open, close) + Math.random() * 2;
        const low = Math.min(open, close) - Math.random() * 2;
        const volume = Math.floor(Math.random() * 10000) + 1000;

        data.push({
            timestamp: now - (bars - i) * 60000, // 1-minute bars
            open: +open.toFixed(2),
            high: +high.toFixed(2),
            low: +low.toFixed(2),
            close: +close.toFixed(2),
            volume
        });

        price = close;
    }

    return data;
}
