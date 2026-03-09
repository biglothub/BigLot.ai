// COT (Commitments of Traders) Tool — get_cot_data
// Source: CFTC Socrata API (free, no key required)
import { registerTool, type ToolResult } from './registry';
import { toolCache } from '../cache.server';

// CFTC Socrata API — Gold futures COT data (contract market code 088691 = 100oz Gold on CMX)
const CFTC_URL =
	"https://publicreporting.cftc.gov/resource/6dca-aqww.json?$limit=2&$order=report_date_as_yyyy_mm_dd+DESC&$where=cftc_contract_market_code='088691'";

function classifyNetPosition(net: number, maxNet = 250_000): string {
	const pct = net / maxNet;
	if (pct > 0.6) return 'Extreme Long';
	if (pct > 0.3) return 'Long';
	if (pct > -0.3) return 'Neutral';
	if (pct > -0.6) return 'Short';
	return 'Extreme Short';
}

function positionSignal(classification: string): 'up' | 'down' | 'neutral' {
	if (classification === 'Extreme Long') return 'down'; // contrarian: crowded longs = risk
	if (classification === 'Long') return 'up';
	if (classification === 'Short' || classification === 'Extreme Short') return 'up'; // contrarian bullish
	return 'neutral';
}

registerTool({
	name: 'get_cot_data',
	description:
		'Get CFTC Commitments of Traders (COT) data for Gold futures. Shows institutional/speculator positioning — net long/short positions and week-over-week changes. Use when user asks about COT, institutional positioning, smart money, or speculator sentiment for gold.',
	parameters: {
		type: 'object',
		properties: {},
		required: []
	},
	timeout: 25_000, // CFTC server can be slow
	execute: async (): Promise<ToolResult> => {
		const cacheKey = toolCache.generateKey('get_cot_data', {});
		const cached = toolCache.get<ToolResult>(cacheKey);
		if (cached) return cached;

		let rows: any[];
		try {
			const res = await fetch(CFTC_URL, {
				headers: { Accept: 'application/json' }
			});
			if (!res.ok) {
				return {
					success: false,
					contentBlocks: [{ type: 'error', message: `CFTC API returned HTTP ${res.status}`, tool: 'get_cot_data' }],
					textSummary: 'Error: Could not fetch COT data from CFTC.'
				};
			}
			rows = await res.json();
		} catch (e) {
			return {
				success: false,
				contentBlocks: [{ type: 'error', message: 'Failed to connect to CFTC API.', tool: 'get_cot_data' }],
				textSummary: 'Error: CFTC API connection failed.'
			};
		}

		if (!rows || rows.length === 0) {
			return {
				success: false,
				contentBlocks: [{ type: 'error', message: 'No COT data returned from CFTC.', tool: 'get_cot_data' }],
				textSummary: 'Error: No COT data available.'
			};
		}

		const current = rows[0];
		const previous = rows[1] ?? null;

		const specLong = parseInt(current.noncomm_positions_long_all ?? '0', 10);
		const specShort = parseInt(current.noncomm_positions_short_all ?? '0', 10);
		const commLong = parseInt(current.comm_positions_long_all ?? '0', 10);
		const commShort = parseInt(current.comm_positions_short_all ?? '0', 10);
		const reportDate = current.report_date_as_yyyy_mm_dd ?? 'N/A';

		const netSpec = specLong - specShort;
		const netComm = commLong - commShort;

		let wowChange = 0;
		if (previous) {
			const prevSpecLong = parseInt(previous.noncomm_positions_long_all ?? '0', 10);
			const prevSpecShort = parseInt(previous.noncomm_positions_short_all ?? '0', 10);
			const prevNetSpec = prevSpecLong - prevSpecShort;
			wowChange = netSpec - prevNetSpec;
		}

		const classification = classifyNetPosition(netSpec);
		const signal = positionSignal(classification);

		const fmtK = (n: number) => {
			const sign = n >= 0 ? '+' : '';
			return `${sign}${(n / 1000).toFixed(1)}K`;
		};

		const result: ToolResult = {
			success: true,
			contentBlocks: [{
				type: 'metric_card',
				title: `Gold COT Data — Report Date: ${reportDate}`,
				metrics: [
					{
						label: 'Net Speculator Position',
						value: fmtK(netSpec),
						change: classification,
						direction: netSpec > 0 ? 'up' : 'down'
					},
					{
						label: 'WoW Change (Spec Net)',
						value: fmtK(wowChange),
						direction: wowChange > 0 ? 'up' : wowChange < 0 ? 'down' : 'neutral'
					},
					{
						label: 'Spec Longs',
						value: fmtK(specLong),
						direction: 'up'
					},
					{
						label: 'Spec Shorts',
						value: fmtK(specShort),
						direction: 'down'
					},
					{
						label: 'Commercial Net',
						value: fmtK(netComm),
						change: 'Hedgers (inverse signal)',
						direction: netComm < 0 ? 'up' : 'down' // commercials short = production hedge, bearish when net long
					},
					{
						label: 'Signal (Contrarian)',
						value: classification,
						direction: signal
					}
				]
			}],
			textSummary: `Gold COT (${reportDate}): Net Spec ${fmtK(netSpec)} (${classification}), WoW ${fmtK(wowChange)}, Commercial Net ${fmtK(netComm)}. Contrarian signal: ${signal === 'up' ? 'Bullish' : signal === 'down' ? 'Bearish' : 'Neutral'}.`
		};

		// COT data is released weekly (Fridays), cache 24hr
		toolCache.set(cacheKey, result, 24 * 3_600_000);
		return result;
	}
});
