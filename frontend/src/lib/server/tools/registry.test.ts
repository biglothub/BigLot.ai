import { describe, it, expect, vi } from 'vitest';
import { registerTool, getTool, getAllTools, executeTool, getOpenAIToolSchemas, type ToolDefinition } from './registry';
import type { ToolResult } from './registry';

function createTestTool(name: string, overrides: Partial<ToolDefinition> = {}): ToolDefinition {
	return {
		name,
		description: `Test tool: ${name}`,
		parameters: { type: 'object', properties: { input: { type: 'string' } } },
		execute: vi.fn(async () => ({
			success: true,
			contentBlocks: [],
			textSummary: `${name} executed`
		})),
		...overrides
	};
}

describe('registerTool / getTool', () => {
	it('registers and retrieves a tool', () => {
		const tool = createTestTool('test_register_get');
		registerTool(tool);
		expect(getTool('test_register_get')).toBe(tool);
	});

	it('returns undefined for unknown tool', () => {
		expect(getTool('nonexistent_tool_xyz')).toBeUndefined();
	});
});

describe('getAllTools', () => {
	it('returns array of all registered tools', () => {
		registerTool(createTestTool('test_getall_1'));
		registerTool(createTestTool('test_getall_2'));
		const all = getAllTools();
		expect(all.length).toBeGreaterThanOrEqual(2);
		expect(all.some(t => t.name === 'test_getall_1')).toBe(true);
		expect(all.some(t => t.name === 'test_getall_2')).toBe(true);
	});
});

describe('executeTool', () => {
	it('returns error for unknown tool', async () => {
		const result = await executeTool('unknown_tool_xyz', {});
		expect(result.success).toBe(false);
		expect(result.textSummary).toContain('Unknown tool');
		expect(result.contentBlocks[0].type).toBe('error');
	});

	it('executes tool and returns result', async () => {
		const tool = createTestTool('test_execute_ok');
		registerTool(tool);
		const result = await executeTool('test_execute_ok', { input: 'hello' });
		expect(result.success).toBe(true);
		expect(tool.execute).toHaveBeenCalledWith({ input: 'hello' });
	});

	it('catches tool exceptions and returns error', async () => {
		const tool = createTestTool('test_execute_throw', {
			execute: vi.fn(async () => { throw new Error('boom'); })
		});
		registerTool(tool);
		const result = await executeTool('test_execute_throw', {});
		expect(result.success).toBe(false);
		expect(result.textSummary).toContain('boom');
	});

	it('times out for slow tools', async () => {
		const tool = createTestTool('test_timeout', {
			timeout: 50,
			execute: vi.fn(
				() =>
					new Promise<ToolResult>((resolve) =>
						setTimeout(
							() =>
								resolve({
									success: true,
									contentBlocks: [],
									textSummary: 'slow tool resolved'
								}),
							500
						)
					)
			)
		});
		registerTool(tool);
		const result = await executeTool('test_timeout', {});
		expect(result.success).toBe(false);
		expect(result.textSummary).toContain('timed out');
	});
});

describe('getOpenAIToolSchemas', () => {
	it('returns array of OpenAI function tool format', () => {
		registerTool(createTestTool('test_schema'));
		const schemas = getOpenAIToolSchemas();
		expect(schemas.length).toBeGreaterThan(0);

		const schema = schemas.find(
			(schema): schema is Extract<(typeof schemas)[number], { type: 'function' }> =>
				schema.type === 'function' && schema.function.name === 'test_schema'
		);
		expect(schema).toBeDefined();
		expect(schema!.type).toBe('function');
		expect(schema!.function.description).toContain('test_schema');
		expect(schema!.function.parameters).toBeDefined();
	});
});
