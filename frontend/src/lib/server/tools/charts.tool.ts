// Chart Tools - get_crypto_chart, get_technical_analysis
import { registerTool, type ToolResult } from './registry';
import { toolCache } from '../cache.server';
import type { OHLCV } from '$lib/types/contentBlock';

const BINANCE_BASE = 'https://api.binance.com/api/v3';

const INTERVAL_MAP: Record<string, string> = {
	'1m': '1m',
	'5m': '5m',
	'15m': '15m',
	'30m': '30m',
	'1h': '1h',
	'2h': '2h',
	'4h': '4h',
	'6h': '6h',
	'8h': '8h',
	'12h': '12h',
	'1d': '1d',
	'1w': '1w',
	'1M': '1M'
};

function normalizeSymbol(symbol: string): string {
	let s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
	// Add USDT if not already a full trading pair
	// A full pair looks like ETHBTC, BNBETH, MATICUSDT (quote currency appended)
	// Plain tickers like BTC, ETH, SOL need USDT appended
	const isFullPair =
		s.endsWith('USDT') ||
		s.endsWith('BUSD') ||
		(s.endsWith('BTC') && s.length > 3) ||
		(s.endsWith('ETH') && s.length > 3);
	if (!isFullPair) {
		s += 'USDT';
	}
	return s;
}

function normalizeInterval(interval: string): string {
	const lower = interval.toLowerCase().trim();
	return INTERVAL_MAP[lower] || '4h';
}

// --- RSI calculation ---
function calculateRSI(closes: number[], period = 14): number[] {
	const rsi: number[] = [];
	if (closes.length < period + 1) return rsi;

	let avgGain = 0;
	let avgLoss = 0;

	for (let i = 1; i <= period; i++) {
		const diff = closes[i] - closes[i - 1];
		if (diff > 0) avgGain += diff;
		else avgLoss += Math.abs(diff);
	}
	avgGain /= period;
	avgLoss /= period;

	// Fill initial empty values
	for (let i = 0; i < period; i++) rsi.push(NaN);

	const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
	rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));

	for (let i = period + 1; i < closes.length; i++) {
		const diff = closes[i] - closes[i - 1];
		const gain = diff > 0 ? diff : 0;
		const loss = diff < 0 ? Math.abs(diff) : 0;
		avgGain = (avgGain * (period - 1) + gain) / period;
		avgLoss = (avgLoss * (period - 1) + loss) / period;
		const rsVal = avgLoss === 0 ? 100 : avgGain / avgLoss;
		rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rsVal));
	}

	return rsi;
}

// --- SMA calculation ---
function calculateSMA(data: number[], period: number): number[] {
	const result: number[] = [];
	for (let i = 0; i < data.length; i++) {
		if (i < period - 1) {
			result.push(NaN);
		} else {
			let sum = 0;
			for (let j = i - period + 1; j <= i; j++) sum += data[j];
			result.push(sum / period);
		}
	}
	return result;
}

// --- EMA calculation ---
function calculateEMA(data: number[], period: number): number[] {
	const result: number[] = [];
	const multiplier = 2 / (period + 1);

	for (let i = 0; i < data.length; i++) {
		if (i < period - 1) {
			result.push(NaN);
		} else if (i === period - 1) {
			let sum = 0;
			for (let j = 0; j < period; j++) sum += data[j];
			result.push(sum / period);
		} else {
			result.push((data[i] - result[i - 1]) * multiplier + result[i - 1]);
		}
	}
	return result;
}

// --- MACD calculation ---
function calculateMACD(
	closes: number[],
	fastPeriod = 12,
	slowPeriod = 26,
	signalPeriod = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
	const emaFast = calculateEMA(closes, fastPeriod);
	const emaSlow = calculateEMA(closes, slowPeriod);

	const macdLine: number[] = [];
	for (let i = 0; i < closes.length; i++) {
		if (isNaN(emaFast[i]) || isNaN(emaSlow[i])) {
			macdLine.push(NaN);
		} else {
			macdLine.push(emaFast[i] - emaSlow[i]);
		}
	}

	// Signal line = EMA of MACD line
	const validMacd = macdLine.filter((v) => !isNaN(v));
	const signalFromValid = calculateEMA(validMacd, signalPeriod);

	const signal: number[] = [];
	let validIdx = 0;
	for (let i = 0; i < macdLine.length; i++) {
		if (isNaN(macdLine[i])) {
			signal.push(NaN);
		} else {
			signal.push(signalFromValid[validIdx] ?? NaN);
			validIdx++;
		}
	}

	const histogram: number[] = [];
	for (let i = 0; i < macdLine.length; i++) {
		if (isNaN(macdLine[i]) || isNaN(signal[i])) {
			histogram.push(NaN);
		} else {
			histogram.push(macdLine[i] - signal[i]);
		}
	}

	return { macd: macdLine, signal, histogram };
}

// --- Bollinger Bands ---
function calculateBollingerBands(
	closes: number[],
	period = 20,
	stdDev = 2
): { upper: number[]; middle: number[]; lower: number[] } {
	const sma = calculateSMA(closes, period);
	const upper: number[] = [];
	const middle: number[] = [];
	const lower: number[] = [];

	for (let i = 0; i < closes.length; i++) {
		if (isNaN(sma[i])) {
			upper.push(NaN);
			middle.push(NaN);
			lower.push(NaN);
		} else {
			let sumSq = 0;
			for (let j = i - period + 1; j <= i; j++) {
				sumSq += (closes[j] - sma[i]) ** 2;
			}
			const std = Math.sqrt(sumSq / period);
			upper.push(sma[i] + stdDev * std);
			middle.push(sma[i]);
			lower.push(sma[i] - stdDev * std);
		}
	}

	return { upper, middle, lower };
}

// --- Get Crypto Chart Tool ---

registerTool({
	name: 'get_crypto_chart',
	description:
		'Fetch cryptocurrency price chart data (OHLCV candlestick data) from Binance. Returns an interactive candlestick chart. Use when users ask to see a chart, price action, or candles for any crypto pair.',
	parameters: {
		type: 'object',
		properties: {
			symbol: {
				type: 'string',
				description: 'Trading pair symbol (e.g. BTC, ETHUSDT, SOLUSDT)'
			},
			interval: {
				type: 'string',
				description: 'Candlestick interval',
				enum: ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '1w']
			},
			limit: {
				type: 'number',
				description: 'Number of candles to return (default: 100, max: 500)'
			}
		},
		required: ['symbol']
	},
	timeout: 15_000,
	execute: async (args): Promise<ToolResult> => {
		const symbol = normalizeSymbol(String(args.symbol || 'BTCUSDT'));
		const interval = normalizeInterval(String(args.interval || '4h'));
		const limit = Math.min(Math.max(Number(args.limit) || 100, 10), 500);

		const cacheKey = toolCache.generateKey('get_crypto_chart', { symbol, interval, limit });
		const cached = toolCache.get<ToolResult>(cacheKey);
		if (cached) return cached;

		const url = `${BINANCE_BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
		console.log(`[get_crypto_chart] Fetching: ${url}`);
		const response = await fetch(url);

		if (!response.ok) {
			const errorBody = await response.text().catch(() => 'no body');
			console.error(`[get_crypto_chart] Binance error ${response.status}: ${errorBody}`);
			return {
				success: false,
				contentBlocks: [
					{
						type: 'error',
						message: `Failed to fetch chart data for ${symbol} (HTTP ${response.status}). The symbol may not be available on Binance.`,
						tool: 'get_crypto_chart'
					}
				],
				textSummary: `Error: Could not fetch chart data for ${symbol} (HTTP ${response.status}).`
			};
		}

		const rawData = await response.json();
		const ohlcv: OHLCV[] = (rawData as number[][]).map((k: number[]) => ({
			time: Math.floor(k[0] / 1000), // Binance returns ms, lightweight-charts needs seconds
			open: parseFloat(String(k[1])),
			high: parseFloat(String(k[2])),
			low: parseFloat(String(k[3])),
			close: parseFloat(String(k[4])),
			volume: parseFloat(String(k[5]))
		}));

		const lastCandle = ohlcv[ohlcv.length - 1];
		const firstCandle = ohlcv[0];
		const priceChange = lastCandle
			? ((lastCandle.close - firstCandle.close) / firstCandle.close) * 100
			: 0;

		const result: ToolResult = {
			success: true,
			contentBlocks: [
				{
					type: 'chart',
					chartType: 'candlestick',
					symbol,
					interval,
					data: ohlcv
				}
			],
			textSummary: `${symbol} ${interval} chart: ${ohlcv.length} candles, Latest close: ${lastCandle?.close ?? 'N/A'}, Price change over period: ${priceChange.toFixed(2)}%, High: ${Math.max(...ohlcv.map((c) => c.high)).toFixed(2)}, Low: ${Math.min(...ohlcv.map((c) => c.low)).toFixed(2)}`
		};

		toolCache.set(cacheKey, result, 60_000);
		return result;
	}
});

// --- Technical Analysis Tool ---

registerTool({
	name: 'get_technical_analysis',
	description:
		'Calculate technical indicators (RSI, MACD, Bollinger Bands, SMA, EMA) for a cryptocurrency. Returns a chart with indicators overlaid and a data table. Use when users ask for technical analysis, RSI, MACD, moving averages, or indicators.',
	parameters: {
		type: 'object',
		properties: {
			symbol: {
				type: 'string',
				description: 'Trading pair symbol (e.g. BTC, ETHUSDT, SOLUSDT)'
			},
			indicators: {
				type: 'array',
				items: {
					type: 'string',
					enum: ['rsi', 'macd', 'bb', 'sma_20', 'sma_50', 'sma_200', 'ema_12', 'ema_26']
				},
				description: 'Which indicators to calculate (default: rsi, sma_20, sma_50)'
			},
			interval: {
				type: 'string',
				description: 'Timeframe for analysis',
				enum: ['1h', '4h', '1d']
			}
		},
		required: ['symbol']
	},
	timeout: 20_000,
	execute: async (args): Promise<ToolResult> => {
		const symbol = normalizeSymbol(String(args.symbol || 'BTCUSDT'));
		const interval = normalizeInterval(String(args.interval || '1d'));
		const indicators = Array.isArray(args.indicators)
			? (args.indicators as string[])
			: ['rsi', 'sma_20', 'sma_50'];

		const cacheKey = toolCache.generateKey('get_technical_analysis', {
			symbol,
			interval,
			indicators
		});
		const cached = toolCache.get<ToolResult>(cacheKey);
		if (cached) return cached;

		// Fetch enough data for calculations (200 extra for SMA200)
		const limit = 300;
		const url = `${BINANCE_BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
		const response = await fetch(url);

		if (!response.ok) {
			return {
				success: false,
				contentBlocks: [
					{
						type: 'error',
						message: `Failed to fetch data for ${symbol}`,
						tool: 'get_technical_analysis'
					}
				],
				textSummary: `Error: Could not fetch data for ${symbol}.`
			};
		}

		const rawData = await response.json();
		const ohlcv: OHLCV[] = (rawData as number[][]).map((k: number[]) => ({
			time: Math.floor(k[0] / 1000),
			open: parseFloat(String(k[1])),
			high: parseFloat(String(k[2])),
			low: parseFloat(String(k[3])),
			close: parseFloat(String(k[4])),
			volume: parseFloat(String(k[5]))
		}));

		const closes = ohlcv.map((c) => c.close);
		const times = ohlcv.map((c) => c.time);

		const chartIndicators: {
			name: string;
			data: { time: number; value: number }[];
			color?: string;
			overlay: boolean;
		}[] = [];
		const tableRows: (string | number)[][] = [];
		const summaryParts: string[] = [];

		const lastClose = closes[closes.length - 1];

		for (const ind of indicators) {
			switch (ind) {
				case 'rsi': {
					const rsiValues = calculateRSI(closes);
					const lastRSI = rsiValues[rsiValues.length - 1];
					chartIndicators.push({
						name: 'RSI (14)',
						data: rsiValues
							.map((v, i) => ({ time: times[i], value: v }))
							.filter((d) => !isNaN(d.value)),
						color: '#8b5cf6',
						overlay: false
					});
					tableRows.push(['RSI (14)', lastRSI?.toFixed(2) ?? 'N/A']);
					summaryParts.push(`RSI(14): ${lastRSI?.toFixed(2) ?? 'N/A'}`);
					break;
				}
				case 'macd': {
					const { macd, signal, histogram } = calculateMACD(closes);
					const lastMACD = macd[macd.length - 1];
					const lastSignal = signal[signal.length - 1];
					const lastHist = histogram[histogram.length - 1];
					chartIndicators.push({
						name: 'MACD',
						data: macd
							.map((v, i) => ({ time: times[i], value: v }))
							.filter((d) => !isNaN(d.value)),
						color: '#3b82f6',
						overlay: false
					});
					chartIndicators.push({
						name: 'MACD Signal',
						data: signal
							.map((v, i) => ({ time: times[i], value: v }))
							.filter((d) => !isNaN(d.value)),
						color: '#ef4444',
						overlay: false
					});
					tableRows.push(['MACD', lastMACD?.toFixed(4) ?? 'N/A']);
					tableRows.push(['MACD Signal', lastSignal?.toFixed(4) ?? 'N/A']);
					tableRows.push(['MACD Histogram', lastHist?.toFixed(4) ?? 'N/A']);
					summaryParts.push(
						`MACD: ${lastMACD?.toFixed(4)}, Signal: ${lastSignal?.toFixed(4)}, Hist: ${lastHist?.toFixed(4)}`
					);
					break;
				}
				case 'bb': {
					const { upper, middle, lower } = calculateBollingerBands(closes);
					const lastUpper = upper[upper.length - 1];
					const lastMiddle = middle[middle.length - 1];
					const lastLower = lower[lower.length - 1];
					chartIndicators.push({
						name: 'BB Upper',
						data: upper
							.map((v, i) => ({ time: times[i], value: v }))
							.filter((d) => !isNaN(d.value)),
						color: '#94a3b8',
						overlay: true
					});
					chartIndicators.push({
						name: 'BB Middle',
						data: middle
							.map((v, i) => ({ time: times[i], value: v }))
							.filter((d) => !isNaN(d.value)),
						color: '#64748b',
						overlay: true
					});
					chartIndicators.push({
						name: 'BB Lower',
						data: lower
							.map((v, i) => ({ time: times[i], value: v }))
							.filter((d) => !isNaN(d.value)),
						color: '#94a3b8',
						overlay: true
					});
					tableRows.push(['BB Upper', lastUpper?.toFixed(2) ?? 'N/A']);
					tableRows.push(['BB Middle (SMA20)', lastMiddle?.toFixed(2) ?? 'N/A']);
					tableRows.push(['BB Lower', lastLower?.toFixed(2) ?? 'N/A']);
					summaryParts.push(
						`BB: Upper ${lastUpper?.toFixed(2)}, Middle ${lastMiddle?.toFixed(2)}, Lower ${lastLower?.toFixed(2)}`
					);
					break;
				}
				case 'sma_20':
				case 'sma_50':
				case 'sma_200': {
					const period = parseInt(ind.split('_')[1], 10);
					const smaValues = calculateSMA(closes, period);
					const lastSMA = smaValues[smaValues.length - 1];
					const colors: Record<number, string> = {
						20: '#f59e0b',
						50: '#10b981',
						200: '#ef4444'
					};
					chartIndicators.push({
						name: `SMA ${period}`,
						data: smaValues
							.map((v, i) => ({ time: times[i], value: v }))
							.filter((d) => !isNaN(d.value)),
						color: colors[period] || '#6b7280',
						overlay: true
					});
					tableRows.push([`SMA ${period}`, lastSMA?.toFixed(2) ?? 'N/A']);
					summaryParts.push(`SMA${period}: ${lastSMA?.toFixed(2) ?? 'N/A'}`);
					break;
				}
				case 'ema_12':
				case 'ema_26': {
					const period = parseInt(ind.split('_')[1], 10);
					const emaValues = calculateEMA(closes, period);
					const lastEMA = emaValues[emaValues.length - 1];
					chartIndicators.push({
						name: `EMA ${period}`,
						data: emaValues
							.map((v, i) => ({ time: times[i], value: v }))
							.filter((d) => !isNaN(d.value)),
						color: period === 12 ? '#8b5cf6' : '#ec4899',
						overlay: true
					});
					tableRows.push([`EMA ${period}`, lastEMA?.toFixed(2) ?? 'N/A']);
					summaryParts.push(`EMA${period}: ${lastEMA?.toFixed(2) ?? 'N/A'}`);
					break;
				}
			}
		}

		// Use last 100 candles for display
		const displayData = ohlcv.slice(-100);

		const result: ToolResult = {
			success: true,
			contentBlocks: [
				{
					type: 'chart',
					chartType: 'candlestick',
					symbol,
					interval,
					data: displayData,
					indicators: chartIndicators.map((ind) => ({
						...ind,
						data: ind.data.filter(
							(d) => d.time >= displayData[0].time
						)
					}))
				},
				{
					type: 'table',
					title: `${symbol} Technical Analysis (${interval})`,
					headers: ['Indicator', 'Value'],
					rows: [['Current Price', lastClose?.toFixed(2) ?? 'N/A'], ...tableRows]
				}
			],
			textSummary: `${symbol} ${interval} Technical Analysis: Price ${lastClose?.toFixed(2)}, ${summaryParts.join(', ')}`
		};

		toolCache.set(cacheKey, result, 60_000);
		return result;
	}
});
