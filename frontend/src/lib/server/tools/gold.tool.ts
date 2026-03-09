// Gold Tools — get_gold_price, get_gold_chart
// Data sources: Yahoo Finance (GC=F), Binance (XAUUSDT), open.er-api.com (THB rate)
import { registerTool, type ToolResult } from './registry';
import { toolCache } from '../cache.server';
import { fetchGoldPriceData, fetchGoldOHLCV } from '../data/gold.data';

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

		const gold = await fetchGoldPriceData();
		if (!gold) {
			return {
				success: false,
				contentBlocks: [{ type: 'error', message: 'Failed to fetch gold price from all sources.', tool: 'get_gold_price' }],
				textSummary: 'Error: Could not fetch gold price.'
			};
		}

		const direction = gold.change24hPct > 0 ? 'up' : gold.change24hPct < 0 ? 'down' : 'neutral';

		const metrics: { label: string; value: string; change?: string; direction?: 'up' | 'down' | 'neutral' }[] = [
			{
				label: 'COMEX Gold (GC=F)',
				value: gold.comexPrice ? `$${gold.comexPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / oz` : 'N/A',
				change: `${gold.change24hPct >= 0 ? '+' : ''}${gold.change24hPct.toFixed(2)}%`,
				direction
			},
			{
				label: 'Binance XAUUSDT',
				value: gold.binancePrice ? `$${gold.binancePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A',
				change: gold.binanceChange24h !== null ? `${gold.binanceChange24h >= 0 ? '+' : ''}${gold.binanceChange24h.toFixed(2)}%` : undefined,
				direction: gold.binanceChange24h !== null ? (gold.binanceChange24h > 0 ? 'up' : gold.binanceChange24h < 0 ? 'down' : 'neutral') : 'neutral'
			},
			{
				label: 'ราคาทองไทย (บาทละ)',
				value: `฿${gold.thaiGoldPrice.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
				change: `${gold.change24hPct >= 0 ? '+' : ''}${gold.change24hPct.toFixed(2)}%`,
				direction
			},
			{
				label: 'USD / THB',
				value: `${gold.thbRate.toFixed(2)} ฿`,
				direction: 'neutral'
			}
		];

		if (gold.comexHigh52w && gold.comexLow52w) {
			metrics.push({
				label: '52W High',
				value: `$${gold.comexHigh52w.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
				direction: 'up'
			});
			metrics.push({
				label: '52W Low',
				value: `$${gold.comexLow52w.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
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
			textSummary: `Gold: COMEX $${gold.spotPrice.toFixed(2)}/oz (${gold.change24hPct >= 0 ? '+' : ''}${gold.change24hPct.toFixed(2)}% 24h). Thai gold price: ฿${gold.thaiGoldPrice.toFixed(0)}/บาทน้ำหนัก. USD/THB: ${gold.thbRate.toFixed(2)}. ${gold.comexHigh52w ? `52W range: $${gold.comexLow52w?.toFixed(2)}–$${gold.comexHigh52w?.toFixed(2)}` : ''}`
		};

		toolCache.set(cacheKey, result, 60_000);
		return result;
	}
});

// ─── get_gold_chart ───────────────────────────────────────────────────────────

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
		const timeframe = typeof args.timeframe === 'string' ? args.timeframe : '1mo';

		const cacheKey = toolCache.generateKey('get_gold_chart', { timeframe });
		const cached = toolCache.get<ToolResult>(cacheKey);
		if (cached) return cached;

		const chartData = await fetchGoldOHLCV(timeframe);
		if (!chartData) {
			return {
				success: false,
				contentBlocks: [{ type: 'error', message: 'Failed to fetch gold chart data.', tool: 'get_gold_chart' }],
				textSummary: 'Error: Could not fetch gold chart data.'
			};
		}

		const { ohlcv, interval } = chartData;
		const lastCandle = ohlcv[ohlcv.length - 1];
		const firstCandle = ohlcv[0];
		const periodChange = ((lastCandle.close - firstCandle.close) / firstCandle.close) * 100;

		const toolResult: ToolResult = {
			success: true,
			contentBlocks: [{
				type: 'chart',
				chartType: 'candlestick',
				symbol: 'GC=F',
				interval,
				data: ohlcv
			}],
			textSummary: `Gold (GC=F) ${timeframe} chart: ${ohlcv.length} candles. Latest close: $${lastCandle.close.toFixed(2)}. Period change: ${periodChange >= 0 ? '+' : ''}${periodChange.toFixed(2)}%. High: $${Math.max(...ohlcv.map(c => c.high)).toFixed(2)}, Low: $${Math.min(...ohlcv.map(c => c.low)).toFixed(2)}.`
		};

		const cacheTtl = timeframe === '1d' ? 60_000 : timeframe === '1wk' ? 300_000 : 600_000;
		toolCache.set(cacheKey, toolResult, cacheTtl);
		return toolResult;
	}
});
