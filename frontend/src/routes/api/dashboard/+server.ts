// Dashboard API — aggregated gold + macro + COT data
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchGoldPriceData, fetchGoldOHLCV } from '$lib/server/data/gold.data';
import { fetchMacroData } from '$lib/server/data/macro.data';
import { fetchCotData } from '$lib/server/data/cot.data';
import type { DashboardMeta, SourceMeta, ErrorKind } from '$lib/types/dashboardMeta';

let cachedResult: { data: any; ts: number } | null = null;
const CACHE_TTL = 30_000; // 30s

const COT_STALE_MS = 8 * 24 * 3_600_000;  // 8 days (reports are weekly)
const MACRO_STALE_MS = 6 * 3_600_000;      // 6 hours
const GOLD_STALE_MS = 5 * 60_000;          // 5 minutes
const CHART_STALE_MS = 30 * 60_000;        // 30 minutes

function buildSourceMeta(
	source: string,
	result: PromiseSettledResult<any>,
	staleAfterMs: number
): SourceMeta {
	const now = new Date().toISOString();
	if (result.status === 'rejected') {
		return { source, fetchedAt: now, staleAfterMs, isStale: false, errorKind: 'network', errorMessage: String(result.reason) };
	}
	if (result.value === null) {
		return { source, fetchedAt: now, staleAfterMs, isStale: false, errorKind: 'parse', errorMessage: `${source} returned null` };
	}
	return { source, fetchedAt: now, staleAfterMs, isStale: false, errorKind: 'none' };
}

export const GET: RequestHandler = async () => {
	if (cachedResult && Date.now() - cachedResult.ts < CACHE_TTL) {
		return json(cachedResult.data);
	}

	const [goldResult, macroResult, cotResult, chartResult] = await Promise.allSettled([
		fetchGoldPriceData(),
		fetchMacroData(),
		fetchCotData(),
		fetchGoldOHLCV('1mo')
	]);

	const gold = goldResult.status === 'fulfilled' ? goldResult.value : null;
	const macro = macroResult.status === 'fulfilled' ? macroResult.value : null;
	const cot = cotResult.status === 'fulfilled' ? cotResult.value : null;
	const chart = chartResult.status === 'fulfilled' ? chartResult.value : null;

	// Build source metadata
	const sources: SourceMeta[] = [
		buildSourceMeta('gold', goldResult, GOLD_STALE_MS),
		buildSourceMeta('macro', macroResult, MACRO_STALE_MS),
		buildSourceMeta('cot', cotResult, COT_STALE_MS),
		buildSourceMeta('chart', chartResult, CHART_STALE_MS)
	];

	// COT-specific staleness check
	if (cot && cot.reportAgeMs > COT_STALE_MS) {
		const cotSource = sources.find(s => s.source === 'cot')!;
		cotSource.isStale = true;
		cotSource.errorKind = 'stale';
		cotSource.errorMessage = `COT report is ${Math.floor(cot.reportAgeMs / 86_400_000)}d old`;
	}

	// Aggregate warnings from sub-fetchers + stale sources
	const warnings: string[] = [
		...(gold?.warnings ?? []),
		...(macro?.warnings ?? []),
		...sources.filter(s => s.errorKind === 'stale').map(s => s.errorMessage!)
	];

	const _meta: DashboardMeta = { sources, warnings };

	const data = {
		gold, macro, cot, chart,
		updatedAt: new Date().toISOString(),
		_meta
	};

	cachedResult = { data, ts: Date.now() };
	return json(data);
};
