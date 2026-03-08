// Agent Loop - handles OpenAI tool calling with plan-then-execute strategy (Manus-like)
import type OpenAI from 'openai';
import type {
	ChatCompletionMessageParam,
	ChatCompletionChunk
} from 'openai/resources/chat/completions';
import type { ContentBlock, PlanBlock, PlanStep, PlanStepStatus } from '$lib/types/contentBlock';
import { getOpenAIToolSchemas, executeTool, getTool } from './tools/registry';

// Import tools to register them
import './tools/marketData.tool';
import './tools/charts.tool';
import './tools/planning.tool';

export type AgentCallbacks = {
	onTextDelta: (text: string) => void;
	onToolStart: (name: string, args: Record<string, unknown>) => void;
	onToolResult: (name: string, blocks: ContentBlock[]) => void;
	onPlanCreate: (plan: PlanBlock) => void;
	onPlanStepUpdate: (planId: string, stepId: string, status: PlanStepStatus, result?: string) => void;
	onPlanComplete: (planId: string, status: 'complete' | 'error') => void;
	onError: (message: string) => void;
};

export type AgentLoopConfig = {
	client: OpenAI;
	apiModel: string;
	messages: ChatCompletionMessageParam[];
	maxIterations?: number;
	planningEnabled?: boolean;
	callbacks: AgentCallbacks;
};

type ParsedToolCall = { id: string; name: string; arguments: string };

/**
 * Stream one LLM call and collect text + tool calls.
 */
async function streamLLMCall(
	client: OpenAI,
	apiModel: string,
	messages: ChatCompletionMessageParam[],
	tools: OpenAI.Chat.Completions.ChatCompletionTool[] | undefined,
	onTextDelta: (text: string) => void
): Promise<{ fullText: string; toolCalls: ParsedToolCall[]; finishReason: string | null }> {
	const stream = await client.chat.completions.create({
		model: apiModel,
		messages,
		tools: tools && tools.length > 0 ? tools : undefined,
		stream: true
	});

	let fullText = '';
	const toolCallMap = new Map<number, ParsedToolCall>();
	let finishReason: string | null = null;

	for await (const chunk of stream as AsyncIterable<ChatCompletionChunk>) {
		const choice = chunk.choices[0];
		if (!choice) continue;

		const textDelta = choice.delta?.content;
		if (textDelta) {
			fullText += textDelta;
			onTextDelta(textDelta);
		}

		const deltaToolCalls = choice.delta?.tool_calls;
		if (deltaToolCalls) {
			for (const tc of deltaToolCalls) {
				const existing = toolCallMap.get(tc.index);
				if (existing) {
					if (tc.function?.arguments) {
						existing.arguments += tc.function.arguments;
					}
				} else {
					toolCallMap.set(tc.index, {
						id: tc.id || '',
						name: tc.function?.name || '',
						arguments: tc.function?.arguments || ''
					});
				}
			}
		}

		if (choice.finish_reason) {
			finishReason = choice.finish_reason;
		}
	}

	return { fullText, toolCalls: Array.from(toolCallMap.values()), finishReason };
}

/**
 * Parse create_plan arguments into a PlanBlock.
 */
function buildPlanBlock(args: Record<string, unknown>): PlanBlock {
	const title = typeof args.title === 'string' ? args.title : 'Execution Plan';
	const rawSteps = Array.isArray(args.steps) ? args.steps : [];

	const steps: PlanStep[] = rawSteps.slice(0, 10).map((s: any, i: number) => ({
		id: typeof s.id === 'string' ? s.id : `step_${i + 1}`,
		title: typeof s.title === 'string' ? s.title : `Step ${i + 1}`,
		description: typeof s.description === 'string' ? s.description : undefined,
		status: 'pending' as const,
		toolName: typeof s.toolName === 'string' ? s.toolName : undefined
	}));

	return {
		type: 'plan',
		planId: `plan_${Date.now()}`,
		title,
		steps,
		status: 'planning',
		createdAt: Date.now(),
		updatedAt: Date.now()
	};
}

/**
 * Execute a single plan step that involves a tool call.
 */
async function executeToolStep(
	client: OpenAI,
	apiModel: string,
	messages: ChatCompletionMessageParam[],
	step: PlanStep,
	callbacks: AgentCallbacks
): Promise<{ blocks: ContentBlock[]; textSummary: string }> {
	const toolName = step.toolName!;
	const tool = getTool(toolName);
	if (!tool) {
		return { blocks: [], textSummary: `Tool "${toolName}" not found` };
	}

	// Ask the LLM to call the specific tool with appropriate arguments
	const stepTools = getOpenAIToolSchemas().filter(
		(t): t is OpenAI.Chat.Completions.ChatCompletionFunctionTool =>
			t.type === 'function' && t.function.name === toolName
	);
	const stepMessages: ChatCompletionMessageParam[] = [
		...messages,
		{
			role: 'system',
			content: `Execute this step: "${step.title}". Call the ${toolName} tool with the most appropriate arguments based on the conversation context. Only call this one tool.`
		}
	];

	const { fullText, toolCalls, finishReason } = await streamLLMCall(
		client,
		apiModel,
		stepMessages,
		stepTools,
		() => {} // Don't stream text during tool steps
	);

	// If the model called the tool, execute it
	if (finishReason === 'tool_calls' && toolCalls.length > 0) {
		const tc = toolCalls[0];
		let parsedArgs: Record<string, unknown> = {};
		try {
			parsedArgs = JSON.parse(tc.arguments || '{}');
		} catch {
			parsedArgs = {};
		}

		callbacks.onToolStart(toolName, parsedArgs);
		const result = await executeTool(toolName, parsedArgs);
		callbacks.onToolResult(toolName, result.contentBlocks);

		return { blocks: result.contentBlocks, textSummary: result.textSummary };
	}

	// Fallback: model responded with text instead of calling the tool
	return { blocks: [], textSummary: fullText || `Step "${step.title}" completed` };
}

/**
 * Execute a reasoning/synthesis step (no tools).
 */
async function executeReasoningStep(
	client: OpenAI,
	apiModel: string,
	messages: ChatCompletionMessageParam[],
	step: PlanStep,
	callbacks: AgentCallbacks,
	isFinalSynthesis: boolean
): Promise<string> {
	const instruction = isFinalSynthesis
		? `Based on all the data gathered above, provide a comprehensive and well-structured analysis. Synthesize all findings into actionable insights.`
		: `Perform this analysis step: "${step.title}". Be concise but thorough.`;

	const stepMessages: ChatCompletionMessageParam[] = [
		...messages,
		{ role: 'system', content: instruction }
	];

	const { fullText } = await streamLLMCall(
		client,
		apiModel,
		stepMessages,
		undefined, // No tools for reasoning
		(text) => callbacks.onTextDelta(text)
	);

	return fullText;
}

/**
 * Main agent loop with Manus-like planning support.
 */
export async function runAgentLoop(config: AgentLoopConfig): Promise<ContentBlock[]> {
	const { client, apiModel, callbacks, maxIterations = 5, planningEnabled = false } = config;
	const messages = [...config.messages];
	const allContentBlocks: ContentBlock[] = [];
	const tools = getOpenAIToolSchemas();

	// Phase 1: Initial LLM call (may produce a plan or direct response)
	const { fullText, toolCalls, finishReason } = await streamLLMCall(
		client,
		apiModel,
		messages,
		tools,
		(text) => callbacks.onTextDelta(text)
	);

	// Check if model called create_plan
	const planCall = planningEnabled
		? toolCalls.find((tc) => tc.name === 'create_plan')
		: undefined;

	if (planCall) {
		// ===== PLAN MODE: Two-phase execution =====
		let planArgs: Record<string, unknown> = {};
		try {
			planArgs = JSON.parse(planCall.arguments || '{}');
		} catch {
			planArgs = {};
		}

		const plan = buildPlanBlock(planArgs);
		if (plan.steps.length === 0) {
			// Invalid plan, fall through to standard mode
			callbacks.onError('Plan had no steps, falling back to standard mode');
		} else {
			plan.status = 'executing';
			callbacks.onPlanCreate(plan);
			allContentBlocks.push(plan);

			// Build message history with plan context
			messages.push({
				role: 'assistant',
				content: fullText || null,
				tool_calls: [
					{
						id: planCall.id,
						type: 'function' as const,
						function: { name: 'create_plan', arguments: planCall.arguments }
					}
				]
			});
			messages.push({
				role: 'tool',
				tool_call_id: planCall.id,
				content: `Plan created: "${plan.title}" with ${plan.steps.length} steps. Executing now.`
			} as ChatCompletionMessageParam);

			// Track results for synthesis
			const stepResults: string[] = [];

			// Phase 2: Execute each step
			for (const step of plan.steps) {
				callbacks.onPlanStepUpdate(plan.planId, step.id, 'running');
				step.status = 'running';
				step.startedAt = Date.now();

				try {
					const isReasoning = !step.toolName || step.toolName === 'reasoning';
					const isLastStep = step === plan.steps[plan.steps.length - 1];
					const isFinalSynthesis = isReasoning && isLastStep;

					if (isReasoning) {
						// Add prior results context
						if (stepResults.length > 0) {
							messages.push({
								role: 'system',
								content: `Data gathered so far:\n${stepResults.join('\n---\n')}`
							} as ChatCompletionMessageParam);
						}

						const text = await executeReasoningStep(
							client,
							apiModel,
							messages,
							step,
							callbacks,
							isFinalSynthesis
						);

						stepResults.push(`[${step.title}]: ${text}`);
						step.status = 'complete';
						step.result = isFinalSynthesis ? 'Analysis complete' : text.slice(0, 100);
						step.completedAt = Date.now();
						callbacks.onPlanStepUpdate(plan.planId, step.id, 'complete', step.result);
					} else {
						// Tool step
						const { blocks, textSummary } = await executeToolStep(
							client,
							apiModel,
							messages,
							step,
							callbacks
						);

						for (const block of blocks) {
							allContentBlocks.push(block);
						}

						// Add tool result to message history for subsequent steps
						messages.push({
							role: 'system',
							content: `Result of "${step.title}" (${step.toolName}): ${textSummary}`
						} as ChatCompletionMessageParam);

						stepResults.push(`[${step.title}]: ${textSummary}`);
						step.status = 'complete';
						step.result = textSummary.slice(0, 100);
						step.completedAt = Date.now();
						callbacks.onPlanStepUpdate(plan.planId, step.id, 'complete', step.result);
					}
				} catch (err: unknown) {
					const errMsg = err instanceof Error ? err.message : 'Step failed';
					step.status = 'error';
					step.result = errMsg;
					step.completedAt = Date.now();
					callbacks.onPlanStepUpdate(plan.planId, step.id, 'error', errMsg);
					stepResults.push(`[${step.title}]: ERROR - ${errMsg}`);
					// Continue to next step
				}
			}

			// Mark plan as complete
			const hasErrors = plan.steps.some((s) => s.status === 'error');
			const allErrors = plan.steps.every((s) => s.status === 'error');
			plan.status = allErrors ? 'error' : 'complete';
			plan.updatedAt = Date.now();
			callbacks.onPlanComplete(plan.planId, allErrors ? 'error' : 'complete');

			return allContentBlocks;
		}
	}

	// ===== STANDARD MODE: Original iterative tool calling (fallback) =====
	if (finishReason !== 'tool_calls' || toolCalls.length === 0) {
		return allContentBlocks;
	}

	// Process tool calls from first iteration
	const assistantToolCalls = toolCalls.map((tc) => ({
		id: tc.id,
		type: 'function' as const,
		function: { name: tc.name, arguments: tc.arguments }
	}));

	messages.push({
		role: 'assistant',
		content: fullText || null,
		tool_calls: assistantToolCalls
	});

	for (const tc of toolCalls) {
		if (tc.name === 'create_plan') continue; // Skip if planning wasn't enabled

		let parsedArgs: Record<string, unknown> = {};
		try {
			parsedArgs = JSON.parse(tc.arguments || '{}');
		} catch {
			parsedArgs = {};
		}

		callbacks.onToolStart(tc.name, parsedArgs);
		const result = await executeTool(tc.name, parsedArgs);
		for (const block of result.contentBlocks) {
			allContentBlocks.push(block);
		}
		callbacks.onToolResult(tc.name, result.contentBlocks);

		messages.push({
			role: 'tool',
			tool_call_id: tc.id,
			content: result.textSummary
		} as ChatCompletionMessageParam);
	}

	// Continue iterating (standard mode)
	const effectiveMax = maxIterations;
	for (let iteration = 1; iteration < effectiveMax; iteration++) {
		const result = await streamLLMCall(
			client,
			apiModel,
			messages,
			tools,
			(text) => callbacks.onTextDelta(text)
		);

		if (result.finishReason !== 'tool_calls' || result.toolCalls.length === 0) {
			break;
		}

		const assistantCalls = result.toolCalls.map((tc) => ({
			id: tc.id,
			type: 'function' as const,
			function: { name: tc.name, arguments: tc.arguments }
		}));

		messages.push({
			role: 'assistant',
			content: result.fullText || null,
			tool_calls: assistantCalls
		});

		for (const tc of result.toolCalls) {
			let parsedArgs: Record<string, unknown> = {};
			try {
				parsedArgs = JSON.parse(tc.arguments || '{}');
			} catch {
				parsedArgs = {};
			}

			callbacks.onToolStart(tc.name, parsedArgs);
			const toolResult = await executeTool(tc.name, parsedArgs);
			for (const block of toolResult.contentBlocks) {
				allContentBlocks.push(block);
			}
			callbacks.onToolResult(tc.name, toolResult.contentBlocks);

			messages.push({
				role: 'tool',
				tool_call_id: tc.id,
				content: toolResult.textSummary
			} as ChatCompletionMessageParam);
		}
	}

	return allContentBlocks;
}
