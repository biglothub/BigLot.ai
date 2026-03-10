// Handoff pseudo-tool - intercepted by the agent loop to switch agent modes
// Similar to create_plan: the agent loop detects this call and swaps the system prompt
import { registerTool } from './registry';

registerTool({
	name: 'handoff_to_agent',
	description:
		'Hand off the conversation to a specialized agent mode when the current mode cannot best serve the user\'s request. ' +
		'Use this when:\n' +
		'- Coach mode user asks about prices/charts → handoff to "analyst" or "gold"\n' +
		'- Any mode user asks about gold specifically → handoff to "gold"\n' +
		'- Any mode user asks about macro/Fed/yields → handoff to "macro"\n' +
		'- Any mode user shows signs of tilt/loss/emotional distress → handoff to "recovery"\n' +
		'- Any mode user asks about portfolio allocation → handoff to "portfolio"\n' +
		'- Any mode user asks for Pine Script code → handoff to "pinescript"\n' +
		'Do NOT handoff for simple follow-up questions within the current mode\'s domain.',
	parameters: {
		type: 'object',
		properties: {
			target_mode: {
				type: 'string',
				enum: ['coach', 'recovery', 'analyst', 'pinescript', 'gold', 'macro', 'portfolio'],
				description: 'The agent mode to hand off to'
			},
			reason: {
				type: 'string',
				description: 'Brief explanation of why this handoff is needed (shown to user)'
			},
			context_summary: {
				type: 'string',
				description: 'Key context from the current conversation to carry forward to the new agent mode'
			}
		},
		required: ['target_mode', 'reason']
	},
	execute: async (args) => {
		// No-op — the agent loop intercepts handoff_to_agent calls
		const target = typeof args.target_mode === 'string' ? args.target_mode : 'analyst';
		const reason = typeof args.reason === 'string' ? args.reason : 'Switching specialist';
		return {
			success: true,
			contentBlocks: [],
			textSummary: `Handing off to ${target} mode: ${reason}`
		};
	}
});
