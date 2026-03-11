// Web Crawl Tool - crawl a website to explore multiple pages using Tavily Crawl API
import { registerTool, type ToolResult } from './registry';
import { toolCache } from '../cache.server';
import { env } from '$env/dynamic/private';

const TAVILY_BASE = 'https://api.tavily.com';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CONTENT_PER_PAGE = 1500; // chars per page in textSummary

type TavilyCrawlResult = {
	url: string;
	raw_content: string;
	favicon?: string;
};

type TavilyCrawlResponse = {
	base_url: string;
	results: TavilyCrawlResult[];
	response_time: number;
};

registerTool({
	name: 'web_crawl',
	description:
		'Crawl a website to explore multiple pages systematically. Use for research across a site (e.g., central bank policy docs, financial data portals, company investor relations). Returns content from multiple pages. Provide instructions for intelligent crawling.',
	parameters: {
		type: 'object',
		properties: {
			url: {
				type: 'string',
				description: 'Starting URL to crawl (e.g., "https://www.federalreserve.gov/monetarypolicy")'
			},
			instructions: {
				type: 'string',
				description:
					'Natural language guidance for the crawler (e.g., "Find pages about interest rate decisions and monetary policy statements"). Improves crawl relevance but costs 2x credits.'
			},
			max_depth: {
				type: 'number',
				description: 'How deep to crawl from the starting URL (1-3, default: 1). Higher = explores more link levels.'
			},
			max_breadth: {
				type: 'number',
				description: 'Links to follow per page level (1-20, default: 10). Higher = explores more pages per level.'
			},
			limit: {
				type: 'number',
				description: 'Total pages to process before stopping (1-20, default: 10).'
			}
		},
		required: ['url']
	},
	timeout: 60_000,
	execute: async (args): Promise<ToolResult> => {
		const url = String(args.url || '').trim();
		const instructions = args.instructions ? String(args.instructions).trim() : undefined;
		const maxDepth = Math.min(Math.max(Number(args.max_depth) || 1, 1), 3);
		const maxBreadth = Math.min(Math.max(Number(args.max_breadth) || 10, 1), 20);
		const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 20);

		if (!url) {
			return {
				success: false,
				contentBlocks: [{ type: 'error', message: 'URL is required', tool: 'web_crawl' }],
				textSummary: 'Error: URL is required'
			};
		}

		const apiKey = (env as Record<string, string | undefined>)['TAVILY_API_KEY'] ?? '';
		if (!apiKey.trim()) {
			return {
				success: false,
				contentBlocks: [
					{ type: 'error', message: 'Web crawl is not configured (missing TAVILY_API_KEY)', tool: 'web_crawl' }
				],
				textSummary: 'Error: Web crawl is not configured'
			};
		}

		const cacheKey = toolCache.generateKey('web_crawl', { url, instructions, maxDepth, maxBreadth, limit });
		const cached = toolCache.get<ToolResult>(cacheKey);
		if (cached) return cached;

		try {
			const response = await fetch(`${TAVILY_BASE}/crawl`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					api_key: apiKey,
					url,
					...(instructions ? { instructions } : {}),
					max_depth: maxDepth,
					max_breadth: maxBreadth,
					limit,
					format: 'markdown',
					extract_depth: 'basic',
					include_images: false,
					timeout: 60
				})
			});

			if (!response.ok) {
				const errorText = await response.text().catch(() => 'Unknown error');
				return {
					success: false,
					contentBlocks: [
						{ type: 'error', message: `Web crawl failed: ${response.status} ${errorText}`, tool: 'web_crawl' }
					],
					textSummary: `Error: Web crawl failed (${response.status})`
				};
			}

			const data = (await response.json()) as TavilyCrawlResponse;
			const results = data.results || [];

			if (results.length === 0) {
				return {
					success: true,
					contentBlocks: [{ type: 'text', content: `No pages found when crawling ${url}.` }],
					textSummary: `No pages found when crawling ${url}.`
				};
			}

			// Table block summarizing crawled pages
			const tableRows = results.map((r) => [
				extractDomain(r.url),
				truncate(r.raw_content, 120),
				r.url
			]);

			// Text summary with full content for LLM
			const summaryLines: string[] = [`Crawled ${results.length} page(s) from ${data.base_url}:\n`];
			for (const r of results) {
				summaryLines.push(`\n=== ${r.url} ===`);
				summaryLines.push(truncate(r.raw_content, MAX_CONTENT_PER_PAGE));
			}

			const result: ToolResult = {
				success: true,
				contentBlocks: [
					{
						type: 'table',
						title: `Crawl Results: ${extractDomain(url)} (${results.length} pages)`,
						headers: ['Source', 'Preview', 'URL'],
						rows: tableRows
					}
				],
				textSummary: summaryLines.join('\n'),
				sources: results.map((r) => ({
					name: extractDomain(r.url),
					url: r.url,
					accessedAt: Date.now()
				}))
			};

			toolCache.set(cacheKey, result, CACHE_TTL);
			return result;
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Web crawl failed';
			return {
				success: false,
				contentBlocks: [{ type: 'error', message, tool: 'web_crawl' }],
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
