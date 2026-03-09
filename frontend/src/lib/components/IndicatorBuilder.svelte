<script lang="ts">
    import {
        Wand2,
        Play,
        Save,
        Trash2,
        Code2,
        BarChart3,
        Loader2,
        RefreshCw,
        Zap,
        Copy,
        Check,
        AlertTriangle,
        Settings2,
        ExternalLink,
        Bot,
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
        CustomIndicator,
        IndicatorConfig,
    } from "$lib/types/indicator";

    const TEMPLATE_GROUPS = [
        {
            label: "Momentum",
            items: [
                "RSI divergence with 70/30 zones and alert markers",
                "MACD momentum shift with histogram coloring",
                "Stochastic reversal with trend filter",
            ],
        },
        {
            label: "Trend",
            items: [
                "EMA crossover with higher timeframe confirmation",
                "SuperTrend with pullback continuation signals",
                "Trend tracer with buy/sell labels and background bias",
            ],
        },
        {
            label: "Structure",
            items: [
                "Order block detector with mitigation highlights",
                "Trend lines with break confirmation and retest labels",
                "Support resistance zones with liquidity sweep markers",
            ],
        },
    ] as const;

    onMount(() => {
        indicatorBuilder.loadIndicators();
    });

    let prompt = $state("");
    let consoleOpen = $state(true);
    let reviewTab = $state<"preview" | "pinescript" | "data" | "config">(
        "preview",
    );
    let loadedModule = $state<IndicatorModule | null>(null);
    let editableCode = $state("");
    let copied = $state(false);
    let sqlCopied = $state(false);
    let saving = $state(false);
    let saveSuccess = $state(false);
    let userParams = $state<Record<string, number>>({});
    let testResults = $state<IndicatorValue[] | null>(null);
    let testError = $state<string | null>(null);
    let chartOhlcvData = $state<OHLCV[]>([]);
    let logContainer = $state<HTMLElement | null>(null);

    let displayedLogs = $state<IndicatorActivityLog[]>([]);
    let showFinalSuccess = $state(false);

    $effect(() => {
        const rawLogs = indicatorBuilder.progress.activityLog || [];
        const status = indicatorBuilder.progress.status;

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
    const hasActivity = $derived(progress.status !== "idle");
    const activeCode = $derived(editableCode || progress.generatedCode || "");
    const savedIndicators = $derived(indicatorBuilder.indicators);
    const recentIndicators = $derived(savedIndicators.slice(0, 3));
    const codeLineCount = $derived(
        activeCode ? activeCode.split("\n").length : 0,
    );
    const previewPointCount = $derived(testResults?.length ?? 0);
    const warningCount = $derived(
        (progress.activityLog ?? []).filter((entry) =>
            /warning/i.test(entry.message),
        ).length,
    );
    const activeConfig = $derived<IndicatorConfig | null>(
        loadedModule?.indicatorConfig ?? progress.generatedConfig ?? null,
    );
    const configEntries = $derived(
        Object.entries(activeConfig?.params ?? {}),
    );
    const latestSignals = $derived(
        testResults?.filter((row) => row.signal && row.signal !== "neutral")
            .length ?? 0,
    );
    const lastGeneratedAt = $derived(
        displayedLogs.length
            ? formatLogTime(displayedLogs[displayedLogs.length - 1].receivedAt)
            : "Awaiting task",
    );

    function formatLogTime(timestamp: number): string {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    }

    function formatSavedDate(timestamp: string): string {
        return new Date(timestamp).toLocaleDateString([], {
            month: "short",
            day: "numeric",
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

    function statusLabel(): string {
        if (isGenerating) return "Generating";
        if (progress.status === "ready") return "Review";
        if (progress.status === "error") return "Attention";
        return "Compose";
    }

    function statusCopy(): string {
        if (progress.status === "submitting") {
            return "Routing the brief into the BigLot.ai engine.";
        }
        if (progress.status === "generating") {
            return progress.currentStep || "Building indicator logic and preview.";
        }
        if (progress.status === "ready") {
            return "Preview, inspect, and publish from the cockpit.";
        }
        if (progress.status === "error") {
            return progress.error || "Generation stopped before producing output.";
        }
        return "Describe setup, market context, signals, and desired visuals.";
    }

    function signalBadge(signal?: IndicatorValue["signal"]): string {
        if (signal === "buy") return "BUY";
        if (signal === "sell") return "SELL";
        return "NEUTRAL";
    }

    function applyTemplate(template: string) {
        prompt = template;
    }

    function handleSubmit() {
        if (!prompt.trim() || isGenerating) return;

        loadedModule = null;
        editableCode = "";
        testError = null;
        testResults = null;
        chartOhlcvData = [];
        reviewTab = "preview";
        showFinalSuccess = false;
        indicatorBuilder.generateFromPrompt(prompt);
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    }

    function generatePreviewFromPine(pineCode: string): string {
        const lower = pineCode.toLowerCase();

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

        const periodMatches = pineCode.match(/input(?:\.int)?\s*\(\s*(\d+)/g);
        const periods = periodMatches
            ? periodMatches.map((m: string) => parseInt(m.match(/(\d+)/)![1]))
            : [];

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
        if (i > 0 && fastLine[i] !== null && slowLine[i] !== null && fastLine[i - 1] !== null && slowLine[i - 1] !== null) {
            if (fastLine[i] > slowLine[i] && fastLine[i - 1] <= slowLine[i - 1]) signal = 'buy';
            if (fastLine[i] < slowLine[i] && fastLine[i - 1] >= slowLine[i - 1]) signal = 'sell';
        }
        return { timestamp: d.timestamp, values: { fast_ma: fastLine[i], slow_ma: slowLine[i] }, signal };
    });
}`;
        }

        if (lower.includes("ta.vwap") || lower.includes("vwap")) {
            return `${helpers}
function calculate(data, params) {
    let cumVol = 0, cumTP = 0;
    return data.map((d) => {
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

        testError = null;
        testResults = null;

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

        let previewCode = progress.generatedPreviewCode;

        if (!previewCode && pineCode) {
            console.log(
                "No preview code from AI, auto-generating from PineScript...",
            );
            previewCode = generatePreviewFromPine(pineCode);
        }

        if (previewCode) {
            try {
                const calculateFn = await loadPreviewModule(previewCode);
                if (calculateFn) {
                    loadedModule.calculate = calculateFn as any;

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

                    chartOhlcvData = dummyData;

                    const results = loadedModule.calculate(
                        dummyData,
                        userParams,
                    );
                    testResults = results;
                    reviewTab = "preview";
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
            await indicatorBuilder.loadIndicators();
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
        indicatorBuilder.setActiveIndicator(null);
        prompt = "";
        loadedModule = null;
        editableCode = "";
        testResults = null;
        testError = null;
        chartOhlcvData = [];
        reviewTab = "preview";
        showFinalSuccess = false;
    }

    function loadSavedIndicator(indicator: CustomIndicator) {
        indicatorBuilder.setActiveIndicator(indicator);
        prompt = indicator.description || indicator.name;
        editableCode = indicator.code;
        reviewTab = "preview";
        testError = null;
        indicatorBuilder.progress = {
            status: "ready",
            generatedCode: indicator.code,
            generatedConfig: indicator.config,
        };
        tryLoadAndTest();
    }

    async function deleteSavedIndicator(id: string) {
        if (!confirm("Delete this indicator?")) return;
        await indicatorBuilder.deleteIndicator(id);
    }

    $effect(() => {
        if (progress.generatedCode && !editableCode) {
            editableCode = progress.generatedCode;
        }
    });

    $effect(() => {
        if (isReady && progress.generatedCode && !loadedModule) {
            tryLoadAndTest();
        }
    });
</script>

<svelte:head>
    <title>Indicator Builder - BigLot.ai</title>
</svelte:head>

<div class="indicator-cockpit">
    <div class="indicator-backdrop"></div>

    {#if indicatorBuilder.dbError === "missing_table"}
        <div class="cockpit-overlay">
            <div class="cockpit-panel db-warning">
                <div class="db-warning-head">
                    <div class="db-warning-icon">
                        <AlertTriangle size={30} />
                    </div>
                    <div>
                        <h2>Database Setup Required</h2>
                        <p>
                            The <code>custom_indicators</code> table is missing in
                            Supabase.
                        </p>
                    </div>
                </div>

                <p class="db-warning-copy">
                    Run this SQL in Supabase SQL Editor before using the builder.
                </p>

                <div class="db-sql-wrap">
                    <pre class="db-sql"><code>CREATE TABLE custom_indicators (
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

ALTER TABLE custom_indicators DISABLE ROW LEVEL SECURITY;</code></pre>
                    <button
                        class="mini-action"
                        onclick={() => {
                            navigator.clipboard.writeText(
                                `CREATE TABLE custom_indicators (
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

ALTER TABLE custom_indicators DISABLE ROW LEVEL SECURITY;`,
                            );
                            sqlCopied = true;
                            setTimeout(() => (sqlCopied = false), 2000);
                        }}
                        title="Copy SQL"
                    >
                        {#if sqlCopied}
                            <Check size={14} />
                        {:else}
                            <Copy size={14} />
                        {/if}
                    </button>
                </div>

                <div class="db-warning-actions">
                    <button
                        class="control-btn control-btn-primary"
                        onclick={() =>
                            window.open(
                                "https://supabase.com/dashboard/project/_/sql",
                                "_blank",
                            )}
                    >
                        <ExternalLink size={14} />
                        Open Supabase SQL Editor
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <header class="command-header">
        <div class="command-header-left">
            <div class="eyebrow">Indicator Desk</div>
            <h1>
                <span class="title-gradient">Trading Cockpit</span>
                <span class="title-sub">/indicators</span>
            </h1>
            <p>{statusCopy()}</p>
        </div>

        <div class="command-header-right">
            <div class="top-metrics">
                <div class="metric-chip">
                    <span>Saved</span>
                    <strong>{savedIndicators.length}</strong>
                </div>
                <div class="metric-chip">
                    <span>Lines</span>
                    <strong>{codeLineCount}</strong>
                </div>
                <div class="metric-chip">
                    <span>Preview</span>
                    <strong>{previewPointCount}</strong>
                </div>
            </div>

            <div class="header-actions">
                {#if hasActivity}
                    <button class="control-btn" onclick={handleReset}>
                        <RefreshCw size={14} />
                        Reset
                    </button>
                {/if}
                <button
                    class="control-btn control-btn-primary"
                    onclick={handleSubmit}
                    disabled={!prompt.trim() || isGenerating}
                >
                    {#if isGenerating}
                        <Loader2 size={14} class="spin" />
                        Generating
                    {:else if isReady}
                        <Zap size={14} />
                        Regenerate
                    {:else}
                        <Zap size={14} />
                        Generate
                    {/if}
                </button>
            </div>
        </div>
    </header>

    <div class="cockpit-grid">
        <section class="cockpit-column compose-column">
            <article class="cockpit-panel compose-panel indicator-glow">
                <div class="panel-topline">
                    <span class="panel-label">Compose</span>
                    <span class="panel-tag">{statusLabel()}</span>
                </div>

                <div class="compose-head">
                    <div>
                        <h2>Build an indicator brief</h2>
                        <p>
                            Include setup logic, timeframe context, signal rules,
                            overlays, and the visual style you want on chart.
                        </p>
                    </div>
                    <div class="compose-icon">
                        <Wand2 size={20} />
                    </div>
                </div>

                <div class="compose-field">
                    <textarea
                        bind:value={prompt}
                        onkeydown={handleKeydown}
                        disabled={isGenerating}
                        rows="9"
                        placeholder="e.g. Build a 4H trend continuation indicator using EMA 20/50, pullback entries, higher timeframe confirmation, stop markers, and gold-accent styling."
                    ></textarea>
                    <div class="compose-foot">
                        <span>
                            Enter to submit. Shift+Enter for a new line.
                        </span>
                        <span>
                            {prompt.trim().length} chars
                        </span>
                    </div>
                </div>

                <div class="prompt-guidance">
                    <div class="guidance-card">
                        <span class="guidance-title">Best prompts</span>
                        <p>
                            Strategy logic, confirmation rules, signal labels, and
                            whether it overlays price or lives in a separate pane.
                        </p>
                    </div>
                    <div class="guidance-card">
                        <span class="guidance-title">Output flow</span>
                        <p>
                            Generate, inspect the PineScript, run a local preview,
                            then push it to TradingView or save into your library.
                        </p>
                    </div>
                </div>

                <div class="template-deck">
                    {#each TEMPLATE_GROUPS as group}
                        <div class="template-group">
                            <div class="template-group-label">{group.label}</div>
                            <div class="template-chip-list">
                                {#each group.items as item}
                                    <button
                                        class="template-chip"
                                        onclick={() => applyTemplate(item)}
                                    >
                                        {item}
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {/each}
                </div>
            </article>

            <article class="cockpit-panel shortcut-panel">
                <div class="panel-topline">
                    <span class="panel-label">Shortcuts</span>
                    <span class="panel-tag">Recent</span>
                </div>

                <div class="shortcut-head">
                    <h3>Saved presets ready to reload</h3>
                    <p>Pull recent work straight into review mode.</p>
                </div>

                {#if recentIndicators.length === 0}
                    <div class="panel-empty compact-empty">
                        Generate and save an indicator to build your cockpit shelf.
                    </div>
                {:else}
                    <div class="shortcut-list">
                        {#each recentIndicators as indicator}
                            <button
                                class="shortcut-row"
                                onclick={() => loadSavedIndicator(indicator)}
                            >
                                <span class="shortcut-name">{indicator.name}</span>
                                <span class="shortcut-meta">
                                    v{indicator.version} · {formatSavedDate(
                                        indicator.created_at,
                                    )}
                                </span>
                            </button>
                        {/each}
                    </div>
                {/if}
            </article>
        </section>

        <section class="cockpit-column workspace-column">
            <article class="cockpit-panel workspace-panel">
                <div class="panel-topline">
                    <span class="panel-label">Workspace</span>
                    <span
                        class={`panel-tag ${
                            progress.status === "error"
                                ? "tag-danger"
                                : isReady
                                  ? "tag-success"
                                  : isGenerating
                                    ? "tag-live"
                                    : ""
                        }`}
                    >
                        {statusLabel()}
                    </span>
                </div>

                <div class="workspace-head">
                    <div>
                        <h2>
                            {#if isReady && activeConfig}
                                {activeConfig.name}
                            {:else if progress.status === "error"}
                                Generation interrupted
                            {:else if isGenerating}
                                Engine is working your brief
                            {:else}
                                Mission control idle
                            {/if}
                        </h2>
                        <p>
                            {#if isReady && activeConfig}
                                {activeConfig.description ||
                                    "Review preview, inspect script, and save when ready."}
                            {:else}
                                {statusCopy()}
                            {/if}
                        </p>
                    </div>

                    <div class="workspace-status-card">
                        <span class="workspace-status-label">Current step</span>
                        <strong>{progress.currentStep || statusLabel()}</strong>
                    </div>
                </div>

                {#if isReady && activeCode}
                    <div class="workspace-actions">
                        <button class="control-btn" onclick={tryLoadAndTest}>
                            <Play size={14} />
                            Test Run
                        </button>
                        <button
                            class="control-btn"
                            onclick={handleCopyCode}
                            class:control-btn-success={copied}
                        >
                            {#if copied}
                                <Check size={14} />
                                Copied
                            {:else}
                                <Copy size={14} />
                                Copy Code
                            {/if}
                        </button>
                        <button
                            class="control-btn"
                            onclick={handleOpenTradingView}
                        >
                            <ExternalLink size={14} />
                            TradingView
                        </button>
                        <button
                            class="control-btn control-btn-primary"
                            onclick={handleSave}
                            disabled={saving}
                        >
                            {#if saving}
                                <Loader2 size={14} class="spin" />
                                Saving
                            {:else if saveSuccess}
                                <Check size={14} />
                                Saved
                            {:else}
                                <Save size={14} />
                                Save Indicator
                            {/if}
                        </button>
                    </div>
                {/if}

                {#if progress.status === "error"}
                    <div class="workspace-error">
                        <AlertTriangle size={16} />
                        <div>
                            <strong>Engine returned an error</strong>
                            <p>{progress.error}</p>
                        </div>
                    </div>
                {/if}

                {#if isGenerating}
                    <div class="generating-stage">
                        <div class="generating-radar">
                            <div class="radar-ring ring-1"></div>
                            <div class="radar-ring ring-2"></div>
                            <div class="radar-core"></div>
                        </div>
                        <div class="generating-copy">
                            <span class="panel-label">Live Build</span>
                            <h3>Compiling PineScript and preview logic</h3>
                            <p>
                                The engine is drafting structure, validating output,
                                and preparing the review workspace.
                            </p>
                        </div>
                    </div>
                {/if}

                {#if !hasActivity}
                    <div class="workspace-empty">
                        <div class="empty-grid">
                            <div class="empty-card">
                                <span class="empty-label">1. Compose</span>
                                <h3>Write the trading brief</h3>
                                <p>
                                    Be explicit about entry logic, filters, zones,
                                    labels, and timeframe bias.
                                </p>
                            </div>
                            <div class="empty-card">
                                <span class="empty-label">2. Review</span>
                                <h3>Inspect preview and code</h3>
                                <p>
                                    Use the tabs below once the engine produces the
                                    indicator package.
                                </p>
                            </div>
                            <div class="empty-card">
                                <span class="empty-label">3. Deploy</span>
                                <h3>Save or open in TradingView</h3>
                                <p>
                                    Keep strong outputs in your local library for
                                    faster reuse and iteration.
                                </p>
                            </div>
                        </div>
                    </div>
                {/if}

                {#if isReady && activeCode}
                    <div class="review-shell">
                        <div class="review-tabs">
                            <button
                                class:tab-active={reviewTab === "preview"}
                                onclick={() => (reviewTab = "preview")}
                            >
                                <BarChart3 size={14} />
                                Preview
                            </button>
                            <button
                                class:tab-active={reviewTab === "pinescript"}
                                onclick={() => (reviewTab = "pinescript")}
                            >
                                <Code2 size={14} />
                                PineScript
                            </button>
                            <button
                                class:tab-active={reviewTab === "data"}
                                onclick={() => (reviewTab = "data")}
                            >
                                <Table2 size={14} />
                                Data
                            </button>
                            {#if activeConfig}
                                <button
                                    class:tab-active={reviewTab === "config"}
                                    onclick={() => (reviewTab = "config")}
                                >
                                    <Settings2 size={14} />
                                    Config
                                </button>
                            {/if}
                        </div>

                        {#if testError}
                            <div class="inline-error">
                                <AlertTriangle size={14} />
                                <span>{testError}</span>
                            </div>
                        {/if}

                        {#if reviewTab === "preview"}
                            <div class="review-panel">
                                <div class="review-panel-head">
                                    <div>
                                        <span class="panel-label">Preview Matrix</span>
                                        <h3>Live simulation on generated output</h3>
                                    </div>
                                    <span class="panel-tag">
                                        {previewPointCount} points
                                    </span>
                                </div>

                                {#if testResults && testResults.length > 0}
                                    <IndicatorChart
                                        ohlcvData={chartOhlcvData}
                                        indicatorResults={testResults}
                                        overlayType={activeConfig?.overlayType ||
                                            "separate"}
                                        indicatorName={activeConfig?.name ||
                                            "Indicator"}
                                        height={420}
                                    />
                                {:else}
                                    <div class="panel-empty">
                                        <p>
                                            Preview has not been generated yet.
                                        </p>
                                        <button
                                            class="control-btn control-btn-primary"
                                            onclick={tryLoadAndTest}
                                        >
                                            <Play size={14} />
                                            Run Preview
                                        </button>
                                    </div>
                                {/if}
                            </div>
                        {/if}

                        {#if reviewTab === "pinescript"}
                            <div class="review-panel">
                                <div class="review-panel-head">
                                    <div>
                                        <span class="panel-label">PineScript</span>
                                        <h3>Engine output ready for TradingView</h3>
                                    </div>
                                    <span class="panel-tag">{codeLineCount} lines</span>
                                </div>
                                <pre class="code-panel indicator-scroll"><code>{activeCode}</code></pre>
                            </div>
                        {/if}

                        {#if reviewTab === "data"}
                            <div class="review-panel">
                                <div class="review-panel-head">
                                    <div>
                                        <span class="panel-label">Output Table</span>
                                        <h3>Latest simulated observations</h3>
                                    </div>
                                    <span class="panel-tag">
                                        {latestSignals} active signals
                                    </span>
                                </div>

                                {#if testResults && testResults.length > 0}
                                    <div class="table-shell indicator-scroll">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Signal</th>
                                                    {#each Object.keys(testResults[0]?.values || {}) as key}
                                                        <th>{key}</th>
                                                    {/each}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {#each testResults.slice(-20) as row, i}
                                                    <tr>
                                                        <td>{Math.max(0, (testResults?.length ?? 0) - 20) + i + 1}</td>
                                                        <td
                                                            class={`signal-cell signal-${row.signal || "neutral"}`}
                                                        >
                                                            {signalBadge(row.signal)}
                                                        </td>
                                                        {#each Object.values(row.values) as val}
                                                            <td>
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
                                {:else}
                                    <div class="panel-empty">
                                        No preview output yet. Run a preview to
                                        populate the data table.
                                    </div>
                                {/if}
                            </div>
                        {/if}

                        {#if reviewTab === "config" && activeConfig}
                            <div class="review-panel">
                                <div class="review-panel-head">
                                    <div>
                                        <span class="panel-label">Configuration</span>
                                        <h3>Indicator metadata and parameters</h3>
                                    </div>
                                    <span class="panel-tag">
                                        {activeConfig.overlayType}
                                    </span>
                                </div>

                                <div class="config-summary">
                                    <div class="config-summary-card">
                                        <span>Name</span>
                                        <strong>{activeConfig.name}</strong>
                                    </div>
                                    <div class="config-summary-card">
                                        <span>Description</span>
                                        <strong>
                                            {activeConfig.description ||
                                                "No description returned"}
                                        </strong>
                                    </div>
                                    <div class="config-summary-card">
                                        <span>Overlay</span>
                                        <strong>{activeConfig.overlayType}</strong>
                                    </div>
                                </div>

                                {#if configEntries.length > 0}
                                    <div class="config-grid">
                                        {#each configEntries as [key, param]}
                                            <div class="config-card">
                                                <div class="config-card-head">
                                                    <span>{param.label || key}</span>
                                                    <strong>{param.default}</strong>
                                                </div>
                                                <div class="config-card-meta">
                                                    <span>
                                                        Min {param.min ?? "—"}
                                                    </span>
                                                    <span>
                                                        Max {param.max ?? "—"}
                                                    </span>
                                                    <span>
                                                        Step {param.step ?? "—"}
                                                    </span>
                                                </div>
                                            </div>
                                        {/each}
                                    </div>
                                {:else}
                                    <div class="panel-empty">
                                        No configurable numeric parameters were
                                        returned for this indicator.
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    </div>
                {/if}
            </article>
        </section>

        <aside class="cockpit-column console-column">
            <article class="cockpit-panel console-panel">
                <div class="panel-topline">
                    <span class="panel-label">Status Console</span>
                    <button class="panel-tag button-tag" onclick={() => (consoleOpen = !consoleOpen)}>
                        <Monitor size={12} />
                        {consoleOpen ? "Collapse" : "Expand"}
                    </button>
                </div>

                <div class="console-head">
                    <div class="console-avatar">
                        <Bot size={18} />
                        <span class:console-live={isGenerating}></span>
                    </div>
                    <div>
                        <h2>BigLot.ai Agent</h2>
                        <p>
                            {#if isGenerating}
                                Live generation session
                            {:else if isReady}
                                Review session active
                            {:else if progress.status === "error"}
                                Requires intervention
                            {:else}
                                Waiting for a brief
                            {/if}
                        </p>
                    </div>
                </div>

                <div class="console-stats">
                    <div class="console-stat">
                        <span>State</span>
                        <strong>{statusLabel()}</strong>
                    </div>
                    <div class="console-stat">
                        <span>Warnings</span>
                        <strong>{warningCount}</strong>
                    </div>
                    <div class="console-stat">
                        <span>Last tick</span>
                        <strong>{lastGeneratedAt}</strong>
                    </div>
                </div>

                {#if consoleOpen}
                    <div class="console-log" bind:this={logContainer}>
                        {#if displayedLogs.length > 0}
                            {#each displayedLogs as entry, i (entry.id)}
                                <div class="console-entry">
                                    <div
                                        class={`console-dot ${getLogDotClass(entry.type)}`}
                                        class:dot-active={(isGenerating ||
                                            !showFinalSuccess) &&
                                            i === displayedLogs.length - 1}
                                    ></div>
                                    <div class="console-entry-body">
                                        <div class="console-entry-message">
                                            {entry.message}
                                        </div>
                                        <div class="console-entry-meta">
                                            [{getLogTypeLabel(entry.type)}]
                                            {formatLogTime(entry.receivedAt)}
                                        </div>
                                    </div>
                                </div>
                            {/each}
                        {:else}
                            <div class="console-idle">
                                Awaiting engine activity...
                            </div>
                        {/if}

                        {#if isGenerating || (isReady && !showFinalSuccess)}
                            <div class="console-typing">
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
                    </div>
                {/if}
            </article>

            <article class="cockpit-panel metadata-panel">
                <div class="panel-topline">
                    <span class="panel-label">Telemetry</span>
                    <span class="panel-tag">
                        {showFinalSuccess ? "Synced" : "Live"}
                    </span>
                </div>

                <div class="metadata-grid">
                    <div class="metadata-card">
                        <span>Overlay type</span>
                        <strong>{activeConfig?.overlayType || "Pending"}</strong>
                    </div>
                    <div class="metadata-card">
                        <span>Parameters</span>
                        <strong>{configEntries.length}</strong>
                    </div>
                    <div class="metadata-card">
                        <span>Signals</span>
                        <strong>{latestSignals}</strong>
                    </div>
                    <div class="metadata-card">
                        <span>Engine</span>
                        <strong>Premium</strong>
                    </div>
                </div>
            </article>

            <article class="cockpit-panel library-panel">
                <div class="panel-topline">
                    <span class="panel-label">Library</span>
                    <span class="panel-tag">{savedIndicators.length} items</span>
                </div>

                <div class="library-head">
                    <h2>My Indicators</h2>
                    <p>Reload, inspect, and prune saved builds from one panel.</p>
                </div>

                {#if savedIndicators.length === 0}
                    <div class="panel-empty">
                        No saved indicators yet. Save a strong build to start your
                        desk library.
                    </div>
                {:else}
                    <div class="library-list indicator-scroll">
                        {#each savedIndicators as indicator}
                            <div class="library-item">
                                <div class="library-item-main">
                                    <div class="library-item-name">
                                        {indicator.name}
                                    </div>
                                    <div class="library-item-desc">
                                        {indicator.description || "No description"}
                                    </div>
                                    <div class="library-item-meta">
                                        <span>v{indicator.version}</span>
                                        <span>
                                            {formatSavedDate(indicator.created_at)}
                                        </span>
                                    </div>
                                </div>

                                <div class="library-item-actions">
                                    <button
                                        class="mini-action"
                                        title="Load indicator"
                                        onclick={() => loadSavedIndicator(indicator)}
                                    >
                                        <Play size={14} />
                                    </button>
                                    <button
                                        class="mini-action mini-action-danger"
                                        title="Delete indicator"
                                        onclick={() =>
                                            deleteSavedIndicator(
                                                indicator.id,
                                            )}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </article>
        </aside>
    </div>
</div>

<style>
    .indicator-cockpit {
        position: relative;
        min-height: 100%;
        background:
            radial-gradient(ellipse 80% 50% at 20% 0%, rgba(245, 158, 11, 0.10), transparent),
            radial-gradient(ellipse 60% 40% at 85% 5%, rgba(168, 85, 247, 0.06), transparent),
            radial-gradient(ellipse 50% 60% at 50% 100%, rgba(245, 158, 11, 0.03), transparent),
            radial-gradient(circle at 50% 40%, rgba(255, 255, 255, 0.012), transparent 70%),
            var(--color-background, #050505);
        color: #f1f5f9;
        overflow-x: hidden;
        overflow-y: auto;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }

    .indicator-backdrop {
        position: absolute;
        inset: 0;
        background-image:
            linear-gradient(rgba(255, 255, 255, 0.016) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.016) 1px, transparent 1px);
        background-size: 64px 64px;
        mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 20%, transparent 70%);
        -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 20%, transparent 70%);
        pointer-events: none;
    }

    .command-header,
    .cockpit-grid,
    .cockpit-overlay {
        position: relative;
        z-index: 1;
    }

    .command-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 1.1rem 1.5rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        background: rgba(5, 5, 5, 0.65);
        backdrop-filter: blur(24px) saturate(1.2);
        position: sticky;
        top: 0;
        z-index: 12;
    }

    .command-header-left {
        min-width: 0;
    }

    .eyebrow {
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 0.6rem;
        font-weight: 600;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        color: rgba(245, 158, 11, 0.7);
        margin-bottom: 0.4rem;
    }

    .command-header-left h1 {
        display: flex;
        align-items: baseline;
        gap: 0.65rem;
        margin: 0;
        font-family: 'Outfit', system-ui, sans-serif;
        font-size: 1.5rem;
        font-weight: 700;
        line-height: 1.1;
        letter-spacing: -0.02em;
    }

    .title-gradient {
        background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 40%, #e2e8f0 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .title-sub {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.75rem;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.28);
        letter-spacing: -0.01em;
    }

    .command-header-left p {
        margin: 0.4rem 0 0;
        color: rgba(255, 255, 255, 0.5);
        font-size: 0.82rem;
        font-weight: 400;
        letter-spacing: 0.005em;
        line-height: 1.5;
    }

    .command-header-right,
    .header-actions,
    .top-metrics {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .metric-chip {
        min-width: 78px;
        padding: 0.6rem 0.85rem;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(255, 255, 255, 0.025);
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .metric-chip span {
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 0.58rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: rgba(255, 255, 255, 0.35);
    }

    .metric-chip strong {
        font-family: 'Outfit', system-ui, sans-serif;
        font-size: 1rem;
        font-weight: 700;
        color: #f1f5f9;
        letter-spacing: -0.02em;
    }

    .cockpit-grid {
        display: grid;
        grid-template-columns: minmax(290px, 360px) minmax(0, 1fr) minmax(300px, 360px);
        gap: 1rem;
        padding: 1rem;
        align-items: start;
    }

    .cockpit-column {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        min-width: 0;
    }

    .cockpit-panel {
        position: relative;
        overflow: hidden;
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01) 60%, transparent),
            rgba(8, 8, 8, 0.88);
        backdrop-filter: blur(8px);
        box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.04),
            0 1px 2px rgba(0, 0, 0, 0.2),
            0 8px 32px rgba(0, 0, 0, 0.24);
    }

    .cockpit-panel::before {
        content: "";
        position: absolute;
        inset: 0 0 auto 0;
        height: 1px;
        background: linear-gradient(
            90deg,
            transparent 10%,
            rgba(245, 158, 11, 0.4) 50%,
            transparent 90%
        );
        pointer-events: none;
    }

    .compose-panel,
    .workspace-panel,
    .console-panel,
    .library-panel,
    .metadata-panel,
    .shortcut-panel {
        padding: 1rem;
    }

    .panel-topline {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        margin-bottom: 0.95rem;
    }

    .panel-label {
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 0.6rem;
        font-weight: 600;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: rgba(245, 158, 11, 0.65);
    }

    .panel-tag {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.3rem 0.6rem;
        border-radius: 999px;
        border: 1px solid rgba(245, 158, 11, 0.14);
        background: rgba(245, 158, 11, 0.06);
        color: rgba(245, 158, 11, 0.85);
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 0.66rem;
        font-weight: 600;
        white-space: nowrap;
        letter-spacing: 0.01em;
    }

    .tag-success {
        border-color: rgba(34, 197, 94, 0.2);
        background: rgba(34, 197, 94, 0.1);
        color: #4ade80;
    }

    .tag-danger {
        border-color: rgba(239, 68, 68, 0.22);
        background: rgba(239, 68, 68, 0.1);
        color: #f87171;
    }

    .tag-live {
        border-color: rgba(245, 158, 11, 0.24);
        background: rgba(245, 158, 11, 0.11);
        color: #fbbf24;
    }

    .button-tag {
        cursor: pointer;
    }

    .compose-head,
    .workspace-head,
    .console-head,
    .library-head,
    .shortcut-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
    }

    .compose-head h2,
    .workspace-head h2,
    .console-head h2,
    .library-head h2,
    .shortcut-head h3 {
        margin: 0;
        font-family: 'Outfit', system-ui, sans-serif;
        font-size: 1.12rem;
        font-weight: 700;
        color: #f1f5f9;
        letter-spacing: -0.015em;
        line-height: 1.25;
    }

    .compose-head p,
    .workspace-head p,
    .console-head p,
    .library-head p,
    .shortcut-head p {
        margin: 0.4rem 0 0;
        font-size: 0.82rem;
        font-weight: 400;
        color: rgba(255, 255, 255, 0.45);
        line-height: 1.6;
        letter-spacing: 0.005em;
    }

    .compose-icon {
        display: grid;
        place-items: center;
        width: 48px;
        height: 48px;
        border-radius: 16px;
        background: radial-gradient(circle at top, rgba(245, 158, 11, 0.26), rgba(245, 158, 11, 0.08));
        color: #f59e0b;
        border: 1px solid rgba(245, 158, 11, 0.2);
        flex-shrink: 0;
    }

    .compose-field {
        margin-top: 1rem;
    }

    .compose-field textarea {
        width: 100%;
        min-height: 220px;
        resize: vertical;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.07);
        background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent),
            rgba(0, 0, 0, 0.5);
        padding: 1rem 1.1rem;
        color: #e2e8f0;
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 0.88rem;
        font-weight: 400;
        line-height: 1.7;
        letter-spacing: 0.005em;
        transition: border-color 0.25s ease, box-shadow 0.25s ease;
    }

    .compose-field textarea:focus {
        outline: none;
        border-color: rgba(245, 158, 11, 0.3);
        box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.06), 0 0 20px rgba(245, 158, 11, 0.04);
    }

    .compose-field textarea::placeholder {
        color: rgba(255, 255, 255, 0.25);
        font-weight: 400;
    }

    .compose-field textarea:disabled {
        opacity: 0.7;
    }

    .compose-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        margin-top: 0.7rem;
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.38);
    }

    .prompt-guidance {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
        margin-top: 1rem;
    }

    .guidance-card {
        padding: 0.9rem 0.95rem;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.025);
        border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .guidance-title {
        display: block;
        margin-bottom: 0.45rem;
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 0.62rem;
        font-weight: 600;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: rgba(245, 158, 11, 0.6);
    }

    .guidance-card p {
        margin: 0;
        font-size: 0.76rem;
        font-weight: 400;
        color: rgba(255, 255, 255, 0.44);
        line-height: 1.55;
        letter-spacing: 0.005em;
    }

    .template-deck {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        margin-top: 1rem;
    }

    .template-group {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
    }

    .template-group-label {
        font-family: 'Outfit', system-ui, sans-serif;
        font-size: 0.68rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: rgba(255, 255, 255, 0.36);
    }

    .template-chip-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .template-chip {
        padding: 0.6rem 0.82rem;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.03);
        color: rgba(255, 255, 255, 0.68);
        font-size: 0.78rem;
        line-height: 1.35;
        text-align: left;
        cursor: pointer;
        transition: all 0.18s ease;
    }

    .template-chip:hover {
        transform: translateY(-1px);
        border-color: rgba(245, 158, 11, 0.22);
        background: rgba(245, 158, 11, 0.08);
        color: #f8fafc;
    }

    .shortcut-list,
    .library-list {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        margin-top: 1rem;
    }

    .library-list {
        max-height: 540px;
        overflow: auto;
        padding-right: 0.15rem;
    }

    .shortcut-row,
    .library-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.8rem;
        padding: 0.85rem 0.9rem;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.025);
        border: 1px solid rgba(255, 255, 255, 0.06);
        transition: border-color 0.18s ease, background 0.18s ease,
            transform 0.18s ease;
    }

    .shortcut-row {
        cursor: pointer;
        text-align: left;
        width: 100%;
    }

    .shortcut-row:hover,
    .library-item:hover {
        transform: translateY(-1px);
        border-color: rgba(245, 158, 11, 0.18);
        background: rgba(245, 158, 11, 0.06);
    }

    .shortcut-name,
    .library-item-name {
        display: block;
        font-size: 0.88rem;
        font-weight: 600;
        color: #f8fafc;
    }

    .shortcut-meta,
    .library-item-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.55rem;
        margin-top: 0.25rem;
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.42);
    }

    .workspace-head {
        align-items: stretch;
        margin-bottom: 1rem;
    }

    .workspace-status-card {
        min-width: 170px;
        padding: 0.85rem 0.95rem;
        border-radius: 18px;
        background: rgba(245, 158, 11, 0.06);
        border: 1px solid rgba(245, 158, 11, 0.12);
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }

    .workspace-status-label {
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: rgba(255, 255, 255, 0.42);
    }

    .workspace-status-card strong {
        font-size: 0.88rem;
        color: #f8fafc;
        line-height: 1.4;
    }

    .workspace-actions {
        position: sticky;
        top: 5.6rem;
        z-index: 2;
        display: flex;
        flex-wrap: wrap;
        gap: 0.65rem;
        padding: 0.8rem;
        margin-bottom: 1rem;
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(2, 2, 2, 0.88);
        backdrop-filter: blur(10px);
    }

    .control-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
        padding: 0.72rem 0.95rem;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.03);
        color: rgba(255, 255, 255, 0.74);
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.18s ease;
    }

    .control-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        color: #fff;
        border-color: rgba(255, 255, 255, 0.14);
        background: rgba(255, 255, 255, 0.05);
    }

    .control-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
    }

    .control-btn-primary {
        border-color: rgba(245, 158, 11, 0.28);
        background: linear-gradient(
            135deg,
            rgba(245, 158, 11, 0.22),
            rgba(245, 158, 11, 0.12)
        );
        color: #f8e6bf;
    }

    .control-btn-primary:hover:not(:disabled) {
        border-color: rgba(245, 158, 11, 0.4);
        background: linear-gradient(
            135deg,
            rgba(245, 158, 11, 0.28),
            rgba(245, 158, 11, 0.16)
        );
    }

    .control-btn-success {
        border-color: rgba(34, 197, 94, 0.24);
        background: rgba(34, 197, 94, 0.1);
        color: #4ade80;
    }

    .workspace-empty,
    .review-panel,
    .panel-empty,
    .generating-stage,
    .workspace-error {
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(255, 255, 255, 0.02);
    }

    .workspace-empty {
        padding: 1rem;
    }

    .empty-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.9rem;
    }

    .empty-card {
        padding: 1rem;
        border-radius: 18px;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .empty-label {
        display: inline-block;
        margin-bottom: 0.55rem;
        font-size: 0.66rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: rgba(245, 158, 11, 0.7);
    }

    .empty-card h3 {
        margin: 0;
        font-size: 0.92rem;
    }

    .empty-card p {
        margin: 0.45rem 0 0;
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.52);
        line-height: 1.55;
    }

    .generating-stage {
        display: flex;
        align-items: center;
        gap: 1.2rem;
        padding: 1.2rem;
        margin-bottom: 1rem;
    }

    .generating-radar {
        position: relative;
        width: 92px;
        height: 92px;
        flex-shrink: 0;
    }

    .radar-ring,
    .radar-core {
        position: absolute;
        inset: 0;
        border-radius: 999px;
    }

    .radar-ring {
        border: 1px solid rgba(245, 158, 11, 0.22);
        animation: pulse-ring 2.3s ease-out infinite;
    }

    .ring-2 {
        inset: 12px;
        animation-delay: 0.3s;
    }

    .radar-core {
        inset: 26px;
        background: radial-gradient(circle, rgba(245, 158, 11, 0.8), rgba(245, 158, 11, 0.16));
        box-shadow: 0 0 24px rgba(245, 158, 11, 0.3);
    }

    .generating-copy h3 {
        margin: 0.2rem 0 0;
        font-size: 1rem;
    }

    .generating-copy p {
        margin: 0.55rem 0 0;
        font-size: 0.84rem;
        color: rgba(255, 255, 255, 0.56);
        line-height: 1.55;
    }

    .workspace-error,
    .inline-error {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.95rem 1rem;
        color: #fca5a5;
        border-color: rgba(239, 68, 68, 0.2);
        background: rgba(239, 68, 68, 0.08);
    }

    .workspace-error strong {
        display: block;
        margin-bottom: 0.25rem;
        color: #fecaca;
    }

    .workspace-error p,
    .inline-error span {
        margin: 0;
        font-size: 0.82rem;
        color: rgba(254, 202, 202, 0.86);
        line-height: 1.45;
    }

    .review-shell {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
    }

    .review-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.55rem;
    }

    .review-tabs button {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.75rem 0.95rem;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.03);
        color: rgba(255, 255, 255, 0.56);
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.18s ease;
    }

    .review-tabs button:hover,
    .review-tabs button.tab-active {
        border-color: rgba(245, 158, 11, 0.24);
        background: rgba(245, 158, 11, 0.1);
        color: #f8fafc;
    }

    .review-panel {
        padding: 1rem;
    }

    .review-panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 0.9rem;
    }

    .review-panel-head h3 {
        margin: 0.2rem 0 0;
        font-size: 0.98rem;
    }

    .code-panel {
        margin: 0;
        padding: 1rem;
        max-height: 720px;
        overflow: auto;
        border-radius: 18px;
        background: #070707;
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #d1d5db;
        font-size: 0.78rem;
    }

    .table-shell {
        max-height: 440px;
        overflow: auto;
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(0, 0, 0, 0.32);
    }

    .table-shell table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.76rem;
    }

    .table-shell th,
    .table-shell td {
        padding: 0.8rem 0.85rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        text-align: right;
        white-space: nowrap;
    }

    .table-shell th:first-child,
    .table-shell td:first-child {
        text-align: left;
    }

    .table-shell thead th {
        position: sticky;
        top: 0;
        background: rgba(10, 10, 10, 0.96);
        color: rgba(255, 255, 255, 0.52);
        font-weight: 600;
    }

    .table-shell tbody tr:hover {
        background: rgba(255, 255, 255, 0.03);
    }

    .signal-cell {
        font-weight: 700;
    }

    .signal-buy {
        color: #4ade80;
    }

    .signal-sell {
        color: #f87171;
    }

    .signal-neutral {
        color: rgba(255, 255, 255, 0.45);
    }

    .config-summary,
    .config-grid,
    .metadata-grid {
        display: grid;
        gap: 0.75rem;
    }

    .config-summary {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        margin-bottom: 0.9rem;
    }

    .config-summary-card,
    .config-card,
    .metadata-card,
    .console-stat {
        padding: 0.85rem 0.9rem;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(255, 255, 255, 0.025);
    }

    .config-summary-card span,
    .metadata-card span,
    .console-stat span {
        display: block;
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: rgba(255, 255, 255, 0.38);
        margin-bottom: 0.42rem;
    }

    .config-summary-card strong,
    .metadata-card strong,
    .console-stat strong {
        display: block;
        color: #f8fafc;
        font-size: 0.88rem;
        line-height: 1.45;
    }

    .config-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .config-card-head,
    .config-card-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
    }

    .config-card-head span {
        color: #f8fafc;
        font-weight: 600;
        font-size: 0.84rem;
    }

    .config-card-head strong {
        color: #f59e0b;
    }

    .config-card-meta {
        margin-top: 0.65rem;
        flex-wrap: wrap;
        font-size: 0.73rem;
        color: rgba(255, 255, 255, 0.44);
    }

    .console-avatar {
        position: relative;
        display: grid;
        place-items: center;
        width: 46px;
        height: 46px;
        border-radius: 16px;
        background: linear-gradient(135deg, rgba(126, 34, 206, 0.34), rgba(245, 158, 11, 0.26));
        color: #fff;
        flex-shrink: 0;
    }

    .console-avatar span {
        position: absolute;
        right: -2px;
        bottom: -2px;
        width: 12px;
        height: 12px;
        border-radius: 999px;
        border: 2px solid #050505;
        background: rgba(255, 255, 255, 0.28);
    }

    .console-avatar span.console-live {
        background: #22c55e;
        box-shadow: 0 0 12px rgba(34, 197, 94, 0.5);
    }

    .console-stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.7rem;
        margin-top: 1rem;
        margin-bottom: 0.9rem;
    }

    .console-log {
        max-height: 420px;
        overflow: auto;
        padding: 0.25rem 0.15rem 0.1rem 0;
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
    }

    .console-entry {
        display: flex;
        align-items: flex-start;
        gap: 0.7rem;
    }

    .console-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        flex-shrink: 0;
        margin-top: 0.25rem;
    }

    .dot-active {
        animation: pulse-dot 1.4s ease-in-out infinite;
    }

    .console-entry-message {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.78);
        line-height: 1.5;
        word-break: break-word;
    }

    .console-entry-meta {
        margin-top: 0.22rem;
        font-size: 0.66rem;
        letter-spacing: 0.04em;
        color: rgba(255, 255, 255, 0.34);
    }

    .console-idle {
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.44);
        padding: 0.2rem 0;
    }

    .console-typing {
        display: flex;
        align-items: center;
        gap: 0.32rem;
        padding-left: 1.1rem;
    }

    .metadata-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .library-item {
        align-items: flex-start;
    }

    .library-item-main {
        min-width: 0;
        flex: 1;
    }

    .library-item-desc {
        margin-top: 0.3rem;
        color: rgba(255, 255, 255, 0.54);
        font-size: 0.8rem;
        line-height: 1.45;
        word-break: break-word;
    }

    .library-item-actions {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex-shrink: 0;
    }

    .mini-action {
        width: 34px;
        height: 34px;
        display: inline-grid;
        place-items: center;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
        color: rgba(255, 255, 255, 0.68);
        cursor: pointer;
        transition: all 0.18s ease;
    }

    .mini-action:hover {
        border-color: rgba(245, 158, 11, 0.18);
        background: rgba(245, 158, 11, 0.1);
        color: #fff;
    }

    .mini-action-danger:hover {
        border-color: rgba(239, 68, 68, 0.2);
        background: rgba(239, 68, 68, 0.1);
        color: #fca5a5;
    }

    .panel-empty {
        min-height: 180px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1.25rem;
        text-align: center;
        font-size: 0.84rem;
        color: rgba(255, 255, 255, 0.48);
        line-height: 1.55;
    }

    .compact-empty {
        min-height: 110px;
    }

    .cockpit-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        background: rgba(0, 0, 0, 0.78);
        backdrop-filter: blur(10px);
        z-index: 30;
    }

    .db-warning {
        width: min(820px, 100%);
        padding: 1.35rem;
    }

    .db-warning-head {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 1rem;
    }

    .db-warning-icon {
        width: 54px;
        height: 54px;
        border-radius: 18px;
        display: grid;
        place-items: center;
        background: rgba(245, 158, 11, 0.16);
        color: #f59e0b;
        border: 1px solid rgba(245, 158, 11, 0.2);
        flex-shrink: 0;
    }

    .db-warning-head h2 {
        margin: 0;
        font-size: 1.3rem;
    }

    .db-warning-head p,
    .db-warning-copy {
        margin: 0.35rem 0 0;
        color: rgba(255, 255, 255, 0.62);
        line-height: 1.55;
    }

    .db-sql-wrap {
        position: relative;
        margin-top: 1rem;
    }

    .db-sql {
        margin: 0;
        padding: 1rem;
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: #050505;
        color: rgba(245, 158, 11, 0.9);
        overflow: auto;
        font-size: 0.76rem;
    }

    .db-sql-wrap .mini-action {
        position: absolute;
        top: 0.85rem;
        right: 0.85rem;
    }

    .db-warning-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 1rem;
    }

    .spin {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }

    @keyframes pulse-ring {
        0%,
        100% {
            transform: scale(1);
            opacity: 0.3;
        }
        50% {
            transform: scale(1.06);
            opacity: 0.6;
        }
    }

    @keyframes pulse-dot {
        0%,
        100% {
            transform: scale(1);
            opacity: 0.45;
        }
        50% {
            transform: scale(1.28);
            opacity: 1;
        }
    }

    @media (max-width: 1279px) {
        .cockpit-grid {
            grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
        }

        .console-column {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 1rem;
        }

        .console-panel,
        .metadata-panel,
        .library-panel {
            min-height: 100%;
        }
    }

    @media (max-width: 960px) {
        .command-header {
            flex-direction: column;
            align-items: stretch;
        }

        .command-header-right {
            flex-direction: column;
            align-items: stretch;
        }

        .top-metrics,
        .header-actions {
            width: 100%;
            justify-content: space-between;
        }

        .cockpit-grid {
            grid-template-columns: 1fr;
        }

        .console-column {
            grid-column: auto;
            display: flex;
        }

        .prompt-guidance,
        .config-summary,
        .config-grid,
        .metadata-grid,
        .console-stats,
        .empty-grid {
            grid-template-columns: 1fr;
        }

        .workspace-status-card {
            min-width: 0;
        }
    }

    @media (max-width: 720px) {
        .command-header,
        .cockpit-grid {
            padding-left: 0.85rem;
            padding-right: 0.85rem;
        }

        .cockpit-grid {
            padding-top: 0.85rem;
        }

        .command-header-left h1 {
            flex-direction: column;
            align-items: flex-start;
        }

        .top-metrics {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .header-actions {
            flex-wrap: wrap;
        }

        .compose-head,
        .workspace-head,
        .console-head,
        .library-head,
        .shortcut-head,
        .review-panel-head {
            flex-direction: column;
            align-items: flex-start;
        }

        .workspace-actions {
            position: static;
        }

        .generating-stage {
            flex-direction: column;
            align-items: flex-start;
        }

        .table-shell th,
        .table-shell td {
            padding: 0.72rem 0.7rem;
        }
    }

    .indicator-glow {
        box-shadow:
            0 0 40px rgba(245, 158, 11, 0.06),
            0 0 80px rgba(245, 158, 11, 0.03);
    }

    .indicator-scroll {
        scrollbar-width: thin;
        scrollbar-color: rgba(245, 158, 11, 0.18) transparent;
    }

    .indicator-scroll::-webkit-scrollbar {
        width: 5px;
        height: 5px;
    }

    .indicator-scroll::-webkit-scrollbar-track {
        background: transparent;
    }

    .indicator-scroll::-webkit-scrollbar-thumb {
        background: rgba(245, 158, 11, 0.18);
        border-radius: 999px;
    }

    .indicator-scroll::-webkit-scrollbar-thumb:hover {
        background: rgba(245, 158, 11, 0.32);
    }

    .ai-typing-dot {
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: rgba(245, 158, 11, 0.6);
        animation: typing-bounce 1.2s ease-in-out infinite;
    }

    @keyframes typing-bounce {
        0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.4;
        }
        30% {
            transform: translateY(-6px);
            opacity: 1;
        }
    }
</style>
