// Cross-Asset Correlation Tool — get_cross_asset_correlation
// Fetches 90-day daily closes for Gold, DXY, SPX, 10Y yield → calculates Pearson correlation
import { registerTool, type ToolResult } from './registry';
import { toolCache } from '../cache.server';

const YAHOO_HEADERS = {
	'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
	Accept: 'application/json'
};

const ASSETS = [
	{ symbol: 'GC=F',       label: 'Gold (GC=F)',    key: 'gold' },
	{ symbol: 'DX-Y.NYB',   label: 'DXY',            key: 'dxy' },
	{ symbol: '%5EGSPC',    label: 'S&P 500',         key: 'spx' },
	{ symbol: '%5ETNX',     label: 'US 10Y Yield',    key: 'tnx' }
] as const;

async function fetchDailyCloses(yahooSymbol: string): Promise<{ closes: number[]; times: number[] } | null> {
	try {
		const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=3mo&interval=1d`;
		const res = await fetch(url, { headers: YAHOO_HEADERS });
		if (!res.ok) return null;

		const data = await res.json() as any;
		const result0 = data?.chart?.result?.[0];
		if (!result0) return null;

		const timestamps: number[] = result0.timestamp ?? [];
		const closes: number[] = result0.indicators?.quote?.[0]?.close ?? [];

		const validCloses: number[] = [];
		const validTimes: number[] = [];
		for (let i = 0; i < timestamps.length; i++) {
			if (closes[i] != null && !isNaN(closes[i])) {
				validCloses.push(closes[i]);
				validTimes.push(timestamps[i]);
			}
		}
		return { closes: validCloses, times: validTimes };
	} catch {
		return null;
	}
}

/**
 * Pearson correlation coefficient between two equal-length arrays
 */
function pearsonCorrelation(x: number[], y: number[]): number {
	const n = Math.min(x.length, y.length);
	if (n < 2) return 0;

	let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
	for (let i = 0; i < n; i++) {
		sumX += x[i];
		sumY += y[i];
		sumXY += x[i] * y[i];
		sumX2 += x[i] * x[i];
		sumY2 += y[i] * y[i];
	}
	const num = n * sumXY - sumX * sumY;
	const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
	return den === 0 ? 0 : num / den;
}

/**
 * Calculate period return from closes array
 */
function periodReturn(closes: number[], days: number): number | null {
	if (closes.length < days + 1) return null;
	const start = closes[closes.length - 1 - days];
	const end = closes[closes.length - 1];
	return ((end - start) / start) * 100;
}

function corrLabel(r: number): string {
	const abs = Math.abs(r);
	const dir = r >= 0 ? 'positive' : 'negative';
	if (abs >= 0.7) return `Strong ${dir}`;
	if (abs >= 0.4) return `Moderate ${dir}`;
	if (abs >= 0.2) return `Weak ${dir}`;
	return 'Negligible';
}

function corrSignalForGold(key: string, r: number): 'up' | 'down' | 'neutral' {
	// Gold historically: negative with DXY/yields, positive/neutral with SPX (varies)
	if (key === 'dxy') return r < -0.3 ? 'up' : r > 0.3 ? 'down' : 'neutral';
	if (key === 'tnx') return r < -0.3 ? 'up' : r > 0.3 ? 'down' : 'neutral';
	return 'neutral';
}

registerTool({
	name: 'get_cross_asset_correlation',
	description:
		'Calculate Pearson correlation between Gold and key macro assets (DXY, S&P 500, US 10Y yield) using 90 days of daily price data. Also shows 1D/1W/1M/3M performance for each asset. Use when user asks about gold correlation, cross-asset relationships, or how gold moves relative to dollar/stocks/yields.',
	parameters: {
		type: 'object',
		properties: {},
		required: []
	},
	timeout: 25_000,
	execute: async (): Promise<ToolResult> => {
		const cacheKey = toolCache.generateKey('get_cross_asset_correlation', {});
		const cached = toolCache.get<ToolResult>(cacheKey);
		if (cached) return cached;

		// Fetch all assets in parallel
		const results = await Promise.allSettled(
			ASSETS.map((a) => fetchDailyCloses(a.symbol))
		);

		const assetData: Record<string, { closes: number[]; times: number[] } | null> = {};
		ASSETS.forEach((a, i) => {
			const r = results[i];
			assetData[a.key] = r.status === 'fulfilled' ? r.value : null;
		});

		const goldData = assetData['gold'];
		if (!goldData || goldData.closes.length < 10) {
			return {
				success: false,
				contentBlocks: [{ type: 'error', message: 'Failed to fetch gold price data for correlation.', tool: 'get_cross_asset_correlation' }],
				textSummary: 'Error: Could not fetch gold data for cross-asset analysis.'
			};
		}

		const metrics: { label: string; value: string; change?: string; direction?: 'up' | 'down' | 'neutral' }[] = [];
		const tableHeaders = ['Asset', '1D', '1W', '1M', '3M', 'Corr vs Gold'];
		const tableRows: (string | number)[][] = [];
		const summaryParts: string[] = [];

		for (const asset of ASSETS) {
			const data = assetData[asset.key];
			if (!data || data.closes.length < 5) continue;

			// Align closes by taking the last N where both gold and asset have data
			const n = Math.min(goldData.closes.length, data.closes.length);
			const goldSlice = goldData.closes.slice(-n);
			const assetSlice = data.closes.slice(-n);

			const corr = asset.key === 'gold' ? 1.0 : pearsonCorrelation(goldSlice, assetSlice);
			const fmtCorr = corr.toFixed(2);
			const corrDesc = asset.key === 'gold' ? '1.00 (self)' : `${fmtCorr} — ${corrLabel(corr)}`;

			const ret1d = periodReturn(data.closes, 1);
			const ret1w = periodReturn(data.closes, 5);
			const ret1m = periodReturn(data.closes, 21);
			const ret3m = periodReturn(data.closes, 63);

			const fmtRet = (r: number | null) => r !== null ? `${r >= 0 ? '+' : ''}${r.toFixed(1)}%` : 'N/A';

			tableRows.push([
				asset.label,
				fmtRet(ret1d),
				fmtRet(ret1w),
				fmtRet(ret1m),
				fmtRet(ret3m),
				corrDesc
			]);

			if (asset.key !== 'gold') {
				const direction = corrSignalForGold(asset.key, corr);
				metrics.push({
					label: `Gold / ${asset.label} Correlation`,
					value: fmtCorr,
					change: corrLabel(corr),
					direction
				});
				summaryParts.push(`Gold/${asset.label}: ${fmtCorr} (${corrLabel(corr)})`);
			} else {
				metrics.push({
					label: 'Gold (GC=F) — 3M Return',
					value: fmtRet(ret3m),
					change: fmtRet(ret1m) + ' (1M)',
					direction: ret3m !== null ? (ret3m > 0 ? 'up' : 'down') : 'neutral'
				});
			}
		}

		const result: ToolResult = {
			success: true,
			contentBlocks: [
				{
					type: 'metric_card',
					title: 'Cross-Asset Correlation (90-Day Pearson)',
					metrics
				},
				{
					type: 'table',
					title: 'Performance & Correlation vs Gold',
					headers: tableHeaders,
					rows: tableRows
				}
			],
			textSummary: `Cross-Asset Correlation (90D): ${summaryParts.join(', ')}. Note: Gold typically shows negative correlation with DXY and real yields.`
		};

		toolCache.set(cacheKey, result, 60 * 60_000); // cache 1hr
		return result;
	}
});
