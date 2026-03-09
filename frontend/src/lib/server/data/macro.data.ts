// Shared Macro Data Layer — reused by macro.tool.ts + dashboard API
import { toolCache } from '../cache.server';
import { validateRange } from './validation';

const YAHOO_HEADERS = {
	'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
	Accept: 'application/json'
};

export interface QuoteData {
	price: number;
	change: number;
	name: string;
}

export async function fetchYahooQuote(yahooSymbol: string): Promise<QuoteData | null> {
	try {
		const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=2d&interval=1d`;
		const res = await fetch(url, { headers: YAHOO_HEADERS });
		if (!res.ok) return null;

		const data = await res.json() as any;
		const meta = data?.chart?.result?.[0]?.meta ?? {};

		const price = meta.regularMarketPrice ?? 0;
		const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
		const change = prevClose !== 0 ? ((price - prevClose) / prevClose) * 100 : 0;
		const name = meta.shortName || meta.symbol || yahooSymbol;

		return { price, change, name: String(name) };
	} catch {
		return null;
	}
}

export async function fetchFredRealYield(): Promise<number | null> {
	const cacheKey = toolCache.generateKey('fred_dfii10', {});
	const cached = toolCache.get<number>(cacheKey);
	if (cached !== null && cached !== undefined) return cached;

	try {
		const res = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFII10');
		if (!res.ok) return null;

		const text = await res.text();
		const lines = text.trim().split('\n').slice(1);
		for (let i = lines.length - 1; i >= 0; i--) {
			const parts = lines[i].split(',');
			if (parts.length >= 2 && parts[1].trim() !== '.' && parts[1].trim() !== '') {
				const value = parseFloat(parts[1].trim());
				if (!isNaN(value)) {
					toolCache.set(cacheKey, value, 4 * 3_600_000);
					return value;
				}
			}
		}
		return null;
	} catch {
		return null;
	}
}

export interface MacroData {
	dxy: QuoteData | null;
	tnx: QuoteData | null;
	spx: QuoteData | null;
	realYield: number | null;
	goldSignal: 'bullish' | 'bearish' | 'neutral';
	goldContext: string;
	warnings: string[];
}

export async function fetchMacroData(): Promise<MacroData> {
	const [dxyResult, tnxResult, spxResult, realYieldResult] = await Promise.allSettled([
		fetchYahooQuote('DX-Y.NYB'),
		fetchYahooQuote('%5ETNX'),
		fetchYahooQuote('%5EGSPC'),
		fetchFredRealYield()
	]);

	const dxy = dxyResult.status === 'fulfilled' ? dxyResult.value : null;
	const tnx = tnxResult.status === 'fulfilled' ? tnxResult.value : null;
	const spx = spxResult.status === 'fulfilled' ? spxResult.value : null;
	const realYield = realYieldResult.status === 'fulfilled' ? realYieldResult.value : null;

	const dxyBearish = dxy && dxy.change < -0.3;
	const realYieldFalling = realYield !== null && realYield < 1.5;
	let goldSignal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
	let goldContext = 'Mixed macro — monitor DXY and real yield direction';

	if (dxyBearish && realYieldFalling) {
		goldSignal = 'bullish';
		goldContext = 'DXY weakness + low real yields = classic gold bull environment';
	} else if (dxy && dxy.change > 0.3 && realYield !== null && realYield > 2.0) {
		goldSignal = 'bearish';
		goldContext = 'Strong DXY + high real yields = headwind for gold';
	}

	const warnings: string[] = [];
	if (dxy) { const w = validateRange('dxy', dxy.price); if (w) warnings.push(w); }
	if (tnx) { const w = validateRange('tnx', tnx.price); if (w) warnings.push(w); }
	if (spx) { const w = validateRange('spx', spx.price); if (w) warnings.push(w); }
	{ const w = validateRange('realYield', realYield); if (w) warnings.push(w); }

	return { dxy, tnx, spx, realYield, goldSignal, goldContext, warnings };
}
