// Market Data Tools - get_market_data, get_fear_greed_index
import { registerTool, type ToolResult } from './registry';
import { toolCache } from '../cache.server';
import { isForexOrCommodity, fetchYahooMarketData } from './yahooFinance';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

// Common crypto symbol -> CoinGecko ID mapping
const SYMBOL_TO_ID: Record<string, string> = {
	btc: 'bitcoin',
	bitcoin: 'bitcoin',
	eth: 'ethereum',
	ethereum: 'ethereum',
	bnb: 'binancecoin',
	sol: 'solana',
	xrp: 'ripple',
	ada: 'cardano',
	doge: 'dogecoin',
	dot: 'polkadot',
	avax: 'avalanche-2',
	matic: 'matic-network',
	polygon: 'matic-network',
	link: 'chainlink',
	uni: 'uniswap',
	atom: 'cosmos',
	ltc: 'litecoin',
	near: 'near',
	apt: 'aptos',
	arb: 'arbitrum',
	op: 'optimism',
	sui: 'sui',
	sei: 'sei-network',
	ton: 'the-open-network',
	pepe: 'pepe',
	shib: 'shiba-inu',
	wif: 'dogwifcoin',
	bonk: 'bonk',
	jup: 'jupiter-exchange-solana',
	render: 'render-token',
	fet: 'artificial-superintelligence-alliance',
	inj: 'injective-protocol',
	tia: 'celestia',
	stx: 'blockstack',
	kas: 'kaspa'
};

function resolveSymbol(input: string): string {
	const cleaned = input.toLowerCase().replace(/usdt?$/, '').replace(/\/.*$/, '').trim();
	return SYMBOL_TO_ID[cleaned] || cleaned;
}

registerTool({
	name: 'get_market_data',
	description:
		'Get real-time price, 24h price change, 24h volume, and market cap for any cryptocurrency, forex pair, or commodity. Use this when the user asks about current prices or market data. Supports crypto (BTC, ETH, SOL), forex (EURUSD, GBPJPY), and commodities (XAUUSD for Gold, XAGUSD for Silver).',
	parameters: {
		type: 'object',
		properties: {
			symbol: {
				type: 'string',
				description:
					'Symbol or name (e.g. BTC, ETH, SOL, XAUUSD, EURUSD, XAGUSD, bitcoin, ethereum)'
			},
			vs_currency: {
				type: 'string',
				description: 'Quote currency (default: usd)',
				enum: ['usd', 'eur', 'thb', 'jpy', 'gbp', 'btc', 'eth']
			}
		},
		required: ['symbol']
	},
	timeout: 15_000,
	execute: async (args): Promise<ToolResult> => {
		const symbol = String(args.symbol || '');
		const vsCurrency = String(args.vs_currency || 'usd');

		// --- Forex / Commodity fallback via Yahoo Finance ---
		if (isForexOrCommodity(symbol)) {
			const cacheKey = toolCache.generateKey('get_market_data_forex', { symbol });
			const cached = toolCache.get<ToolResult>(cacheKey);
			if (cached) return cached;

			const yahooResult = await fetchYahooMarketData(symbol);
			if ('error' in yahooResult) {
				return {
					success: false,
					contentBlocks: [{ type: 'error', message: yahooResult.error, tool: 'get_market_data' }],
					textSummary: `Error: ${yahooResult.error}`
				};
			}

			const { name, price, change24h, volume, high24h, low24h, previousClose } = yahooResult;
			const sym = symbol.toUpperCase().replace(/[^A-Z]/g, '');

			const formatNum = (n: number) => {
				if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
				if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
				if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
				return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
			};

			const direction = change24h > 0 ? 'up' : change24h < 0 ? 'down' : 'neutral';
			const changeStr = `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`;

			const result: ToolResult = {
				success: true,
				contentBlocks: [
					{
						type: 'metric_card',
						title: `${name} (${sym})`,
						metrics: [
							{ label: 'Price', value: `$${formatNum(price)}`, change: changeStr, direction: direction as 'up' | 'down' | 'neutral' },
							{ label: '24h High', value: `$${formatNum(high24h)}`, direction: 'neutral' },
							{ label: '24h Low', value: `$${formatNum(low24h)}`, direction: 'neutral' },
							{ label: 'Prev Close', value: `$${formatNum(previousClose)}`, direction: 'neutral' },
							...(volume > 0 ? [{ label: 'Volume', value: formatNum(volume), direction: 'neutral' as const }] : [])
						]
					}
				],
				textSummary: `${name} (${sym}): Price $${formatNum(price)} (${changeStr} 24h), 24h Range $${formatNum(low24h)} - $${formatNum(high24h)}, Prev Close $${formatNum(previousClose)}`
			};

			toolCache.set(cacheKey, result, 60_000);
			return result;
		}

		// --- Crypto via CoinGecko ---
		const coinId = resolveSymbol(symbol);

		const cacheKey = toolCache.generateKey('get_market_data', { coinId, vsCurrency });
		const cached = toolCache.get<ToolResult>(cacheKey);
		if (cached) return cached;

		const url = `${COINGECKO_BASE}/coins/${encodeURIComponent(coinId)}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`;

		const response = await fetch(url, {
			headers: { Accept: 'application/json' }
		});

		if (!response.ok) {
			// Try search if direct ID fails
			const searchUrl = `${COINGECKO_BASE}/search?query=${encodeURIComponent(symbol)}`;
			const searchRes = await fetch(searchUrl);
			if (searchRes.ok) {
				const searchData = await searchRes.json();
				const firstCoin = searchData?.coins?.[0];
				if (firstCoin?.id) {
					const retryUrl = `${COINGECKO_BASE}/coins/${firstCoin.id}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`;
					const retryRes = await fetch(retryUrl);
					if (retryRes.ok) {
						return processMarketResponse(await retryRes.json(), vsCurrency, cacheKey);
					}
				}
			}
			return {
				success: false,
				contentBlocks: [
					{
						type: 'error',
						message: `Could not find market data for "${symbol}". Try using the full name (e.g., "bitcoin" instead of "BTC").`,
						tool: 'get_market_data'
					}
				],
				textSummary: `Error: Could not find market data for "${symbol}".`
			};
		}

		const data = await response.json();
		return processMarketResponse(data, vsCurrency, cacheKey);
	}
});

function processMarketResponse(
	data: Record<string, unknown>,
	vsCurrency: string,
	cacheKey: string
): ToolResult {
	const md = data.market_data as Record<string, Record<string, number>> | undefined;
	if (!md) {
		return {
			success: false,
			contentBlocks: [
				{ type: 'error', message: 'No market data available', tool: 'get_market_data' }
			],
			textSummary: 'No market data available.'
		};
	}

	const price = md.current_price?.[vsCurrency] ?? 0;
	const change24h = md.price_change_percentage_24h_in_currency?.[vsCurrency] ?? (md as any).price_change_percentage_24h ?? 0;
	const volume = md.total_volume?.[vsCurrency] ?? 0;
	const marketCap = md.market_cap?.[vsCurrency] ?? 0;
	const high24h = md.high_24h?.[vsCurrency] ?? 0;
	const low24h = md.low_24h?.[vsCurrency] ?? 0;
	const ath = md.ath?.[vsCurrency] ?? 0;
	const athChange = md.ath_change_percentage?.[vsCurrency] ?? 0;

	const name = (data.name as string) || 'Unknown';
	const sym = ((data.symbol as string) || '').toUpperCase();
	const currSym = vsCurrency.toUpperCase();

	const formatNum = (n: number) => {
		if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
		if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
		if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
		return n.toLocaleString('en-US', { maximumFractionDigits: 8 });
	};

	const direction = change24h > 0 ? 'up' : change24h < 0 ? 'down' : 'neutral';
	const changeStr = `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`;

	const result: ToolResult = {
		success: true,
		contentBlocks: [
			{
				type: 'metric_card',
				title: `${name} (${sym})`,
				metrics: [
					{
						label: 'Price',
						value: `$${formatNum(price)}`,
						change: changeStr,
						direction: direction as 'up' | 'down' | 'neutral'
					},
					{ label: '24h Volume', value: `$${formatNum(volume)}`, direction: 'neutral' },
					{ label: 'Market Cap', value: `$${formatNum(marketCap)}`, direction: 'neutral' },
					{ label: '24h High', value: `$${formatNum(high24h)}`, direction: 'neutral' },
					{ label: '24h Low', value: `$${formatNum(low24h)}`, direction: 'neutral' },
					{
						label: 'ATH',
						value: `$${formatNum(ath)}`,
						change: `${athChange.toFixed(1)}%`,
						direction: 'down'
					}
				]
			}
		],
		textSummary: `${name} (${sym}): Price $${formatNum(price)} ${currSym} (${changeStr} 24h), Volume $${formatNum(volume)}, Market Cap $${formatNum(marketCap)}, 24h Range $${formatNum(low24h)} - $${formatNum(high24h)}, ATH $${formatNum(ath)} (${athChange.toFixed(1)}% from ATH)`
	};

	toolCache.set(cacheKey, result, 60_000); // cache 60s
	return result;
}

// --- Fear & Greed Index ---

registerTool({
	name: 'get_fear_greed_index',
	description:
		'Get the current Crypto Fear & Greed Index. Shows whether the market sentiment is in extreme fear, fear, neutral, greed, or extreme greed. Use when users ask about market sentiment or fear and greed.',
	parameters: {
		type: 'object',
		properties: {
			limit: {
				type: 'number',
				description: 'Number of days of data to return (default: 1, max: 30)'
			}
		}
	},
	timeout: 10_000,
	execute: async (args): Promise<ToolResult> => {
		const limit = Math.min(Math.max(Number(args.limit) || 1, 1), 30);

		const cacheKey = toolCache.generateKey('get_fear_greed_index', { limit });
		const cached = toolCache.get<ToolResult>(cacheKey);
		if (cached) return cached;

		const url = `https://api.alternative.me/fng/?limit=${limit}&format=json`;
		const response = await fetch(url);

		if (!response.ok) {
			return {
				success: false,
				contentBlocks: [
					{
						type: 'error',
						message: 'Failed to fetch Fear & Greed Index',
						tool: 'get_fear_greed_index'
					}
				],
				textSummary: 'Error: Failed to fetch Fear & Greed Index.'
			};
		}

		const data = await response.json();
		const entries = data?.data as { value: string; value_classification: string; timestamp: string }[];

		if (!entries?.length) {
			return {
				success: false,
				contentBlocks: [
					{ type: 'error', message: 'No Fear & Greed data available', tool: 'get_fear_greed_index' }
				],
				textSummary: 'No Fear & Greed data available.'
			};
		}

		const current = entries[0];
		const value = parseInt(current.value, 10);
		const classification = current.value_classification;

		const direction: 'up' | 'down' | 'neutral' =
			value >= 55 ? 'up' : value <= 45 ? 'down' : 'neutral';

		const result: ToolResult = {
			success: true,
			contentBlocks: [
				{
					type: 'metric_card',
					title: 'Crypto Fear & Greed Index',
					metrics: [
						{
							label: 'Current Index',
							value: `${value}/100`,
							change: classification,
							direction
						},
						...(entries.length > 1
							? [
									{
										label: 'Yesterday',
										value: `${entries[1].value}/100`,
										change: entries[1].value_classification,
										direction: (parseInt(entries[1].value, 10) >= 55
											? 'up'
											: parseInt(entries[1].value, 10) <= 45
												? 'down'
												: 'neutral') as 'up' | 'down' | 'neutral'
									}
								]
							: [])
					]
				}
			],
			textSummary: `Crypto Fear & Greed Index: ${value}/100 (${classification})${entries.length > 1 ? `, Yesterday: ${entries[1].value}/100 (${entries[1].value_classification})` : ''}`
		};

		toolCache.set(cacheKey, result, 10 * 60 * 1000); // cache 10 minutes
		return result;
	}
});
