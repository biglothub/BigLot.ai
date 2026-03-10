// COT (Commitments of Traders) Tool — get_cot_data
// Source: CFTC Socrata API (free, no key required)
import { registerTool, type ToolResult } from './registry';
import { toolCache } from '../cache.server';
import { fetchCotData } from '../data/cot.data';

registerTool({
	name: 'get_cot_data',
	description:
		'Get CFTC Commitments of Traders (COT) data for Gold futures. Shows institutional/speculator positioning — net long/short positions and week-over-week changes. Use when user asks about COT, institutional positioning, smart money, or speculator sentiment for gold.',
	parameters: {
		type: 'object',
		properties: {},
		required: []
	},
	timeout: 25_000,
	execute: async (): Promise<ToolResult> => {
		const cacheKey = toolCache.generateKey('get_cot_data', {});
		const cached = toolCache.get<ToolResult>(cacheKey);
		if (cached) return cached;

		const cot = await fetchCotData();
		if (!cot) {
			return {
				success: false,
				contentBlocks: [{ type: 'error', message: 'Failed to fetch COT data from CFTC.', tool: 'get_cot_data' }],
				textSummary: 'Error: Could not fetch COT data.'
			};
		}

		const fmtK = (n: number) => {
			const sign = n >= 0 ? '+' : '';
			return `${sign}${(n / 1000).toFixed(1)}K`;
		};

		const result: ToolResult = {
			success: true,
			contentBlocks: [{
				type: 'metric_card',
				title: `Gold COT Data — Report Date: ${cot.reportDate}`,
				metrics: [
					{
						label: 'Net Speculator Position',
						value: fmtK(cot.netSpec),
						change: cot.classification,
						direction: cot.netSpec > 0 ? 'up' : 'down'
					},
					{
						label: 'WoW Change (Spec Net)',
						value: fmtK(cot.wowChange),
						direction: cot.wowChange > 0 ? 'up' : cot.wowChange < 0 ? 'down' : 'neutral'
					},
					{
						label: 'Spec Longs',
						value: fmtK(cot.specLong),
						direction: 'up'
					},
					{
						label: 'Spec Shorts',
						value: fmtK(cot.specShort),
						direction: 'down'
					},
					{
						label: 'Commercial Net',
						value: fmtK(cot.netComm),
						change: 'Hedgers (inverse signal)',
						direction: cot.netComm < 0 ? 'up' : 'down'
					},
					{
						label: 'Signal (Contrarian)',
						value: cot.classification,
						direction: cot.signal
					}
				]
			}],
			textSummary: `Gold COT (${cot.reportDate}): Net Spec ${fmtK(cot.netSpec)} (${cot.classification}), WoW ${fmtK(cot.wowChange)}, Commercial Net ${fmtK(cot.netComm)}. Contrarian signal: ${cot.signal === 'up' ? 'Bullish' : cot.signal === 'down' ? 'Bearish' : 'Neutral'}.`,
			sources: [{ name: 'CFTC Commitments of Traders', url: 'https://www.cftc.gov/MarketReports/CommitmentsofTraders', accessedAt: Date.now() }]
		};

		toolCache.set(cacheKey, result, 24 * 3_600_000);
		return result;
	}
});
