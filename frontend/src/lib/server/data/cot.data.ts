// Shared COT Data Layer — reused by cot.tool.ts + dashboard API

const CFTC_URL =
	"https://publicreporting.cftc.gov/resource/6dca-aqww.json?$limit=2&$order=report_date_as_yyyy_mm_dd+DESC&$where=cftc_contract_market_code='088691'";

export function classifyNetPosition(net: number, maxNet = 250_000): string {
	const pct = net / maxNet;
	if (pct > 0.6) return 'Extreme Long';
	if (pct > 0.3) return 'Long';
	if (pct > -0.3) return 'Neutral';
	if (pct > -0.6) return 'Short';
	return 'Extreme Short';
}

export function positionSignal(classification: string): 'up' | 'down' | 'neutral' {
	if (classification === 'Extreme Long') return 'down';
	if (classification === 'Long') return 'up';
	if (classification === 'Short' || classification === 'Extreme Short') return 'up';
	return 'neutral';
}

export interface CotData {
	reportDate: string;
	specLong: number;
	specShort: number;
	commLong: number;
	commShort: number;
	netSpec: number;
	netComm: number;
	wowChange: number;
	classification: string;
	signal: 'up' | 'down' | 'neutral';
	reportAgeMs: number;
}

export async function fetchCotData(): Promise<CotData | null> {
	try {
		const res = await fetch(CFTC_URL, { headers: { Accept: 'application/json' } });
		if (!res.ok) return null;
		const rows = await res.json() as any[];
		if (!rows || rows.length === 0) return null;

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
			const prevNetSpec = parseInt(previous.noncomm_positions_long_all ?? '0', 10)
				- parseInt(previous.noncomm_positions_short_all ?? '0', 10);
			wowChange = netSpec - prevNetSpec;
		}

		const classification = classifyNetPosition(netSpec);
		const signal = positionSignal(classification);
		const reportDateMs = new Date(reportDate).getTime();
		const reportAgeMs = isNaN(reportDateMs) ? Infinity : Date.now() - reportDateMs;

		return { reportDate, specLong, specShort, commLong, commShort, netSpec, netComm, wowChange, classification, signal, reportAgeMs };
	} catch {
		return null;
	}
}
