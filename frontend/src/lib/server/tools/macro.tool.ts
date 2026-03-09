// Macro Intelligence Tool — get_macro_indicators
// Sources: Yahoo Finance (DXY, 10Y, SPX) + FRED CSV (Real Yield DFII10)
import { registerTool, type ToolResult } from './registry';
import { toolCache } from '../cache.server';
import { fetchMacroData } from '../data/macro.data';

// ─── get_macro_indicators ─────────────────────────────────────────────────────

registerTool({
	name: 'get_macro_indicators',
	description:
		'Fetch key macroeconomic indicators relevant to gold and asset markets: DXY (Dollar Index), US 10Y Treasury yield, US 10Y Real Yield (TIPS/FRED), S&P 500. Shows macro context for gold price direction. Use when user asks about macro, DXY, yields, real rates, Fed policy, or macro backdrop for gold.',
	parameters: {
		type: 'object',
		properties: {},
		required: []
	},
	timeout: 20_000,
	execute: async (): Promise<ToolResult> => {
		const cacheKey = toolCache.generateKey('get_macro_indicators', {});
		const cached = toolCache.get<ToolResult>(cacheKey);
		if (cached) return cached;

		const macro = await fetchMacroData();
		const { dxy, tnx, spx, realYield, goldSignal, goldContext } = macro;

		if (!dxy && !tnx && !spx) {
			return {
				success: false,
				contentBlocks: [{ type: 'error', message: 'Failed to fetch macro indicators.', tool: 'get_macro_indicators' }],
				textSummary: 'Error: Could not fetch macro indicators.'
			};
		}

		const fmt2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		const fmtChange = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

		const metrics: { label: string; value: string; change?: string; direction?: 'up' | 'down' | 'neutral' }[] = [];

		if (dxy) {
			metrics.push({
				label: 'DXY (Dollar Index)',
				value: fmt2(dxy.price),
				change: fmtChange(dxy.change),
				direction: dxy.change > 0 ? 'up' : dxy.change < 0 ? 'down' : 'neutral'
			});
		}

		if (tnx) {
			metrics.push({
				label: 'US 10Y Yield (Nominal)',
				value: `${fmt2(tnx.price)}%`,
				change: fmtChange(tnx.change),
				direction: tnx.change > 0 ? 'up' : tnx.change < 0 ? 'down' : 'neutral'
			});
		}

		if (realYield !== null) {
			metrics.push({
				label: 'US 10Y Real Yield (TIPS)',
				value: `${realYield.toFixed(2)}%`,
				direction: realYield > 1.5 ? 'down' : 'up'
			});
		}

		if (spx) {
			metrics.push({
				label: 'S&P 500',
				value: spx.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
				change: fmtChange(spx.change),
				direction: spx.change > 0 ? 'up' : spx.change < 0 ? 'down' : 'neutral'
			});
		}

		metrics.push({
			label: 'Gold Signal (Macro)',
			value: goldSignal.charAt(0).toUpperCase() + goldSignal.slice(1),
			change: goldContext,
			direction: goldSignal === 'bullish' ? 'up' : goldSignal === 'bearish' ? 'down' : 'neutral'
		});

		const result: ToolResult = {
			success: true,
			contentBlocks: [{
				type: 'metric_card',
				title: `Macro Dashboard — ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} ICT`,
				metrics
			}],
			textSummary: [
				dxy ? `DXY: ${fmt2(dxy.price)} (${fmtChange(dxy.change)})` : '',
				tnx ? `US 10Y: ${fmt2(tnx.price)}%` : '',
				realYield !== null ? `Real Yield: ${realYield.toFixed(2)}%` : '',
				spx ? `SPX: ${spx.price.toFixed(0)} (${fmtChange(spx.change)})` : '',
				`Gold Macro: ${goldSignal} — ${goldContext}`
			].filter(Boolean).join('. ')
		};

		toolCache.set(cacheKey, result, 5 * 60_000);
		return result;
	}
});
