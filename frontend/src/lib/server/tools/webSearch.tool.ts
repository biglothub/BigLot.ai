// Web Search Tool - search the web for news, analysis, and market events
import { registerTool, type ToolResult } from './registry';
import { toolCache } from '../cache.server';
import { env } from '$env/dynamic/private';

const TAVILY_BASE = 'https://api.tavily.com';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

type TavilyResult = {
	title: string;
	url: string;
	content: string;
	score: number;
	published_date?: string;
};

type TavilyResponse = {
	results: TavilyResult[];
	answer?: string;
	query: string;
};

registerTool({
	name: 'web_search',
	description:
		'Search the web for real-time news, market analysis, economic events, and any information not available through other tools. Use this when the user asks about news, events (FOMC, NFP, CPI), market sentiment from articles, or any question requiring up-to-date web information.',
	parameters: {
		type: 'object',
		properties: {
			query: {
				type: 'string',
				description:
					'Search query. Be specific for better results (e.g. "gold price FOMC impact March 2026" instead of just "gold news")'
			},
			search_type: {
				type: 'string',
				enum: ['news', 'general'],
				description: 'Type of search: "news" for recent news articles, "general" for broader web results (default: general)'
			},
			max_results: {
				type: 'number',
				description: 'Maximum number of results to return (default: 5, max: 10)'
			}
		},
		required: ['query']
	},
	timeout: 15_000,
	execute: async (args): Promise<ToolResult> => {
		const query = String(args.query || '').trim();
		const searchType = String(args.search_type || 'general');
		const maxResults = Math.min(Math.max(Number(args.max_results) || 5, 1), 10);

		if (!query) {
			return {
				success: false,
				contentBlocks: [{ type: 'error', message: 'Search query is required', tool: 'web_search' }],
				textSummary: 'Error: Search query is required'
			};
		}

		const apiKey = (env as Record<string, string | undefined>)['TAVILY_API_KEY'] ?? '';
		if (!apiKey.trim()) {
			return {
				success: false,
				contentBlocks: [{ type: 'error', message: 'Web search is not configured (missing TAVILY_API_KEY)', tool: 'web_search' }],
				textSummary: 'Error: Web search is not configured'
			};
		}

		const cacheKey = toolCache.generateKey('web_search', { query, searchType, maxResults });
		const cached = toolCache.get<ToolResult>(cacheKey);
		if (cached) return cached;

		try {
			const response = await fetch(`${TAVILY_BASE}/search`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					api_key: apiKey,
					query,
					search_depth: 'basic',
					topic: searchType === 'news' ? 'news' : 'general',
					max_results: maxResults,
					include_answer: true,
					include_raw_content: false
				})
			});

			if (!response.ok) {
				const errorText = await response.text().catch(() => 'Unknown error');
				return {
					success: false,
					contentBlocks: [{ type: 'error', message: `Web search failed: ${response.status} ${errorText}`, tool: 'web_search' }],
					textSummary: `Error: Web search failed (${response.status})`
				};
			}

			const data = (await response.json()) as TavilyResponse;
			const results = data.results || [];

			if (results.length === 0) {
				return {
					success: true,
					contentBlocks: [{ type: 'text', content: `No results found for "${query}".` }],
					textSummary: `No web results found for "${query}".`
				};
			}

			// Build news_list block for news searches, table for general
			if (searchType === 'news') {
				const result: ToolResult = {
					success: true,
					contentBlocks: [
						{
							type: 'news_list',
							items: results.map((r) => ({
								title: r.title,
								url: r.url,
								source: extractDomain(r.url),
								publishedAt: r.published_date || new Date().toISOString(),
								sentiment: undefined
							}))
						}
					],
					textSummary: buildTextSummary(query, results, data.answer),
					sources: results.map((r) => ({
						name: extractDomain(r.url),
						url: r.url,
						accessedAt: Date.now()
					}))
				};
				toolCache.set(cacheKey, result, CACHE_TTL);
				return result;
			}

			// General search: table with title + source + snippet
			const result: ToolResult = {
				success: true,
				contentBlocks: [
					{
						type: 'table',
						title: `Web Results: "${query}"`,
						headers: ['Title', 'Source', 'Snippet'],
						rows: results.map((r) => [
							r.title,
							extractDomain(r.url),
							truncate(r.content, 150)
						])
					}
				],
				textSummary: buildTextSummary(query, results, data.answer),
				sources: results.map((r) => ({
					name: extractDomain(r.url),
					url: r.url,
					accessedAt: Date.now()
				}))
			};
			toolCache.set(cacheKey, result, CACHE_TTL);
			return result;
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Web search failed';
			return {
				success: false,
				contentBlocks: [{ type: 'error', message, tool: 'web_search' }],
				textSummary: `Error: ${message}`
			};
		}
	}
});

function extractDomain(url: string): string {
	try {
		const hostname = new URL(url).hostname;
		return hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}

function truncate(text: string, maxLen: number): string {
	if (!text) return '';
	if (text.length <= maxLen) return text;
	return text.slice(0, maxLen).trimEnd() + '...';
}

function buildTextSummary(query: string, results: TavilyResult[], answer?: string): string {
	const lines: string[] = [];

	if (answer) {
		lines.push(`Summary for "${query}": ${answer}`);
		lines.push('');
	}

	lines.push(`Found ${results.length} results:`);
	for (const r of results) {
		lines.push(`- ${r.title} (${extractDomain(r.url)}): ${truncate(r.content, 200)}`);
	}

	return lines.join('\n');
}
