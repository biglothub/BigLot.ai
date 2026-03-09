import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const YAHOO_HEADERS = {
	'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
	Accept: 'application/json'
};

export type WatchlistItem = {
	symbol: string;
	label: string;
	price: number;
	change: number;
	currency: string;
};

const WATCHLIST_SYMBOLS = [
	{ symbol: 'GC=F',      label: 'Gold',   currency: 'USD' },
	{ symbol: 'DX-Y.NYB',  label: 'DXY',    currency: '' },
	{ symbol: '%5EGSPC',   label: 'S&P 500', currency: 'USD' },
	{ symbol: '%5ETNX',    label: 'US 10Y',  currency: '%' },
	{ symbol: 'BTC-USD',   label: 'BTC',     currency: 'USD' },
	{ symbol: 'SI=F',      label: 'Silver',  currency: 'USD' }
];

// Simple in-memory cache
let cachedData: WatchlistItem[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 30_000; // 30 seconds

async function fetchQuote(yahooSymbol: string): Promise<{ price: number; change: number } | null> {
	try {
		const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=2d&interval=1d`;
		const res = await fetch(url, { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(8000) });
		if (!res.ok) return null;

		const data = await res.json() as any;
		const meta = data?.chart?.result?.[0]?.meta;
		if (!meta) return null;

		const price = meta.regularMarketPrice ?? 0;
		const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
		const change = prevClose !== 0 ? ((price - prevClose) / prevClose) * 100 : 0;
		return { price, change };
	} catch {
		return null;
	}
}

export const GET: RequestHandler = async () => {
	const now = Date.now();
	if (cachedData && now - cacheTime < CACHE_TTL) {
		return json(cachedData);
	}

	const results = await Promise.allSettled(
		WATCHLIST_SYMBOLS.map((s) => fetchQuote(s.symbol))
	);

	const items: WatchlistItem[] = [];
	WATCHLIST_SYMBOLS.forEach((sym, i) => {
		const r = results[i];
		const quote = r.status === 'fulfilled' ? r.value : null;
		if (quote) {
			items.push({
				symbol: sym.symbol,
				label: sym.label,
				price: quote.price,
				change: quote.change,
				currency: sym.currency
			});
		}
	});

	cachedData = items;
	cacheTime = now;

	return json(items, {
		headers: {
			'Cache-Control': 'public, max-age=30',
			'Access-Control-Allow-Origin': '*'
		}
	});
};
