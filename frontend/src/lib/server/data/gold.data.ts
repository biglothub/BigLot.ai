// Shared Gold Data Layer — reused by gold.tool.ts + dashboard API
import { toolCache } from '../cache.server';
import type { OHLCV } from '$lib/types/contentBlock';
import { validateRange } from './validation';

const YAHOO_HEADERS = {
	'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
	Accept: 'application/json'
};

/**
 * Thai gold bar price (baht/baht-weight) from XAUUSD spot.
 *
 * Conversion chain:
 *   XAUUSD ($/troy-oz) × USDTHB (THB/$)  → THB per troy ounce
 *   ÷ 31.1035 (grams per troy ounce)      → THB per gram
 *   × 15.244 (grams per baht-weight)      → THB per baht-weight
 *   × 0.965 (96.5% purity, Thai standard) → final price
 */
export function calcThaiGoldPrice(xauUsd: number, thbRate: number): number {
	return (xauUsd * thbRate / 31.1035) * 15.244 * 0.965;
}

// Persists across requests — updated on every successful fetch, seed = 35.5
let lastKnownThbRate = 35.5;

export async function fetchThbRate(): Promise<{ rate: number; isLive: boolean }> {
	const cacheKey = toolCache.generateKey('thb_rate', {});
	const cached = toolCache.get<number>(cacheKey);
	if (cached) return { rate: cached, isLive: true };

	try {
		// Yahoo Finance USDTHB=X — real-time forex rate
		const res = await fetch(
			'https://query1.finance.yahoo.com/v8/finance/chart/USDTHB=X?range=1d&interval=1d',
			{ headers: YAHOO_HEADERS }
		);
		if (!res.ok) return { rate: lastKnownThbRate, isLive: false };
		const data = await res.json() as any;
		const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
		if (typeof rate === 'number' && rate > 0) {
			lastKnownThbRate = rate;
			toolCache.set(cacheKey, rate, 600_000); // cache 10min (forex moves fast)
			return { rate, isLive: true };
		}
		return { rate: lastKnownThbRate, isLive: false };
	} catch {
		return { rate: lastKnownThbRate, isLive: false };
	}
}

export interface GoldPriceData {
	comexPrice: number | null;
	comexPrevClose: number | null;
	comexHigh52w: number | null;
	comexLow52w: number | null;
	binancePrice: number | null;
	binanceChange24h: number | null;
	thbRate: number;
	thaiGoldPrice: number;
	spotPrice: number;
	change24hPct: number;
	priceSource: 'comex' | 'binance';
	thbIsLive: boolean;
	warnings: string[];
}

export async function fetchGoldPriceData(): Promise<GoldPriceData | null> {
	const [yahooRes, binanceRes, thbResult] = await Promise.allSettled([
		fetch('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1d&interval=1m', { headers: YAHOO_HEADERS }),
		fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=XAUUSDT'),
		fetchThbRate()
	]);

	let comexPrice: number | null = null;
	let comexPrevClose: number | null = null;
	let comexHigh52w: number | null = null;
	let comexLow52w: number | null = null;
	let binancePrice: number | null = null;
	let binanceChange24h: number | null = null;

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
		} catch { /* ignore */ }
	}

	if (binanceRes.status === 'fulfilled' && binanceRes.value.ok) {
		try {
			const data = await binanceRes.value.json() as any;
			binancePrice = parseFloat(data.lastPrice);
			binanceChange24h = parseFloat(data.priceChangePercent);
		} catch { /* ignore */ }
	}

	const spotPrice = comexPrice ?? binancePrice;
	if (!spotPrice) return null;

	const priceSource: 'comex' | 'binance' = comexPrice ? 'comex' : 'binance';
	const thb = thbResult.status === 'fulfilled' ? thbResult.value : { rate: lastKnownThbRate, isLive: false };
	const thaiGoldPrice = calcThaiGoldPrice(spotPrice, thb.rate);
	const change24hPct = comexPrevClose
		? ((spotPrice - comexPrevClose) / comexPrevClose) * 100
		: (binanceChange24h ?? 0);

	// Cross-validation & range checks
	const warnings: string[] = [];
	const SPREAD_THRESHOLD = 5; // USD

	if (comexPrice !== null && binancePrice !== null) {
		const spread = Math.abs(comexPrice - binancePrice);
		if (spread > SPREAD_THRESHOLD) {
			warnings.push(`COMEX/Binance spread: $${spread.toFixed(2)}`);
		}
	}

	const goldWarn = validateRange('gold', spotPrice);
	if (goldWarn) warnings.push(goldWarn);
	const thbWarn = validateRange('thb', thb.rate);
	if (thbWarn) warnings.push(thbWarn);

	return {
		comexPrice, comexPrevClose, comexHigh52w, comexLow52w,
		binancePrice, binanceChange24h,
		thbRate: thb.rate, thaiGoldPrice, spotPrice, change24hPct,
		priceSource, thbIsLive: thb.isLive, warnings
	};
}

const GOLD_INTERVAL_MAP: Record<string, { yahooInterval: string; yahooRange: string }> = {
	'1d': { yahooInterval: '5m', yahooRange: '1d' },
	'1wk': { yahooInterval: '1h', yahooRange: '5d' },
	'1mo': { yahooInterval: '1d', yahooRange: '1mo' },
	'3mo': { yahooInterval: '1d', yahooRange: '3mo' },
	'6mo': { yahooInterval: '1wk', yahooRange: '6mo' },
	'1y': { yahooInterval: '1wk', yahooRange: '1y' },
	'5y': { yahooInterval: '1mo', yahooRange: '5y' }
};

export async function fetchGoldOHLCV(timeframe = '1mo'): Promise<{ ohlcv: OHLCV[]; interval: string; timeframe: string } | null> {
	const tf = GOLD_INTERVAL_MAP[timeframe] ? timeframe : '1mo';
	const { yahooInterval, yahooRange } = GOLD_INTERVAL_MAP[tf];

	const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=${yahooRange}&interval=${yahooInterval}`;
	const res = await fetch(url, { headers: YAHOO_HEADERS });
	if (!res.ok) return null;

	const data = await res.json() as any;
	const result0 = data?.chart?.result?.[0];
	if (!result0) return null;

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

	if (ohlcv.length === 0) return null;
	return { ohlcv, interval: yahooInterval, timeframe: tf };
}
