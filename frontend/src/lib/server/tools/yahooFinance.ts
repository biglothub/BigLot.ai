// Yahoo Finance helper for forex, commodities, and stocks
// Used as fallback when Binance/CoinGecko don't support the asset

import type { OHLCV } from '$lib/types/contentBlock';

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

// Known forex / commodity base codes
const FOREX_COMMODITY_CODES = new Set([
	'XAU', 'XAG', 'XPT', 'XPD', // precious metals
	'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD', // major currencies
	'SEK', 'NOK', 'DKK', 'SGD', 'HKD', 'KRW', 'TWD', 'MXN', 'ZAR', 'TRY', 'PLN', 'CZK', 'HUF', 'THB', 'INR', 'IDR', 'MYR', 'PHP', 'CNY', 'CNH', 'BRL', 'ARS', 'CLP', 'COP', 'PEN',
]);

// Known forex pair patterns (6 chars, both halves are 3-char currency/commodity codes)
const FOREX_QUOTE_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD', 'THB']);

/**
 * Detect if a symbol looks like a forex/commodity pair (e.g., XAUUSD, EURUSD)
 */
export function isForexOrCommodity(symbol: string): boolean {
	const s = symbol.toUpperCase().replace(/[^A-Z]/g, '');
	if (s.length === 6) {
		const base = s.slice(0, 3);
		const quote = s.slice(3, 6);
		if (FOREX_COMMODITY_CODES.has(base) && FOREX_QUOTE_CURRENCIES.has(quote)) return true;
		if (FOREX_COMMODITY_CODES.has(quote) && FOREX_QUOTE_CURRENCIES.has(base)) return true;
	}
	// Also catch explicit patterns like XAU/USD
	if (s.length >= 6) {
		const base = s.slice(0, 3);
		if (['XAU', 'XAG', 'XPT', 'XPD'].includes(base)) return true;
	}
	return false;
}

/**
 * Convert a symbol to Yahoo Finance format
 * XAUUSD -> XAUUSD=X, EURUSD -> EURUSD=X
 */
export function toYahooSymbol(symbol: string): string {
	const s = symbol.toUpperCase().replace(/[^A-Z]/g, '');
	return `${s}=X`;
}

/**
 * Map our interval format to Yahoo Finance interval + range
 */
function mapIntervalToYahoo(interval: string): { interval: string; range: string } {
	const map: Record<string, { interval: string; range: string }> = {
		'1m': { interval: '1m', range: '1d' },
		'5m': { interval: '5m', range: '5d' },
		'15m': { interval: '15m', range: '5d' },
		'30m': { interval: '30m', range: '1mo' },
		'1h': { interval: '60m', range: '1mo' },
		'2h': { interval: '60m', range: '3mo' }, // Yahoo doesn't have 2h, use 1h with more range
		'4h': { interval: '60m', range: '6mo' }, // Yahoo doesn't have 4h, use 1h
		'6h': { interval: '60m', range: '6mo' },
		'8h': { interval: '60m', range: '6mo' },
		'12h': { interval: '1d', range: '1y' },
		'1d': { interval: '1d', range: '1y' },
		'1w': { interval: '1wk', range: '5y' },
		'1M': { interval: '1mo', range: 'max' },
	};
	return map[interval] || { interval: '1d', range: '1y' };
}

/**
 * Fetch OHLCV data from Yahoo Finance
 */
export async function fetchYahooOHLCV(
	symbol: string,
	interval: string,
	limit: number
): Promise<{ ohlcv: OHLCV[]; name: string } | { error: string }> {
	const yahooSymbol = toYahooSymbol(symbol);
	const mapped = mapIntervalToYahoo(interval);

	const url = `${YAHOO_BASE}/${encodeURIComponent(yahooSymbol)}?interval=${mapped.interval}&range=${mapped.range}`;

	const response = await fetch(url, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (compatible; BigLot.ai/1.0)',
			Accept: 'application/json'
		}
	});

	if (!response.ok) {
		return { error: `Yahoo Finance returned HTTP ${response.status} for ${yahooSymbol}` };
	}

	const data = await response.json();
	const result = data?.chart?.result?.[0];
	if (!result) {
		return { error: `No data returned from Yahoo Finance for ${yahooSymbol}` };
	}

	const timestamps = result.timestamp as number[] | undefined;
	const quote = result.indicators?.quote?.[0];
	const meta = result.meta;

	if (!timestamps || !quote) {
		return { error: `Incomplete data from Yahoo Finance for ${yahooSymbol}` };
	}

	const ohlcv: OHLCV[] = [];
	for (let i = 0; i < timestamps.length; i++) {
		const open = quote.open?.[i];
		const high = quote.high?.[i];
		const low = quote.low?.[i];
		const close = quote.close?.[i];
		const volume = quote.volume?.[i] ?? 0;

		if (open != null && high != null && low != null && close != null) {
			ohlcv.push({
				time: timestamps[i],
				open: parseFloat(Number(open).toFixed(6)),
				high: parseFloat(Number(high).toFixed(6)),
				low: parseFloat(Number(low).toFixed(6)),
				close: parseFloat(Number(close).toFixed(6)),
				volume: Number(volume)
			});
		}
	}

	// For intervals Yahoo doesn't natively support (2h, 4h, 6h, 8h), aggregate 1h candles
	const aggregated = aggregateCandles(ohlcv, interval);

	// Trim to limit
	const trimmed = aggregated.slice(-limit);
	const name = meta?.shortName || meta?.symbol || symbol;

	return { ohlcv: trimmed, name: String(name) };
}

/**
 * Aggregate 1h candles into larger timeframes when Yahoo doesn't support them natively
 */
function aggregateCandles(candles: OHLCV[], targetInterval: string): OHLCV[] {
	const hoursMap: Record<string, number> = { '2h': 2, '4h': 4, '6h': 6, '8h': 8 };
	const hours = hoursMap[targetInterval];
	if (!hours || candles.length === 0) return candles;

	const result: OHLCV[] = [];
	let bucket: OHLCV | null = null;
	let count = 0;

	for (const c of candles) {
		if (count === 0) {
			bucket = { ...c };
			count = 1;
		} else if (bucket) {
			bucket.high = Math.max(bucket.high, c.high);
			bucket.low = Math.min(bucket.low, c.low);
			bucket.close = c.close;
			bucket.volume += c.volume;
			count++;
		}

		if (count >= hours && bucket) {
			result.push(bucket);
			bucket = null;
			count = 0;
		}
	}

	// Push remaining partial bucket
	if (bucket) result.push(bucket);

	return result;
}

/**
 * Fetch market data (price, change, volume) from Yahoo Finance
 */
export async function fetchYahooMarketData(symbol: string): Promise<
	| {
			name: string;
			symbol: string;
			price: number;
			change24h: number;
			volume: number;
			high24h: number;
			low24h: number;
			previousClose: number;
	  }
	| { error: string }
> {
	const yahooSymbol = toYahooSymbol(symbol);
	const url = `${YAHOO_BASE}/${encodeURIComponent(yahooSymbol)}?interval=1d&range=2d`;

	const response = await fetch(url, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (compatible; BigLot.ai/1.0)',
			Accept: 'application/json'
		}
	});

	if (!response.ok) {
		return { error: `Yahoo Finance returned HTTP ${response.status} for ${yahooSymbol}` };
	}

	const data = await response.json();
	const result = data?.chart?.result?.[0];
	if (!result) {
		return { error: `No data from Yahoo Finance for ${yahooSymbol}` };
	}

	const meta = result.meta;
	const quote = result.indicators?.quote?.[0];

	const price = meta?.regularMarketPrice ?? quote?.close?.at(-1) ?? 0;
	const previousClose = meta?.chartPreviousClose ?? meta?.previousClose ?? price;
	const change24h = previousClose !== 0 ? ((price - previousClose) / previousClose) * 100 : 0;

	// Get today's high/low from the latest candle
	const highs = quote?.high?.filter((v: number | null) => v != null) ?? [];
	const lows = quote?.low?.filter((v: number | null) => v != null) ?? [];
	const volumes = quote?.volume?.filter((v: number | null) => v != null) ?? [];

	return {
		name: meta?.shortName || meta?.symbol || symbol.toUpperCase(),
		symbol: symbol.toUpperCase().replace(/[^A-Z]/g, ''),
		price: Number(price),
		change24h,
		volume: Number(volumes.at(-1) ?? 0),
		high24h: Number(highs.at(-1) ?? price),
		low24h: Number(lows.at(-1) ?? price),
		previousClose: Number(previousClose)
	};
}
