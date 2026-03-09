// Gold Tools — get_gold_price, get_gold_chart
// Data sources: Yahoo Finance (GC=F), Binance (XAUUSDT), open.er-api.com (THB rate)
import { registerTool, type ToolResult } from './registry';
import { toolCache } from '../cache.server';
import type { OHLCV } from '$lib/types/contentBlock';

const YAHOO_HEADERS = {
	'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
	Accept: 'application/json'
};

// ราคาทองไทย: XAUUSD * THB_rate / 31.1035 * 15.244 * 0.965
// 1 บาทน้ำหนัก = 15.244g, ทอง 96.5% purity
function calcThaiGoldPrice(xauUsd: number, thbRate: number): number {
	return (xauUsd * thbRate / 31.1035) * 15.244 * 0.965;
}

async function fetchThbRate(): Promise<number> {
	const cacheKey = toolCache.generateKey('thb_rate', {});
	const cached = toolCache.get<number>(cacheKey);
	if (cached) return cached;

	const res = await fetch('https://open.er-api.com/v6/latest/USD');
	if (!res.ok) return 35.5; // fallback

	const data = await res.json() as { rates: Record<string, number> };
	const rate = data.rates?.THB ?? 35.5;
	toolCache.set(cacheKey, rate, 3_600_000); // 1hr cache
	return rate;
}

// ─── get_gold_price ──────────────────────────────────────────────────────────

registerTool({
	name: 'get_gold_price',
	description:
		'Get real-time gold price from COMEX (GC=F via Yahoo Finance) and Binance XAUUSDT. Also calculates Thai gold price in THB per baht-weight (บาทละ). Use when user asks about gold price, ราคาทอง, XAUUSD.',
	parameters: {
		type: 'object',
		properties: {
			show_thai_price: {
				type: 'boolean',
				description: 'Include Thai gold price in THB per baht-weight (default: true)'
			}
		},
		required: []
	},
	timeout: 15_000,
	execute: async (args): Promise<ToolResult> => {
		const cacheKey = toolCache.generateKey('get_gold_price', {});
		const cached = toolCache.get<ToolResult>(cacheKey);
		if (cached) return cached;

		// Fetch all in parallel
		const [yahooRes, binanceRes, thbRate] = await Promise.allSettled([
			fetch('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1d&interval=1m', {
				headers: YAHOO_HEADERS
			}),
			fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=XAUUSDT'),
			fetchThbRate()
		]);

		let comexPrice: number | null = null;
		let comexPrevClose: number | null = null;
		let comexHigh52w: number | null = null;
		let comexLow52w: number | null = null;
		let binancePrice: number | null = null;
		let binanceChange24h: number | null = null;

		// Parse Yahoo Finance GC=F
		if (yahooRes.status === 'fulfilled' && yahooRes.value.ok) {
			try {
				const data = await yahooRes.value.json() as any;
				const meta = data?.chart?.result?.[0]?.meta;
				if (meta) {
					comexPrice = meta.regularMarketPrice;
					comexPrevClose = meta.previousClose ?? meta.chartPreviousClose;
					comexHigh52w = meta.fiftyTwoWeekHigh;
					comexLow52w = meta.fiftyTwoWeekLow;
				}
			} catch {}
		}

		// Parse Binance XAUUSDT
		if (binanceRes.status === 'fulfilled' && binanceRes.value.ok) {
			try {
				const data = await binanceRes.value.json() as any;
				binancePrice = parseFloat(data.lastPrice);
				binanceChange24h = parseFloat(data.priceChangePercent);
			} catch {}
		}

		const spotPrice = comexPrice ?? binancePrice;
		if (!spotPrice) {
			return {
				success: false,
				contentBlocks: [{ type: 'error', message: 'Failed to fetch gold price from all sources.', tool: 'get_gold_price' }],
				textSummary: 'Error: Could not fetch gold price.'
			};
		}

		const thb = thbRate.status === 'fulfilled' ? thbRate.value : 35.5;
		const thaiGoldPrice = calcThaiGoldPrice(spotPrice, thb);

		const change24hPct = comexPrevClose
			? ((spotPrice - comexPrevClose) / comexPrevClose) * 100
			: (binanceChange24h ?? 0);
		const direction = change24hPct > 0 ? 'up' : change24hPct < 0 ? 'down' : 'neutral';

		const metrics: { label: string; value: string; change?: string; direction?: 'up' | 'down' | 'neutral' }[] = [
			{
				label: 'COMEX Gold (GC=F)',
				value: comexPrice ? `$${comexPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / oz` : 'N/A',
				change: `${change24hPct >= 0 ? '+' : ''}${change24hPct.toFixed(2)}%`,
				direction
			},
			{
				label: 'Binance XAUUSDT',
				value: binancePrice ? `$${binancePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A',
				change: binanceChange24h !== null ? `${binanceChange24h >= 0 ? '+' : ''}${binanceChange24h.toFixed(2)}%` : undefined,
				direction: binanceChange24h !== null ? (binanceChange24h > 0 ? 'up' : binanceChange24h < 0 ? 'down' : 'neutral') : 'neutral'
			},
			{
				label: 'ราคาทองไทย (บาทละ)',
				value: `฿${thaiGoldPrice.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
				change: `${change24hPct >= 0 ? '+' : ''}${change24hPct.toFixed(2)}%`,
				direction
			},
			{
				label: 'USD / THB',
				value: `${thb.toFixed(2)} ฿`,
				direction: 'neutral'
			}
		];

		if (comexHigh52w && comexLow52w) {
			metrics.push({
				label: '52W High',
				value: `$${comexHigh52w.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
				direction: 'up'
			});
			metrics.push({
				label: '52W Low',
				value: `$${comexLow52w.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
				direction: 'down'
			});
		}

		const result: ToolResult = {
			success: true,
			contentBlocks: [{
				type: 'metric_card',
				title: `Gold Price — ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} ICT`,
				metrics
			}],
			textSummary: `Gold: COMEX $${spotPrice.toFixed(2)}/oz (${change24hPct >= 0 ? '+' : ''}${change24hPct.toFixed(2)}% 24h). Thai gold price: ฿${thaiGoldPrice.toFixed(0)}/บาทน้ำหนัก. USD/THB: ${thb.toFixed(2)}. ${comexHigh52w ? `52W range: $${comexLow52w?.toFixed(2)}–$${comexHigh52w?.toFixed(2)}` : ''}`
		};

		toolCache.set(cacheKey, result, 60_000); // 60s cache
		return result;
	}
});

// ─── get_gold_chart ───────────────────────────────────────────────────────────

const GOLD_INTERVAL_MAP: Record<string, { yahooInterval: string; yahooRange: string }> = {
	'1d': { yahooInterval: '5m', yahooRange: '1d' },
	'1wk': { yahooInterval: '1h', yahooRange: '5d' },
	'1mo': { yahooInterval: '1d', yahooRange: '1mo' },
	'3mo': { yahooInterval: '1d', yahooRange: '3mo' },
	'6mo': { yahooInterval: '1wk', yahooRange: '6mo' },
	'1y': { yahooInterval: '1wk', yahooRange: '1y' },
	'5y': { yahooInterval: '1mo', yahooRange: '5y' }
};

registerTool({
	name: 'get_gold_chart',
	description:
		'Fetch gold (GC=F COMEX futures) candlestick chart data from Yahoo Finance. Returns an interactive candlestick chart. Use when user asks for gold chart, ราคาทองกราฟ, XAUUSD chart.',
	parameters: {
		type: 'object',
		properties: {
			timeframe: {
				type: 'string',
				description: 'Chart timeframe',
				enum: ['1d', '1wk', '1mo', '3mo', '6mo', '1y', '5y']
			}
		},
		required: []
	},
	timeout: 15_000,
	execute: async (args): Promise<ToolResult> => {
		const timeframe = (typeof args.timeframe === 'string' && GOLD_INTERVAL_MAP[args.timeframe])
			? args.timeframe
			: '1mo';
		const { yahooInterval, yahooRange } = GOLD_INTERVAL_MAP[timeframe];

		const cacheKey = toolCache.generateKey('get_gold_chart', { timeframe });
		const cached = toolCache.get<ToolResult>(cacheKey);
		if (cached) return cached;

		const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=${yahooRange}&interval=${yahooInterval}`;
		const res = await fetch(url, { headers: YAHOO_HEADERS });

		if (!res.ok) {
			return {
				success: false,
				contentBlocks: [{ type: 'error', message: `Failed to fetch gold chart (HTTP ${res.status}).`, tool: 'get_gold_chart' }],
				textSummary: 'Error: Could not fetch gold chart data.'
			};
		}

		const data = await res.json() as any;
		const result0 = data?.chart?.result?.[0];

		if (!result0) {
			return {
				success: false,
				contentBlocks: [{ type: 'error', message: 'No chart data returned from Yahoo Finance.', tool: 'get_gold_chart' }],
				textSummary: 'Error: Empty chart data.'
			};
		}

		const timestamps: number[] = result0.timestamp ?? [];
		const quote = result0.indicators?.quote?.[0] ?? {};
		const opens: number[] = quote.open ?? [];
		const highs: number[] = quote.high ?? [];
		const lows: number[] = quote.low ?? [];
		const closes: number[] = quote.close ?? [];
		const volumes: number[] = quote.volume ?? [];

		const ohlcv: OHLCV[] = [];
		for (let i = 0; i < timestamps.length; i++) {
			if (closes[i] == null || isNaN(closes[i])) continue;
			ohlcv.push({
				time: timestamps[i],
				open: opens[i] ?? closes[i],
				high: highs[i] ?? closes[i],
				low: lows[i] ?? closes[i],
				close: closes[i],
				volume: volumes[i] ?? 0
			});
		}

		if (ohlcv.length === 0) {
			return {
				success: false,
				contentBlocks: [{ type: 'error', message: 'Could not parse OHLCV data from Yahoo Finance.', tool: 'get_gold_chart' }],
				textSummary: 'Error: No valid OHLCV data.'
			};
		}

		const lastCandle = ohlcv[ohlcv.length - 1];
		const firstCandle = ohlcv[0];
		const periodChange = ((lastCandle.close - firstCandle.close) / firstCandle.close) * 100;

		const toolResult: ToolResult = {
			success: true,
			contentBlocks: [{
				type: 'chart',
				chartType: 'candlestick',
				symbol: 'GC=F',
				interval: yahooInterval,
				data: ohlcv
			}],
			textSummary: `Gold (GC=F) ${timeframe} chart: ${ohlcv.length} candles. Latest close: $${lastCandle.close.toFixed(2)}. Period change: ${periodChange >= 0 ? '+' : ''}${periodChange.toFixed(2)}%. High: $${Math.max(...ohlcv.map(c => c.high)).toFixed(2)}, Low: $${Math.min(...ohlcv.map(c => c.low)).toFixed(2)}.`
		};

		const cacheTtl = timeframe === '1d' ? 60_000 : timeframe === '1wk' ? 300_000 : 600_000;
		toolCache.set(cacheKey, toolResult, cacheTtl);
		return toolResult;
	}
});
