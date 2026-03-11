import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calcThaiGoldPrice, fetchGoldPriceData, fetchGoldOHLCV } from './gold.data';

describe('calcThaiGoldPrice', () => {
	it('calculates correctly for known values', () => {
		// Formula: (xauUsd * thbRate / 31.1035) * 15.244 * 0.965
		const result = calcThaiGoldPrice(2000, 35);
		const expected = (2000 * 35 / 31.1035) * 15.244 * 0.965;
		expect(result).toBeCloseTo(expected, 2);
	});

	it('returns 0 for zero gold price', () => {
		expect(calcThaiGoldPrice(0, 35)).toBe(0);
	});

	it('returns 0 for zero THB rate', () => {
		expect(calcThaiGoldPrice(2000, 0)).toBe(0);
	});

	it('produces reasonable Thai gold price for real-world values', () => {
		// Gold ~$2300, THB ~34.5 → Thai gold ~$38,000-42,000 per baht-weight
		const result = calcThaiGoldPrice(2300, 34.5);
		expect(result).toBeGreaterThan(30_000);
		expect(result).toBeLessThan(50_000);
	});
});

describe('fetchGoldPriceData', () => {
	const mockYahooResponse = {
		chart: {
			result: [{
				meta: {
					regularMarketPrice: 2350.5,
					previousClose: 2340.0,
					fiftyTwoWeekHigh: 2500.0,
					fiftyTwoWeekLow: 1800.0
				}
			}]
		}
	};

	const mockBinanceResponse = {
		lastPrice: '2348.50',
		priceChangePercent: '0.45'
	};

	const mockThbResponse = {
		chart: {
			result: [{ meta: { regularMarketPrice: 34.5 } }]
		}
	};

	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('returns full data when both Yahoo and Binance succeed', async () => {
		vi.stubGlobal('fetch', vi.fn((url: string) => {
			if (url.includes('GC=F')) {
				return Promise.resolve({ ok: true, json: () => Promise.resolve(mockYahooResponse) });
			}
			if (url.includes('binance.com')) {
				return Promise.resolve({ ok: true, json: () => Promise.resolve(mockBinanceResponse) });
			}
			if (url.includes('USDTHB')) {
				return Promise.resolve({ ok: true, json: () => Promise.resolve(mockThbResponse) });
			}
			return Promise.resolve({ ok: false });
		}));

		const data = await fetchGoldPriceData();
		expect(data).not.toBeNull();
		expect(data!.comexPrice).toBe(2350.5);
		expect(data!.binancePrice).toBe(2348.5);
		expect(data!.priceSource).toBe('comex');
		expect(data!.thaiGoldPrice).toBeGreaterThan(0);
		expect(data!.spotPrice).toBe(2350.5);
	});

	it('falls back to Binance when Yahoo fails', async () => {
		vi.stubGlobal('fetch', vi.fn((url: string) => {
			if (url.includes('GC=F')) {
				return Promise.resolve({ ok: false });
			}
			if (url.includes('binance.com')) {
				return Promise.resolve({ ok: true, json: () => Promise.resolve(mockBinanceResponse) });
			}
			if (url.includes('USDTHB')) {
				return Promise.resolve({ ok: true, json: () => Promise.resolve(mockThbResponse) });
			}
			return Promise.resolve({ ok: false });
		}));

		const data = await fetchGoldPriceData();
		expect(data).not.toBeNull();
		expect(data!.comexPrice).toBeNull();
		expect(data!.priceSource).toBe('binance');
		expect(data!.spotPrice).toBe(2348.5);
	});

	it('returns null when both sources fail', async () => {
		vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false })));
		const data = await fetchGoldPriceData();
		expect(data).toBeNull();
	});

	it('adds spread warning when COMEX/Binance differ by more than $5', async () => {
		const wideSpreadBinance = { lastPrice: '2360.00', priceChangePercent: '0.5' };
		vi.stubGlobal('fetch', vi.fn((url: string) => {
			if (url.includes('GC=F')) {
				return Promise.resolve({ ok: true, json: () => Promise.resolve(mockYahooResponse) });
			}
			if (url.includes('binance.com')) {
				return Promise.resolve({ ok: true, json: () => Promise.resolve(wideSpreadBinance) });
			}
			if (url.includes('USDTHB')) {
				return Promise.resolve({ ok: true, json: () => Promise.resolve(mockThbResponse) });
			}
			return Promise.resolve({ ok: false });
		}));

		const data = await fetchGoldPriceData();
		expect(data!.warnings.some(w => w.includes('spread'))).toBe(true);
	});
});

describe('fetchGoldOHLCV', () => {
	const mockOHLCVResponse = {
		chart: {
			result: [{
				timestamp: [1700000000, 1700100000, 1700200000],
				indicators: {
					quote: [{
						open: [2300, 2310, 2305],
						high: [2320, 2325, 2315],
						low: [2295, 2300, 2290],
						close: [2310, 2305, 2295],
						volume: [1000, 1200, 900]
					}]
				}
			}]
		}
	};

	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('returns OHLCV array for valid response', async () => {
		vi.stubGlobal('fetch', vi.fn(() =>
			Promise.resolve({ ok: true, json: () => Promise.resolve(mockOHLCVResponse) })
		));

		const result = await fetchGoldOHLCV('1mo');
		expect(result).not.toBeNull();
		expect(result!.ohlcv).toHaveLength(3);
		expect(result!.ohlcv[0]).toMatchObject({
			time: 1700000000,
			open: 2300,
			high: 2320,
			low: 2295,
			close: 2310,
			volume: 1000
		});
		expect(result!.timeframe).toBe('1mo');
	});

	it('returns null when fetch fails', async () => {
		vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false })));
		const result = await fetchGoldOHLCV('1mo');
		expect(result).toBeNull();
	});

	it('falls back to 1mo for invalid timeframe', async () => {
		vi.stubGlobal('fetch', vi.fn(() =>
			Promise.resolve({ ok: true, json: () => Promise.resolve(mockOHLCVResponse) })
		));

		const result = await fetchGoldOHLCV('invalid');
		expect(result!.timeframe).toBe('1mo');
	});

	it('filters out null closes', async () => {
		const responseWithNulls = {
			chart: {
				result: [{
					timestamp: [1700000000, 1700100000, 1700200000],
					indicators: {
						quote: [{
							open: [2300, null, 2305],
							high: [2320, null, 2315],
							low: [2295, null, 2290],
							close: [2310, null, 2295],
							volume: [1000, 0, 900]
						}]
					}
				}]
			}
		};

		vi.stubGlobal('fetch', vi.fn(() =>
			Promise.resolve({ ok: true, json: () => Promise.resolve(responseWithNulls) })
		));

		const result = await fetchGoldOHLCV('1mo');
		expect(result!.ohlcv).toHaveLength(2);
	});

	it('returns null for empty OHLCV result', async () => {
		const emptyResponse = {
			chart: {
				result: [{
					timestamp: [],
					indicators: { quote: [{ open: [], high: [], low: [], close: [], volume: [] }] }
				}]
			}
		};

		vi.stubGlobal('fetch', vi.fn(() =>
			Promise.resolve({ ok: true, json: () => Promise.resolve(emptyResponse) })
		));

		const result = await fetchGoldOHLCV('1mo');
		expect(result).toBeNull();
	});
});

describe('data/validation', () => {
	// Import validation separately since it's a dependency
	it('validates gold price range', async () => {
		const { validateRange } = await import('./validation');

		// In range
		expect(validateRange('gold', 2000)).toBeNull();
		// Out of range
		expect(validateRange('gold', 100)).toContain('out of range');
		expect(validateRange('gold', 15000)).toContain('out of range');
		// Boundary
		expect(validateRange('gold', 500)).toBeNull();
		expect(validateRange('gold', 10000)).toBeNull();
		// Unknown key
		expect(validateRange('unknown', 100)).toBeNull();
		// Null value
		expect(validateRange('gold', null as any)).toBeNull();
	});

	it('validates THB rate range', async () => {
		const { validateRange } = await import('./validation');
		expect(validateRange('thb', 35)).toBeNull();
		expect(validateRange('thb', 10)).toContain('out of range');
	});

	it('validates DXY range', async () => {
		const { validateRange } = await import('./validation');
		expect(validateRange('dxy', 100)).toBeNull();
		expect(validateRange('dxy', 50)).toContain('out of range');
	});
});
