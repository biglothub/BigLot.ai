// Web Extract Tool - extract full content from specific URLs using Tavily Extract API
import { registerTool, type ToolResult } from './registry';
import { toolCache } from '../cache.server';
import { env } from '$env/dynamic/private';

const TAVILY_BASE = 'https://api.tavily.com';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CONTENT_PER_SOURCE = 3000; // chars per source in textSummary

type TavilyExtractResult = {
	url: string;
	raw_content: string;
	images?: string[];
};

type TavilyExtractResponse = {
	results: TavilyExtractResult[];
	failed_results?: { url: string; error: string }[];
	response_time: number;
};

registerTool({
	name: 'web_extract',
	description:
		'Extract full content from specific URLs. Use after web_search to read the full text of the most relevant articles for deeper analysis. Supports up to 5 URLs at once. Returns full article content in markdown format.',
	parameters: {
		type: 'object',
		properties: {
			urls: {
				type: 'array',
				items: { type: 'string' },
				description: 'URLs to extract content from (max 5). Pass the URLs from web_search results.'
			},
			query: {
				type: 'string',
				description:
					'Research question to rerank extracted content by relevance. Provide your research question for better chunk ordering.'
			},
			extract_depth: {
				type: 'string',
				enum: ['basic', 'advanced'],
				description:
					'Extraction depth: "basic" (standard content) or "advanced" (includes tables and embedded content, higher success rate). Default: basic.'
			}
		},
		required: ['urls']
	},
	timeout: 30_000,
	execute: async (args): Promise<ToolResult> => {
		const rawUrls = Array.isArray(args.urls) ? args.urls : [];
		const urls = rawUrls.map((u) => String(u).trim()).filter(Boolean).slice(0, 5);
		const query = args.query ? String(args.query).trim() : undefined;
		const extractDepth = args.extract_depth === 'advanced' ? 'advanced' : 'basic';

		if (urls.length === 0) {
			return {
				success: false,
				contentBlocks: [{ type: 'error', message: 'At least one URL is required', tool: 'web_extract' }],
				textSummary: 'Error: At least one URL is required'
			};
		}

		const apiKey = (env as Record<string, string | undefined>)['TAVILY_API_KEY'] ?? '';
		if (!apiKey.trim()) {
			return {
				success: false,
				contentBlocks: [
					{ type: 'error', message: 'Web extract is not configured (missing TAVILY_API_KEY)', tool: 'web_extract' }
				],
				textSummary: 'Error: Web extract is not configured'
			};
		}

		const cacheKey = toolCache.generateKey('web_extract', { urls, query, extractDepth });
		const cached = toolCache.get<ToolResult>(cacheKey);
		if (cached) return cached;

		try {
			const response = await fetch(`${TAVILY_BASE}/extract`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					api_key: apiKey,
					urls,
					...(query ? { query } : {}),
					extract_depth: extractDepth,
					format: 'markdown',
					include_images: false,
					timeout: 30
				})
			});

			if (!response.ok) {
				const errorText = await response.text().catch(() => 'Unknown error');
				return {
					success: false,
					contentBlocks: [
						{ type: 'error', message: `Web extract failed: ${response.status} ${errorText}`, tool: 'web_extract' }
					],
					textSummary: `Error: Web extract failed (${response.status})`
				};
			}

			const data = (await response.json()) as TavilyExtractResponse;
			const results = data.results || [];

			if (results.length === 0) {
				const failedDomains = data.failed_results?.map((f) => extractDomain(f.url)).join(', ') || 'unknown';
				return {
					success: false,
					contentBlocks: [
						{ type: 'text', content: `Could not extract full content from the requested sources (${failedDomains}). Some sites block automated access. Use the snippets from web_search results instead.` }
					],
					textSummary: `Could not extract content from ${failedDomains} — sites may block scraping. Proceed with web_search snippets instead of retrying.`
				};
			}

			// Build text summary with full extracted content (truncated per source)
			const summaryLines: string[] = [`Extracted content from ${results.length} URL(s):\n`];
			for (const r of results) {
				const domain = extractDomain(r.url);
				summaryLines.push(`\n=== ${domain} (${r.url}) ===`);
				summaryLines.push(truncate(r.raw_content, MAX_CONTENT_PER_SOURCE));
			}

			if (data.failed_results && data.failed_results.length > 0) {
				summaryLines.push(`\nFailed to extract ${data.failed_results.length} URL(s):`);
				for (const f of data.failed_results) {
					summaryLines.push(`- ${f.url}: ${f.error}`);
				}
			}

			const result: ToolResult = {
				success: true,
				contentBlocks: [
					{
						type: 'text',
						content: `Extracted full content from ${results.length} source(s).`
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
			const message = err instanceof Error ? err.message : 'Web extract failed';
			return {
				success: false,
				contentBlocks: [{ type: 'error', message, tool: 'web_extract' }],
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
	return text.slice(0, maxLen).trimEnd() + '\n[... content truncated]';
}
