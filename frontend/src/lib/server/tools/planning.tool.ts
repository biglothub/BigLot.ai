// Planning pseudo-tool - intercepted by the agent loop, never actually executed
import { registerTool } from './registry';

registerTool({
	name: 'create_plan',
	description:
		'Create an execution plan with numbered steps BEFORE performing any analysis or data gathering. Always call this tool first when the user asks a question that requires multiple steps, data fetching, or analysis.',
	parameters: {
		type: 'object',
		properties: {
			title: {
				type: 'string',
				description: 'Short descriptive title for the plan, e.g. "BTC Market Analysis"'
			},
			steps: {
				type: 'array',
				description: 'Ordered list of steps to execute (2-6 steps)',
				items: {
					type: 'object',
					properties: {
						id: {
							type: 'string',
							description: 'Unique step identifier, e.g. "step_1", "step_2"'
						},
						title: {
							type: 'string',
							description: 'Short description of what this step does'
						},
						description: {
							type: 'string',
							description: 'Optional longer explanation'
						},
						toolName: {
							type: 'string',
							description:
								'Name of the tool to call (e.g. "get_market_data", "get_crypto_chart"), or "reasoning" for analysis/synthesis steps'
						}
					},
					required: ['id', 'title']
				}
			}
		},
		required: ['title', 'steps']
	},
	execute: async (args) => {
		// This is a no-op -- the agent loop intercepts create_plan calls
		const title = typeof args.title === 'string' ? args.title : 'Plan';
		const steps = Array.isArray(args.steps) ? args.steps : [];
		return {
			success: true,
			contentBlocks: [],
			textSummary: `Plan created: "${title}" with ${steps.length} steps. Now executing step by step.`
		};
	}
});
