// Macro Intelligence Tool — get_macro_indicators
// Sources: Yahoo Finance (DXY, 10Y, SPX) + FRED CSV (Real Yield DFII10)
import { registerTool, type ToolResult } from './registry';
import { toolCache } from '../cache.server';

const YAHOO_HEADERS = {
	'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
	Accept: 'application/json'
};

interface YahooMeta {
	regularMarketPrice?: number;
	previousClose?: number;
	chartPreviousClose?: number;
	shortName?: string;
	symbol?: string;
}

async function fetchYahooQuote(yahooSymbol: string): Promise<{ price: number; change: number; name: string } | null> {
	try {
		const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=2d&interval=1d`;
		const res = await fetch(url, { headers: YAHOO_HEADERS });
		if (!res.ok) return null;

		const data = await res.json() as any;
		const meta: YahooMeta = data?.chart?.result?.[0]?.meta ?? {};

		const price = meta.regularMarketPrice ?? 0;
		const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
		const change = prevClose !== 0 ? ((price - prevClose) / prevClose) * 100 : 0;
		const name = meta.shortName || meta.symbol || yahooSymbol;

		return { price, change, name: String(name) };
	} catch {
		return null;
	}
}

async function fetchFredRealYield(): Promise<number | null> {
	const cacheKey = toolCache.generateKey('fred_dfii10', {});
	const cached = toolCache.get<number>(cacheKey);
	if (cached !== null && cached !== undefined) return cached;

	try {
		// FRED DFII10: 10-Year Treasury Inflation-Indexed Security yield (%)
		const res = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFII10');
		if (!res.ok) return null;

		const text = await res.text();
		const lines = text.trim().split('\n').slice(1); // skip header
		// Find last non-empty line with valid data
		for (let i = lines.length - 1; i >= 0; i--) {
			const parts = lines[i].split(',');
			if (parts.length >= 2 && parts[1].trim() !== '.' && parts[1].trim() !== '') {
				const value = parseFloat(parts[1].trim());
				if (!isNaN(value)) {
					toolCache.set(cacheKey, value, 4 * 3_600_000); // cache 4hr
					return value;
				}
			}
		}
		return null;
	} catch {
		return null;
	}
}

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

		// Fetch all in parallel
		const [dxyResult, tnxResult, spxResult, realYieldResult] = await Promise.allSettled([
			fetchYahooQuote('DX-Y.NYB'),      // DXY — Dollar Index
			fetchYahooQuote('%5ETNX'),          // ^TNX — US 10Y Treasury yield
			fetchYahooQuote('%5EGSPC'),         // ^GSPC — S&P 500
			fetchFredRealYield()               // DFII10 — US 10Y Real Yield (FRED)
		]);

		const dxy = dxyResult.status === 'fulfilled' ? dxyResult.value : null;
		const tnx = tnxResult.status === 'fulfilled' ? tnxResult.value : null;
		const spx = spxResult.status === 'fulfilled' ? spxResult.value : null;
		const realYield = realYieldResult.status === 'fulfilled' ? realYieldResult.value : null;

		if (!dxy && !tnx && !spx) {
			return {
				success: false,
				contentBlocks: [{ type: 'error', message: 'Failed to fetch macro indicators.', tool: 'get_macro_indicators' }],
				textSummary: 'Error: Could not fetch macro indicators.'
			};
		}

		// Gold macro context signal
		const dxyBearish = dxy && dxy.change < -0.3;
		const realYieldFalling = realYield !== null && realYield < 1.5;
		let goldSignal = 'neutral';
		let goldContext = '';
		if (dxyBearish && realYieldFalling) {
			goldSignal = 'bullish';
			goldContext = 'DXY weakness + low real yields = classic gold bull environment';
		} else if (dxy && dxy.change > 0.3 && realYield !== null && realYield > 2.0) {
			goldSignal = 'bearish';
			goldContext = 'Strong DXY + high real yields = headwind for gold';
		} else {
			goldContext = 'Mixed macro — monitor DXY and real yield direction';
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
				direction: realYield > 1.5 ? 'down' : 'up' // high real yield = bearish for gold
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

		toolCache.set(cacheKey, result, 5 * 60_000); // cache 5min
		return result;
	}
});
