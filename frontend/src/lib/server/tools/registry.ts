// Tool Registry - defines tool interface and manages all available tools
import type { ContentBlock } from '$lib/types/contentBlock';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export type DataSource = {
	name: string;
	url?: string;
	accessedAt: number; // Date.now() timestamp
};

export type ToolResult = {
	success: boolean;
	contentBlocks: ContentBlock[];
	textSummary: string; // plain text fed back to LLM as tool result
	sources?: DataSource[];
};

export type ToolDefinition = {
	name: string;
	description: string;
	parameters: Record<string, unknown>; // JSON Schema object
	execute: (args: Record<string, unknown>) => Promise<ToolResult>;
	timeout?: number; // ms, default 30000
};

const tools = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition): void {
	tools.set(tool.name, tool);
}

export function getTool(name: string): ToolDefinition | undefined {
	return tools.get(name);
}

export function getAllTools(): ToolDefinition[] {
	return Array.from(tools.values());
}

export function getOpenAIToolSchemas(): ChatCompletionTool[] {
	return getAllTools().map((tool) => ({
		type: 'function' as const,
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters
		}
	}));
}

export async function executeTool(
	name: string,
	args: Record<string, unknown>
): Promise<ToolResult> {
	const tool = tools.get(name);
	if (!tool) {
		return {
			success: false,
			contentBlocks: [{ type: 'error', message: `Unknown tool: ${name}`, tool: name }],
			textSummary: `Error: Unknown tool "${name}"`
		};
	}

	const timeout = tool.timeout ?? 30_000;

	try {
		const result = await Promise.race([
			tool.execute(args),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error(`Tool "${name}" timed out after ${timeout}ms`)), timeout)
			)
		]);
		return result;
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : `Tool "${name}" failed`;
		return {
			success: false,
			contentBlocks: [{ type: 'error', message, tool: name }],
			textSummary: `Error executing ${name}: ${message}`
		};
	}
}
