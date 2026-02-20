<script lang="ts">
    import {
        Wand2,
        Play,
        Save,
        Trash2,
        Code2,
        BarChart3,
        Loader2,
        ChevronDown,
        ChevronUp,
        RefreshCw,
        Zap,
        Copy,
        Check,
        AlertTriangle,
        Settings2,
        ExternalLink,
        Bot,
        ArrowLeft,
        Maximize2,
        Minimize2,
        Monitor,
        Table2,
    } from "lucide-svelte";
    import { onMount } from "svelte";
    import { indicatorBuilder } from "$lib/state/indicatorBuilder.svelte";
    import { type IndicatorModule } from "$lib/indicatorEngine";
    import IndicatorChart from "./IndicatorChart.svelte";
    import type {
        IndicatorActivityLog,
        IndicatorValue,
        OHLCV,
    } from "$lib/types/indicator";

    onMount(() => {
        indicatorBuilder.loadIndicators();
    });

    let prompt = $state("");
    let showCode = $state(true); // Default to true for PineScript
    let showParams = $state(false);
    let showSaved = $state(false);
    let showPreview = $state(true);
    let previewExpanded = $state(false);
    let loadedModule = $state<IndicatorModule | null>(null); // Still used for config display
    let codeEditing = $state(false);
    let editableCode = $state("");
    let copied = $state(false);
    let sqlCopied = $state(false);
    let saving = $state(false);
    let saveSuccess = $state(false);
    let userParams = $state<Record<string, number>>({});
    let testResults = $state<IndicatorValue[] | null>(null);
    let testError = $state<string | null>(null);
    let chartOhlcvData = $state<OHLCV[]>([]);
    let previewTab = $state<"chart" | "data">("chart");
    let logContainer = $state<HTMLElement | null>(null);

    // UX: Dripping logs for better perception
    let displayedLogs = $state<IndicatorActivityLog[]>([]);
    let showFinalSuccess = $state(false);

    $effect(() => {
        const rawLogs = indicatorBuilder.progress.activityLog || [];
        const status = indicatorBuilder.progress.status;

        // Detect new session / reset
        if (rawLogs.length > 0 && displayedLogs.length > 0) {
            if (rawLogs[0].id !== displayedLogs[0].id) {
                displayedLogs = [];
                showFinalSuccess = false;
                return;
            }
        } else if (rawLogs.length === 0 && displayedLogs.length > 0) {
            displayedLogs = [];
            showFinalSuccess = false;
            return;
        }

        if (rawLogs.length > displayedLogs.length) {
            const nextIndex = displayedLogs.length;
            const logToAdd = rawLogs[nextIndex];
            // Slow down subsequent logs for better readability
            const delay = nextIndex === 0 ? 0 : 800;

            const timeout = setTimeout(() => {
                displayedLogs = [...displayedLogs, logToAdd];
            }, delay);

            return () => clearTimeout(timeout);
        }

        if (
            status === "ready" &&
            rawLogs.length === displayedLogs.length &&
            !showFinalSuccess
        ) {
            const timeout = setTimeout(() => {
                showFinalSuccess = true;
            }, 800);
            return () => clearTimeout(timeout);
        }
    });

    $effect(() => {
        if (displayedLogs.length > 0 && logContainer) {
            // Small delay to ensure DOM has updated
            const timeout = setTimeout(() => {
                logContainer?.scrollTo({
                    top: logContainer.scrollHeight,
                    behavior: "smooth",
                });
            }, 100);
            return () => clearTimeout(timeout);
        }
    });

    const progress = $derived(indicatorBuilder.progress);
    const isGenerating = $derived(
        progress.status === "generating" || progress.status === "submitting",
    );
    const isReady = $derived(progress.status === "ready");

    function formatLogTime(timestamp: number): string {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    }

    function getLogTypeLabel(type: IndicatorActivityLog["type"]): string {
        if (type === "task_created") return "Created";
        if (type === "task_progress") return "Progress";
        if (type === "task_stopped") return "Stopped";
        return "System";
    }

    function getLogDotClass(type: IndicatorActivityLog["type"]): string {
        if (type === "task_created") return "bg-primary";
        if (type === "task_progress") return "bg-green-400";
        if (type === "task_stopped") return "bg-yellow-400";
        return "bg-white/30";
    }

    function handleSubmit() {
        if (!prompt.trim() || isGenerating) return;
        loadedModule = null;
        indicatorBuilder.generateFromPrompt(prompt);
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    }

    /**
     * Auto-generate JavaScript preview code from PineScript
     * Detects common indicator patterns and creates a working simulation
     */
    function generatePreviewFromPine(pineCode: string): string {
        const lower = pineCode.toLowerCase();

        // Helper functions that all generated previews can use
        const helpers = `
function sma(values, period) {
    const result = [];
    for (let i = 0; i < values.length; i++) {
        if (i < period - 1) { result.push(null); continue; }
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += values[j];
        result.push(sum / period);
    }
    return result;
}
function ema(values, period) {
    const result = [];
    const k = 2 / (period + 1);
    let prev = null;
    for (let i = 0; i < values.length; i++) {
        if (i < period - 1) { result.push(null); continue; }
        if (prev === null) {
            let sum = 0;
            for (let j = i - period + 1; j <= i; j++) sum += values[j];
            prev = sum / period;
        } else {
            prev = values[i] * k + prev * (1 - k);
        }
        result.push(prev);
    }
    return result;
}
function stdev(values, period) {
    const result = [];
    for (let i = 0; i < values.length; i++) {
        if (i < period - 1) { result.push(null); continue; }
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += values[j];
        const mean = sum / period;
        let sqSum = 0;
        for (let j = i - period + 1; j <= i; j++) sqSum += (values[j] - mean) ** 2;
        result.push(Math.sqrt(sqSum / period));
    }
    return result;
}
function trueRange(data) {
    return data.map((d, i) => {
        if (i === 0) return d.high - d.low;
        const prev = data[i - 1].close;
        return Math.max(d.high - d.low, Math.abs(d.high - prev), Math.abs(d.low - prev));
    });
}
`;

        // Detect indicator type from PineScript and generate appropriate code
        // Extract periods from PineScript input() calls
        const periodMatches = pineCode.match(/input(?:\.int)?\s*\(\s*(\d+)/g);
        const periods = periodMatches
            ? periodMatches.map((m: string) => parseInt(m.match(/(\d+)/)![1]))
            : [];

        // RSI detection
        if (
            lower.includes("ta.rsi") ||
            lower.includes("rsi(") ||
            (lower.includes("rsi") && lower.includes("indicator"))
        ) {
            const period = periods[0] || 14;
            return `${helpers}
function calculate(data, params) {
    const period = params.period || ${period};
    const closes = data.map(d => d.close);
    const results = [];
    let avgGain = 0, avgLoss = 0;
    for (let i = 1; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        if (i <= period) {
            avgGain += gain / period;
            avgLoss += loss / period;
            if (i < period) { results.push({ timestamp: data[i].timestamp, values: { rsi: null } }); continue; }
        } else {
            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;
        }
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        const rsi = 100 - 100 / (1 + rs);
        let signal = 'neutral';
        if (rsi > 70) signal = 'sell';
        else if (rsi < 30) signal = 'buy';
        results.push({ timestamp: data[i].timestamp, values: { rsi, overbought: 70, oversold: 30 }, signal });
    }
    return results;
}`;
        }

        // MACD detection
        if (lower.includes("ta.macd") || lower.includes("macd")) {
            const fast = periods[0] || 12;
            const slow = periods[1] || 26;
            const sig = periods[2] || 9;
            return `${helpers}
function calculate(data, params) {
    const closes = data.map(d => d.close);
    const fastEma = ema(closes, ${fast});
    const slowEma = ema(closes, ${slow});
    const macdLine = fastEma.map((f, i) => (f !== null && slowEma[i] !== null) ? f - slowEma[i] : null);
    const macdValues = macdLine.filter(v => v !== null);
    const signalPadding = macdLine.findIndex(v => v !== null);
    const signalEma = ema(macdValues, ${sig});
    const results = [];
    let si = 0;
    for (let i = 0; i < data.length; i++) {
        const m = macdLine[i];
        let s = null, h = null, signal = 'neutral';
        if (m !== null && si < signalEma.length) {
            s = signalEma[si] ?? null;
            h = s !== null ? m - s : null;
            if (h !== null && h > 0) signal = 'buy';
            else if (h !== null && h < 0) signal = 'sell';
            si++;
        }
        results.push({ timestamp: data[i].timestamp, values: { macd: m, signal_line: s, histogram: h }, signal });
    }
    return results;
}`;
        }

        // Bollinger Bands detection
        if (
            lower.includes("ta.bb") ||
            lower.includes("bollinger") ||
            (lower.includes("bb") && lower.includes("basis"))
        ) {
            const period = periods[0] || 20;
            const mult = 2;
            return `${helpers}
function calculate(data, params) {
    const period = params.period || ${period};
    const mult = params.mult || ${mult};
    const closes = data.map(d => d.close);
    const basis = sma(closes, period);
    const sd = stdev(closes, period);
    return data.map((d, i) => ({
        timestamp: d.timestamp,
        values: {
            basis: basis[i],
            upper: basis[i] !== null ? basis[i] + mult * sd[i] : null,
            lower: basis[i] !== null ? basis[i] - mult * sd[i] : null,
            close: d.close
        },
        signal: basis[i] !== null && d.close < basis[i] - mult * sd[i] ? 'buy' : basis[i] !== null && d.close > basis[i] + mult * sd[i] ? 'sell' : 'neutral'
    }));
}`;
        }

        // Stochastic detection
        if (
            lower.includes("ta.stoch") ||
            lower.includes("stochastic") ||
            (lower.includes("%k") && lower.includes("%d"))
        ) {
            const kPeriod = periods[0] || 14;
            const dPeriod = periods[1] || 3;
            return `${helpers}
function calculate(data, params) {
    const kPeriod = params.kPeriod || ${kPeriod};
    const dPeriod = params.dPeriod || ${dPeriod};
    const kValues = [];
    for (let i = 0; i < data.length; i++) {
        if (i < kPeriod - 1) { kValues.push(null); continue; }
        let hh = -Infinity, ll = Infinity;
        for (let j = i - kPeriod + 1; j <= i; j++) { hh = Math.max(hh, data[j].high); ll = Math.min(ll, data[j].low); }
        kValues.push(hh === ll ? 50 : ((data[i].close - ll) / (hh - ll)) * 100);
    }
    const dValues = sma(kValues.map(v => v ?? 0), dPeriod);
    return data.map((d, i) => ({
        timestamp: d.timestamp,
        values: { k: kValues[i], d: dValues[i], overbought: 80, oversold: 20 },
        signal: kValues[i] !== null && kValues[i] > 80 ? 'sell' : kValues[i] !== null && kValues[i] < 20 ? 'buy' : 'neutral'
    }));
}`;
        }

        // ATR detection
        if (
            lower.includes("ta.atr") ||
            lower.includes("atr(") ||
            lower.includes("average true range")
        ) {
            const period = periods[0] || 14;
            return `${helpers}
function calculate(data, params) {
    const period = params.period || ${period};
    const tr = trueRange(data);
    const atrValues = sma(tr, period);
    return data.map((d, i) => ({
        timestamp: d.timestamp,
        values: { atr: atrValues[i] },
        signal: 'neutral'
    }));
}`;
        }

        // EMA / SMA Crossover detection
        if (
            lower.includes("ta.crossover") ||
            lower.includes("ta.crossunder") ||
            lower.includes("crossover") ||
            lower.includes("cross(")
        ) {
            const fast = periods[0] || 9;
            const slow = periods[1] || 21;
            const usesEma = lower.includes("ta.ema") || lower.includes("ema(");
            const fn = usesEma ? "ema" : "sma";
            return `${helpers}
function calculate(data, params) {
    const closes = data.map(d => d.close);
    const fastLine = ${fn}(closes, ${fast});
    const slowLine = ${fn}(closes, ${slow});
    return data.map((d, i) => {
        let signal = 'neutral';
        if (i > 0 && fastLine[i] !== null && slowLine[i] !== null && fastLine[i-1] !== null && slowLine[i-1] !== null) {
            if (fastLine[i] > slowLine[i] && fastLine[i-1] <= slowLine[i-1]) signal = 'buy';
            if (fastLine[i] < slowLine[i] && fastLine[i-1] >= slowLine[i-1]) signal = 'sell';
        }
        return { timestamp: d.timestamp, values: { fast_ma: fastLine[i], slow_ma: slowLine[i] }, signal };
    });
}`;
        }

        // VWAP detection
        if (lower.includes("ta.vwap") || lower.includes("vwap")) {
            return `${helpers}
function calculate(data, params) {
    let cumVol = 0, cumTP = 0;
    return data.map((d, i) => {
        const tp = (d.high + d.low + d.close) / 3;
        cumVol += d.volume;
        cumTP += tp * d.volume;
        const vwap = cumVol > 0 ? cumTP / cumVol : tp;
        return {
            timestamp: d.timestamp,
            values: { vwap, close: d.close },
            signal: d.close > vwap ? 'buy' : d.close < vwap ? 'sell' : 'neutral'
        };
    });
}`;
        }

        // Generic SMA / EMA (single)
        if (
            lower.includes("ta.sma") ||
            lower.includes("ta.ema") ||
            lower.includes("sma(") ||
            lower.includes("ema(")
        ) {
            const period = periods[0] || 20;
            const usesEma = lower.includes("ta.ema") || lower.includes("ema(");
            const fn = usesEma ? "ema" : "sma";
            const label = usesEma ? "ema" : "sma";
            return `${helpers}
function calculate(data, params) {
    const period = params.period || ${period};
    const closes = data.map(d => d.close);
    const maValues = ${fn}(closes, period);
    return data.map((d, i) => ({
        timestamp: d.timestamp,
        values: { ${label}: maValues[i], close: d.close },
        signal: maValues[i] !== null && d.close > maValues[i] ? 'buy' : maValues[i] !== null && d.close < maValues[i] ? 'sell' : 'neutral'
    }));
}`;
        }

        // Fallback: generic close-price based preview
        return `${helpers}
function calculate(data, params) {
    const period = params.period || 20;
    const closes = data.map(d => d.close);
    const maValues = sma(closes, period);
    return data.map((d, i) => ({
        timestamp: d.timestamp,
        values: { indicator: maValues[i], close: d.close },
        signal: 'neutral'
    }));
}`;
    }

    async function loadPreviewModule(jsCode: string) {
        try {
            const cleanCode = normalizePreviewJs(jsCode);

            // Create a function constructor
            const calculateFn = new Function(
                "data",
                "params",
                `
                const module = { exports: {} };
                const exports = module.exports;
                ${cleanCode}

                const resolvedCalculate =
                    typeof calculate === "function"
                        ? calculate
                        : typeof module.exports === "function"
                          ? module.exports
                          : typeof module.exports?.calculate === "function"
                            ? module.exports.calculate
                            : typeof exports?.calculate === "function"
                              ? exports.calculate
                              : null;

                if (typeof resolvedCalculate !== "function") {
                    throw new Error("Function 'calculate' not found in preview code");
                }

                const output = resolvedCalculate(data, params);
                if (!Array.isArray(output)) {
                    throw new Error("Preview calculate() must return an array");
                }
                return output;
            `,
            );

            return calculateFn;
        } catch (e) {
            console.error("Failed to load preview module", e);
            testError = "Preview generation failed: " + (e as Error).message;
            return null;
        }
    }

    function normalizePreviewJs(rawCode: string): string {
        return rawCode
            .replace(/^```[a-zA-Z]*\s*\r?\n/, "")
            .replace(/\r?\n```[\t ]*$/, "")
            .replace(/^import\s+.*;?\s*$/gm, "")
            .replace(
                /^\s*export\s+default\s+function\s*\(/gm,
                "const calculate = function(",
            )
            .replace(/^\s*export\s+default\s+/gm, "const calculate = ")
            .replace(
                /^\s*export\s+(?=(async\s+)?function|const|let|var)\s*/gm,
                "",
            )
            .replace(
                /^\s*module\.exports\s*=\s*function\s*\(/gm,
                "const calculate = function(",
            )
            .replace(/^\s*module\.exports\s*=\s*calculate\s*;?\s*$/gm, "")
            .replace(/^\s*exports\.calculate\s*=\s*calculate\s*;?\s*$/gm, "")
            .trim();
    }

    async function tryLoadAndTest() {
        const pineCode = editableCode || progress.generatedCode;
        if (!pineCode) return;

        // Reset
        testError = null;
        testResults = null;

        // 1. Setup Config (Metadata)
        if (progress.generatedConfig) {
            loadedModule = {
                indicatorConfig: progress.generatedConfig,
                calculate: () => [],
            };
        } else {
            loadedModule = {
                indicatorConfig: {
                    name: "PineScript Indicator",
                    description: "Custom PineScript",
                    overlayType: "separate",
                    params: {},
                },
                calculate: () => [],
            };
        }

        // 2. Determine which preview code to use
        let previewCode = progress.generatedPreviewCode;

        // 3. If no preview code from AI, auto-generate from PineScript
        if (!previewCode && pineCode) {
            console.log(
                "No preview code from AI, auto-generating from PineScript...",
            );
            previewCode = generatePreviewFromPine(pineCode);
        }

        // 4. Run the preview
        if (previewCode) {
            try {
                const calculateFn = await loadPreviewModule(previewCode);
                if (calculateFn) {
                    loadedModule.calculate = calculateFn as any;

                    // Generate realistic dummy OHLCV data for preview
                    let price = 100;
                    const dummyData: OHLCV[] = Array.from(
                        { length: 200 },
                        (_, i) => {
                            const change = (Math.random() - 0.48) * 3;
                            const open = price;
                            price += change;
                            const close = price;
                            const high =
                                Math.max(open, close) + Math.random() * 2;
                            const low =
                                Math.min(open, close) - Math.random() * 2;
                            return {
                                timestamp: Date.now() - (200 - i) * 60000,
                                open,
                                high,
                                low,
                                close,
                                volume: 800 + Math.random() * 1200,
                            };
                        },
                    );

                    // Store OHLCV for chart
                    chartOhlcvData = dummyData;

                    // Run calculation
                    const results = loadedModule.calculate(
                        dummyData,
                        userParams,
                    );
                    testResults = results;
                    showPreview = true;
                }
            } catch (e) {
                testError = "Preview execution failed: " + (e as Error).message;
            }
        } else {
            testError =
                "Could not generate preview. Please check the PineScript code.";
        }
    }

    async function handleSave() {
        const code = editableCode || progress.generatedCode;
        if (!code || !loadedModule || saving) return;

        saving = true;
        saveSuccess = false;
        try {
            await indicatorBuilder.saveIndicator(
                loadedModule.indicatorConfig.name,
                prompt,
                code,
                loadedModule.indicatorConfig,
                `gpt-${Date.now()}`,
            );
            saveSuccess = true;
            showSaved = true; // Auto expand My Indicators
            await indicatorBuilder.loadIndicators(); // Refresh list
            setTimeout(() => (saveSuccess = false), 3000);
        } catch (err) {
            console.error("Save failed:", err);
            testError = "Failed to save indicator: " + (err as Error).message;
        } finally {
            saving = false;
        }
    }

    function handleCopyCode() {
        const code = editableCode || progress.generatedCode;
        if (!code) return;
        navigator.clipboard.writeText(code);
        copied = true;
        setTimeout(() => (copied = false), 2000);
    }

    function handleOpenTradingView() {
        handleCopyCode();
        window.open("https://www.tradingview.com/chart/", "_blank");
    }

    function handleReset() {
        indicatorBuilder.reset();
        prompt = "";
        loadedModule = null;
        editableCode = "";
        showCode = false;
        showParams = false;
    }

    // Update editable code when generation completes
    $effect(() => {
        if (progress.generatedCode && !editableCode) {
            editableCode = progress.generatedCode;
        }
    });

    // Auto-test when code is ready
    $effect(() => {
        if (isReady && progress.generatedCode && !loadedModule) {
            tryLoadAndTest();
        }
    });
</script>

<div class="h-full flex flex-col bg-background overflow-hidden relative">
    <!-- Database Setup Warning Overlay -->
    {#if indicatorBuilder.dbError === "missing_table"}
        <div
            class="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6"
        >
            <div
                class="glass-panel w-full max-w-2xl p-8 border-primary/20 shadow-2xl shadow-primary/10"
            >
                <div class="flex items-center gap-4 mb-6">
                    <div
                        class="p-3 rounded-full bg-primary/20 text-primary animate-pulse"
                    >
                        <AlertTriangle size={32} />
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold text-foreground">
                            Database Setup Required
                        </h2>
                        <p class="text-muted-foreground">
                            The <code>custom_indicators</code> table is missing in
                            Supabase.
                        </p>
                    </div>
                </div>

                <div class="space-y-4">
                    <p class="text-sm text-foreground/80">
                        To use the Indicator Builder, you must run the following
                        SQL script in your Supabase SQL Editor:
                    </p>

                    <div class="relative group">
                        <pre
                            class="bg-black/50 border border-white/10 rounded-lg p-4 text-xs font-mono text-primary/90 overflow-x-auto">
CREATE TABLE custom_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  code TEXT NOT NULL,
  config JSONB NOT NULL,
  generation_id TEXT,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE custom_indicators DISABLE ROW LEVEL SECURITY;</pre>
                        <button
                            class="absolute top-2 right-2 p-2 bg-secondary text-primary rounded hover:bg-white/10 transition-all active:scale-90"
                            onclick={() => {
                                navigator.clipboard.writeText(
                                    `CREATE TABLE custom_indicators (...SQL...)`,
                                );
                                sqlCopied = true;
                                setTimeout(() => (sqlCopied = false), 2000);
                            }}
                            title="Copy SQL"
                        >
                            {#if sqlCopied}
                                <Check size={14} class="text-green-400" />
                            {:else}
                                <Copy size={14} />
                            {/if}
                        </button>
                    </div>

                    <div class="flex justify-end pt-4">
                        <button
                            onclick={() =>
                                window.open(
                                    "https://supabase.com/dashboard/project/_/sql",
                                    "_blank",
                                )}
                            class="indicator-btn indicator-btn-primary px-6 py-2 text-sm"
                        >
                            <ExternalLink size={16} /> Open Supabase SQL Editor
                        </button>
                    </div>
                </div>
            </div>
        </div>
    {/if}

    <!-- Header -->
    <div class="flex items-center gap-3 px-6 py-4 border-b border-border/50">
        <div class="flex-1">
            <h1
                class="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-white"
            >
                Indicator Builder
            </h1>
            <p class="text-xs text-muted-foreground">
                Prompt → BigLot.ai generates → Ready to use
            </p>
        </div>

        <!-- Branding -->
        <div
            class="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider"
        >
            Premium Engine
        </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6 indicator-scroll">
        <!-- Prompt Input Section -->
        <div class="glass-panel p-5 indicator-glow">
            <label class="block text-sm font-medium text-foreground/80 mb-3">
                <Wand2 size={14} class="inline mr-1.5 text-primary" />
                Describe your indicator
            </label>
            <div class="flex gap-3">
                <textarea
                    bind:value={prompt}
                    onkeydown={handleKeydown}
                    disabled={isGenerating}
                    placeholder="e.g., สร้าง RSI with divergence detection, overbought/oversold at 70/30, period 14..."
                    class="flex-1 bg-secondary/50 border border-white/10 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all min-h-[80px] text-sm disabled:opacity-50"
                    rows="3"
                ></textarea>
                <button
                    onclick={handleSubmit}
                    disabled={!prompt.trim() || isGenerating}
                    class="self-end px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center gap-2
                        {!prompt.trim() || isGenerating
                        ? 'bg-white/5 text-muted-foreground cursor-not-allowed'
                        : 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0'}"
                >
                    {#if isGenerating}
                        <Loader2 size={16} class="animate-spin" />
                        <span>Generating...</span>
                    {:else}
                        <Zap size={16} />
                        <span>Generate</span>
                    {/if}
                </button>
            </div>

            <!-- Quick Examples -->
            <div class="mt-3 flex flex-wrap gap-2">
                {#each ["MA Crossover", "Trend Lines with Breaks", "Trend Tracer Signals", "Order Block Detector", "SuperTrend"] as example}
                    <button
                        onclick={() => (prompt = example)}
                        class="px-3 py-1 rounded-lg text-xs bg-white/5 text-muted-foreground hover:bg-primary/10 hover:text-primary border border-white/5 hover:border-primary/20 transition-all"
                    >
                        {example}
                    </button>
                {/each}
            </div>
        </div>

        <!-- Generation Progress -->
        {#if progress.status !== "idle"}
            <div class="glass-panel p-5">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-sm font-semibold flex items-center gap-2">
                        {#if isGenerating}
                            <div class="relative">
                                <div
                                    class="w-3 h-3 rounded-full bg-primary animate-pulse"
                                ></div>
                                <div
                                    class="absolute inset-0 w-3 h-3 rounded-full bg-primary animate-ping opacity-20"
                                ></div>
                            </div>
                            <span class="text-primary"
                                >BigLot.ai is generating...</span
                            >
                        {:else if isReady}
                            <div
                                class="w-3 h-3 rounded-full bg-green-500"
                            ></div>
                            <span class="text-green-400">Indicator Ready</span>
                        {:else if progress.status === "error"}
                            <AlertTriangle size={14} class="text-red-400" />
                            <span class="text-red-400">Error</span>
                        {/if}
                    </h3>

                    <div class="flex items-center gap-2">
                        <button
                            onclick={handleReset}
                            class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                        >
                            <RefreshCw size={12} />
                            Reset
                        </button>
                    </div>
                </div>

                <!-- Progress Steps -->
                {#if isGenerating && progress.currentStep}
                    <div
                        class="flex items-center gap-3 py-3 px-4 bg-primary/5 rounded-lg border border-primary/10"
                    >
                        <Loader2
                            size={14}
                            class="animate-spin text-primary flex-shrink-0"
                        />
                        <span class="text-sm text-foreground/80"
                            >{progress.currentStep}</span
                        >
                    </div>
                {/if}

                <!-- BigLot AI Agent Activity -->
                {#if isGenerating || isReady || progress.status === "error"}
                    <div class="mt-4">
                        <div class="flex items-center justify-between mb-2">
                            <button
                                onclick={() => (showPreview = !showPreview)}
                                class="indicator-btn"
                            >
                                <Monitor size={14} />
                                {showPreview ? "Hide" : "Show"} Agent Activity
                                {#if showPreview}<ChevronUp
                                        size={12}
                                    />{:else}<ChevronDown size={12} />{/if}
                            </button>
                            <span
                                class="indicator-btn indicator-btn-primary cursor-default"
                            >
                                <Bot size={14} />
                                BigLot.ai Agent
                            </span>
                        </div>
                        {#if showPreview}
                            <div
                                class="rounded-xl border border-white/10 bg-[#060606] overflow-hidden"
                            >
                                <!-- Agent Header -->
                                <div
                                    class="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-gradient-to-r from-purple-500/5 to-primary/5"
                                >
                                    <div class="relative">
                                        <div
                                            class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-primary flex items-center justify-center"
                                        >
                                            <Bot size={14} class="text-white" />
                                        </div>
                                        {#if isGenerating}
                                            <div
                                                class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[#060606] animate-pulse"
                                            ></div>
                                        {:else}
                                            <div
                                                class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-muted-foreground/50 border-2 border-[#060606]"
                                            ></div>
                                        {/if}
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div
                                            class="text-sm font-semibold text-foreground/90"
                                        >
                                            BigLot.ai Agent
                                        </div>
                                        <div
                                            class="text-xs text-muted-foreground"
                                        >
                                            {#if isGenerating || (isReady && !showFinalSuccess)}
                                                <span
                                                    class="text-green-400 animate-pulse"
                                                    >● Working</span
                                                >
                                            {:else if isReady && showFinalSuccess}
                                                <span class="text-primary"
                                                    >● Completed</span
                                                >
                                            {:else}
                                                <span>● Idle</span>
                                            {/if}
                                            <span class="ml-2 opacity-50"
                                                >System: Secure</span
                                            >
                                        </div>
                                    </div>
                                </div>

                                <!-- Activity Log -->
                                <div
                                    bind:this={logContainer}
                                    class="px-4 py-3 space-y-2.5 max-h-[300px] overflow-y-auto indicator-scroll"
                                >
                                    {#if displayedLogs.length}
                                        {#each displayedLogs as entry, i (entry.id)}
                                            <div class="flex items-start gap-3">
                                                <div
                                                    class={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${getLogDotClass(
                                                        entry.type,
                                                    )}`}
                                                    class:animate-pulse={(isGenerating ||
                                                        !showFinalSuccess) &&
                                                        i ===
                                                            displayedLogs.length -
                                                                1}
                                                ></div>
                                                <div class="min-w-0">
                                                    <div
                                                        class="text-xs text-foreground/75 break-words"
                                                    >
                                                        {entry.message}
                                                    </div>
                                                    <div
                                                        class="text-[10px] text-muted-foreground/50"
                                                    >
                                                        [{getLogTypeLabel(
                                                            entry.type,
                                                        )}] {formatLogTime(
                                                            entry.receivedAt,
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        {/each}
                                    {:else}
                                        <div class="flex items-start gap-3">
                                            <div
                                                class="mt-1 w-2 h-2 rounded-full bg-white/30 flex-shrink-0"
                                            ></div>
                                            <div>
                                                <div
                                                    class="text-xs text-foreground/60"
                                                >
                                                    Waiting for AI activity...
                                                </div>
                                            </div>
                                        </div>
                                    {/if}

                                    {#if isGenerating || (isReady && !showFinalSuccess)}
                                        <div
                                            class="mt-1 flex items-center gap-1.5 pl-5"
                                        >
                                            <div class="ai-typing-dot"></div>
                                            <div
                                                class="ai-typing-dot"
                                                style="animation-delay: 0.15s"
                                            ></div>
                                            <div
                                                class="ai-typing-dot"
                                                style="animation-delay: 0.3s"
                                            ></div>
                                        </div>
                                    {/if}

                                    {#if isReady && showFinalSuccess}
                                        <div class="flex items-start gap-3">
                                            <div class="mt-0.5 flex-shrink-0">
                                                <Check
                                                    size={12}
                                                    class="text-green-400"
                                                />
                                            </div>
                                            <div>
                                                <div
                                                    class="text-xs text-green-400 font-medium"
                                                >
                                                    Code generated successfully
                                                </div>
                                                <div
                                                    class="text-[10px] text-muted-foreground/50"
                                                >
                                                    Ready to test and use
                                                </div>
                                            </div>
                                        </div>
                                    {/if}
                                </div>

                                <!-- Footer -->
                                <div
                                    class="px-4 py-2 border-t border-white/5 bg-white/[0.02] flex items-center justify-between"
                                >
                                    <span
                                        class="text-[10px] text-muted-foreground/40"
                                    >
                                        Powered by BigLot.ai
                                    </span>
                                    <span
                                        class="text-[10px] text-primary/60 flex items-center gap-1"
                                    >
                                        Indicator Builder v1.0
                                    </span>
                                </div>
                            </div>
                        {/if}
                    </div>
                {/if}

                <!-- Error Message -->
                {#if progress.status === "error"}
                    <div
                        class="py-3 px-4 bg-red-500/10 rounded-lg border border-red-500/20 text-sm text-red-300"
                    >
                        {progress.error}
                    </div>
                {/if}

                <!-- Generated Code Section -->
                {#if isReady && progress.generatedCode && showFinalSuccess}
                    <div class="space-y-3 mt-4">
                        <!-- Indicator Info -->
                        {#if loadedModule}
                            <div
                                class="flex items-center gap-3 py-3 px-4 bg-green-500/5 rounded-xl border border-green-500/10"
                            >
                                <BarChart3 size={18} class="text-green-400" />
                                <div class="flex-1">
                                    <div
                                        class="font-semibold text-green-300 text-sm"
                                    >
                                        {loadedModule.indicatorConfig.name}
                                    </div>
                                    <div class="text-xs text-muted-foreground">
                                        {loadedModule.indicatorConfig
                                            .description}
                                    </div>
                                </div>
                            </div>
                        {/if}

                        <!-- Action Buttons -->
                        <div class="flex flex-wrap gap-2">
                            <button
                                onclick={() => (showCode = !showCode)}
                                class="indicator-btn"
                            >
                                <Code2 size={14} />
                                {showCode
                                    ? "Hide PineScript"
                                    : "Show PineScript"}
                                {#if showCode}<ChevronUp
                                        size={12}
                                    />{:else}<ChevronDown size={12} />{/if}
                            </button>
                            <button
                                onclick={handleCopyCode}
                                class="indicator-btn"
                                class:indicator-btn-success={copied}
                            >
                                {#if copied}
                                    <Check size={14} />
                                    <span>Copied!</span>
                                {:else}
                                    <Copy size={14} />
                                    Copy Code
                                {/if}
                            </button>
                            <button
                                onclick={handleOpenTradingView}
                                class="indicator-btn bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/30"
                            >
                                <ExternalLink size={14} />
                                Open on TradingView
                            </button>
                            <button
                                onclick={tryLoadAndTest}
                                class="indicator-btn {testResults
                                    ? 'indicator-btn-active'
                                    : ''}"
                            >
                                <Play size={14} />
                                Test Run
                            </button>
                            {#if loadedModule}
                                <button
                                    onclick={handleSave}
                                    disabled={saving}
                                    class="indicator-btn indicator-btn-primary min-w-[120px]"
                                >
                                    {#if saving}
                                        <Loader2
                                            size={14}
                                            class="animate-spin"
                                        />
                                        Saving...
                                    {:else if saveSuccess}
                                        <Check
                                            size={14}
                                            class="text-green-400"
                                        />
                                        Saved!
                                    {:else}
                                        <Save size={14} />
                                        Save Indicator
                                    {/if}
                                </button>
                            {/if}
                        </div>

                        {#if showCode}
                            <div class="relative">
                                <pre
                                    class="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 overflow-x-auto text-xs text-gray-300 font-mono max-h-[600px] overflow-y-auto indicator-scroll"><code
                                        >{editableCode ||
                                            progress.generatedCode}</code
                                    ></pre>
                            </div>
                        {/if}

                        {#if testError}
                            <div
                                class="mt-4 py-3 px-4 bg-red-500/10 rounded-lg border border-red-500/20 text-xs text-red-300 flex items-center gap-2"
                            >
                                <AlertTriangle size={14} />
                                {testError}
                            </div>
                        {/if}

                        <!-- Preview Results with Chart + Data Tabs -->
                        {#if testResults && testResults.length > 0}
                            <div
                                class="mt-4 bg-secondary/40 rounded-xl border border-white/5 overflow-hidden"
                            >
                                <!-- Tab Header -->
                                <div
                                    class="px-4 py-2 border-b border-white/5 flex items-center justify-between"
                                >
                                    <div class="flex items-center gap-1">
                                        <button
                                            onclick={() =>
                                                (previewTab = "chart")}
                                            class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5
                                                {previewTab === 'chart'
                                                ? 'bg-primary/20 text-primary border border-primary/30'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}"
                                        >
                                            <BarChart3 size={12} />
                                            Chart
                                        </button>
                                        <button
                                            onclick={() =>
                                                (previewTab = "data")}
                                            class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5
                                                {previewTab === 'data'
                                                ? 'bg-primary/20 text-primary border border-primary/30'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}"
                                        >
                                            <Table2 size={12} />
                                            Data
                                        </button>
                                    </div>
                                    <span
                                        class="text-[10px] text-muted-foreground"
                                    >
                                        ▶ Live Preview · Simulated Data
                                    </span>
                                </div>

                                <!-- Chart Tab -->
                                {#if previewTab === "chart"}
                                    <div class="p-2">
                                        <IndicatorChart
                                            ohlcvData={chartOhlcvData}
                                            indicatorResults={testResults}
                                            overlayType={loadedModule
                                                ?.indicatorConfig
                                                ?.overlayType || "separate"}
                                            indicatorName={loadedModule
                                                ?.indicatorConfig?.name ||
                                                "Indicator"}
                                            height={380}
                                        />
                                    </div>
                                {/if}

                                <!-- Data Tab -->
                                {#if previewTab === "data"}
                                    <div
                                        class="overflow-x-auto max-h-[350px] overflow-y-auto indicator-scroll"
                                    >
                                        <table class="w-full text-xs">
                                            <thead
                                                class="sticky top-0 bg-secondary"
                                            >
                                                <tr>
                                                    <th
                                                        class="text-left py-2 px-3 text-muted-foreground font-medium"
                                                        >#</th
                                                    >
                                                    <th
                                                        class="text-right py-2 px-3 text-muted-foreground font-medium"
                                                        >Signal</th
                                                    >
                                                    {#each Object.keys(testResults[0]?.values || {}) as key}
                                                        <th
                                                            class="text-right py-2 px-3 text-muted-foreground font-medium"
                                                            >{key}</th
                                                        >
                                                    {/each}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {#each testResults.slice(-20) as row, i}
                                                    <tr
                                                        class="border-t border-white/3 hover:bg-white/3"
                                                    >
                                                        <td
                                                            class="py-1.5 px-3 text-muted-foreground"
                                                            >{i + 1}</td
                                                        >
                                                        <td
                                                            class="py-1.5 px-3 text-right text-xs font-medium
                                                            {row.signal ===
                                                            'buy'
                                                                ? 'text-green-400'
                                                                : row.signal ===
                                                                    'sell'
                                                                  ? 'text-red-400'
                                                                  : 'text-muted-foreground/40'}"
                                                        >
                                                            {#if row.signal === "buy"}▲
                                                                BUY{:else if row.signal === "sell"}▼
                                                                SELL{:else}—{/if}
                                                        </td>
                                                        {#each Object.values(row.values) as val}
                                                            <td
                                                                class="py-1.5 px-3 text-right font-mono text-foreground/80"
                                                            >
                                                                {typeof val ===
                                                                "number"
                                                                    ? val.toFixed(
                                                                          4,
                                                                      )
                                                                    : (val ??
                                                                      "—")}
                                                            </td>
                                                        {/each}
                                                    </tr>
                                                {/each}
                                            </tbody>
                                        </table>
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Saved Indicators Section -->
        <div class="glass-panel overflow-hidden">
            <button
                onclick={() => {
                    showSaved = !showSaved;
                    if (showSaved) indicatorBuilder.loadIndicators();
                }}
                class="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors"
            >
                <span class="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 size={16} class="text-primary" />
                    My Indicators
                    <span
                        class="px-2 py-0.5 rounded-full bg-white/5 text-xs text-muted-foreground"
                    >
                        {indicatorBuilder.indicators.length}
                    </span>
                </span>
                {#if showSaved}<ChevronUp size={14} />{:else}<ChevronDown
                        size={14}
                    />{/if}
            </button>

            {#if showSaved}
                <div class="border-t border-white/5">
                    {#if indicatorBuilder.indicators.length === 0}
                        <div
                            class="px-5 py-8 text-center text-sm text-muted-foreground"
                        >
                            No saved indicators yet. Generate one above!
                        </div>
                    {:else}
                        {#each indicatorBuilder.indicators as indicator}
                            <div
                                class="flex items-center gap-3 px-5 py-3 border-b border-white/3 hover:bg-white/3 transition-colors group"
                            >
                                <div class="flex-1 min-w-0">
                                    <div class="font-medium text-sm truncate">
                                        {indicator.name}
                                    </div>
                                    <div
                                        class="text-xs text-muted-foreground truncate"
                                    >
                                        {indicator.description}
                                    </div>
                                </div>
                                <span class="text-xs text-muted-foreground/50">
                                    v{indicator.version}
                                </span>
                                <button
                                    onclick={() => {
                                        editableCode = indicator.code;
                                        indicatorBuilder.progress = {
                                            status: "ready",
                                            generatedCode: indicator.code,
                                            generatedConfig: indicator.config,
                                        };
                                        showCode = true;
                                        tryLoadAndTest();
                                    }}
                                    class="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                                    title="Load indicator"
                                >
                                    <Play size={14} />
                                </button>
                                <button
                                    onclick={() => {
                                        if (confirm("Delete this indicator?"))
                                            indicatorBuilder.deleteIndicator(
                                                indicator.id,
                                            );
                                    }}
                                    class="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all"
                                    title="Delete"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        {/each}
                    {/if}
                </div>
            {/if}
        </div>
    </div>
</div>
