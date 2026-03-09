interface RangeSpec {
	min: number;
	max: number;
	label: string;
}

const RANGES: Record<string, RangeSpec> = {
	gold: { min: 500, max: 10_000, label: 'Gold (USD/oz)' },
	dxy: { min: 70, max: 130, label: 'DXY Index' },
	tnx: { min: 0, max: 20, label: '10Y Yield (%)' },
	thb: { min: 25, max: 50, label: 'USD/THB' },
	spx: { min: 1_000, max: 15_000, label: 'S&P 500' },
	realYield: { min: -5, max: 10, label: 'Real Yield (%)' }
};

export function validateRange(key: string, value: number | null): string | null {
	if (value === null || value === undefined) return null;
	const spec = RANGES[key];
	if (!spec) return null;
	if (value < spec.min || value > spec.max)
		return `${spec.label} out of range: ${value} (expected ${spec.min}–${spec.max})`;
	return null;
}
