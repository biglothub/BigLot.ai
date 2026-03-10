import { getSupabaseAdminClient } from '$lib/server/supabaseAdmin.server';
import type { AgentMode } from '$lib/agent/systemPrompts';
import type { AgentRouteType, PlanStepStatus } from '$lib/types/contentBlock';

type ChatMode = 'normal' | 'agent' | 'discussion';

type AgentRunStatus = 'running' | 'complete' | 'error';
type ToolExecutionStatus = 'pending' | 'success' | 'error' | 'timeout';

type AgentRunCreateInput = {
	chatId?: string | null;
	biglotUserId?: string | null;
	mode: AgentMode;
	chatMode: ChatMode;
	routeType: AgentRouteType;
	provider: string;
	model: string;
	clientIp: string;
	messageCount: number;
	hasImageInput: boolean;
	lastUserMessage: string;
};

type AgentRunUpdateInput = {
	runId: string;
	status: AgentRunStatus;
	planUsed?: boolean;
	toolCallCount?: number;
	textOutputLength?: number;
	errorMessage?: string | null;
};

type ToolExecutionInput = {
	runId?: string | null;
	chatId?: string | null;
	toolCallId: string;
	toolName: string;
	toolArgs: Record<string, unknown>;
	resultStatus: ToolExecutionStatus;
	resultData?: Record<string, unknown>;
	errorMessage?: string | null;
	executionTimeMs?: number | null;
};

type AgentStepInput = {
	runId?: string | null;
	planId: string;
	stepId: string;
	title?: string;
	toolName?: string;
	status: PlanStepStatus;
	result?: string;
};

type MessageFeedbackInput = {
	messageId: string;
	runId?: string | null;
	biglotUserId?: string | null;
	feedback: 'up' | 'down';
	reason?: string;
};

const suppressedErrors = new Set<string>();

function getAdminClientOrNull() {
	try {
		return getSupabaseAdminClient();
	} catch {
		return null;
	}
}

function shouldSuppress(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	return /does not exist|relation .* does not exist|column .* does not exist/i.test(error.message);
}

function logSuppressedError(key: string, error: unknown): void {
	if (suppressedErrors.has(key)) return;
	suppressedErrors.add(key);
	console.warn(`[BigLot.ai] observability disabled for ${key}:`, error);
}

export async function createAgentRun(input: AgentRunCreateInput): Promise<string | null> {
	const supabase = getAdminClientOrNull();
	if (!supabase) return null;

	try {
		const { data, error } = await supabase
			.from('agent_runs')
			.insert({
				chat_id: input.chatId ?? null,
				biglot_user_id: input.biglotUserId ?? null,
				mode: input.mode,
				chat_mode: input.chatMode,
				route_type: input.routeType,
				provider: input.provider,
				model: input.model,
				client_ip: input.clientIp,
				message_count: input.messageCount,
				has_image_input: input.hasImageInput,
				last_user_message: input.lastUserMessage,
				status: 'running'
			})
			.select('id')
			.single();

		if (error) throw new Error(error.message);
		return typeof data?.id === 'string' ? data.id : null;
	} catch (error) {
		if (shouldSuppress(error)) {
			logSuppressedError('agent_runs.create', error);
			return null;
		}
		console.error('[BigLot.ai] createAgentRun failed:', error);
		return null;
	}
}

export async function updateAgentRun(input: AgentRunUpdateInput): Promise<void> {
	const supabase = getAdminClientOrNull();
	if (!supabase) return;

	try {
		const { error } = await supabase
			.from('agent_runs')
			.update({
				status: input.status,
				plan_used: input.planUsed,
				tool_call_count: input.toolCallCount,
				text_output_length: input.textOutputLength,
				error_message: input.errorMessage ?? null,
				completed_at: input.status === 'running' ? null : new Date().toISOString(),
				updated_at: new Date().toISOString()
			})
			.eq('id', input.runId);

		if (error) throw new Error(error.message);
	} catch (error) {
		if (shouldSuppress(error)) {
			logSuppressedError('agent_runs.update', error);
			return;
		}
		console.error('[BigLot.ai] updateAgentRun failed:', error);
	}
}

export async function logToolExecution(input: ToolExecutionInput): Promise<void> {
	const supabase = getAdminClientOrNull();
	if (!supabase) return;

	try {
		const payload = {
			run_id: input.runId ?? null,
			chat_id: input.chatId ?? null,
			tool_call_id: input.toolCallId,
			tool_name: input.toolName,
			tool_args: input.toolArgs,
			result_status: input.resultStatus,
			result_data: input.resultData ?? null,
			error_message: input.errorMessage ?? null,
			execution_time_ms: input.executionTimeMs ?? null
		};

		const { error } = await supabase.from('tool_executions').insert(payload);
		if (error) throw new Error(error.message);
	} catch (error) {
		if (shouldSuppress(error)) {
			logSuppressedError('tool_executions.insert', error);
			return;
		}
		console.error('[BigLot.ai] logToolExecution failed:', error);
	}
}

export async function upsertAgentStepRun(input: AgentStepInput): Promise<void> {
	const supabase = getAdminClientOrNull();
	if (!supabase || !input.runId) return;

	const isCompletedState = input.status === 'complete' || input.status === 'error' || input.status === 'skipped';
	const nowIso = new Date().toISOString();

	try {
		const { error } = await supabase.from('agent_step_runs').upsert(
			{
				run_id: input.runId,
				plan_id: input.planId,
				step_id: input.stepId,
				title: input.title ?? null,
				tool_name: input.toolName ?? null,
				status: input.status,
				result: input.result ?? null,
				started_at: input.status === 'running' ? nowIso : null,
				completed_at: isCompletedState ? nowIso : null,
				updated_at: nowIso
			},
			{ onConflict: 'run_id,step_id' }
		);

		if (error) throw new Error(error.message);
	} catch (error) {
		if (shouldSuppress(error)) {
			logSuppressedError('agent_step_runs.upsert', error);
			return;
		}
		console.error('[BigLot.ai] upsertAgentStepRun failed:', error);
	}
}

export async function saveMessageFeedback(input: MessageFeedbackInput): Promise<void> {
	const supabase = getAdminClientOrNull();
	if (!supabase) return;

	try {
		const { error } = await supabase.from('message_feedback').upsert(
			{
				message_id: input.messageId,
				run_id: input.runId ?? null,
				biglot_user_id: input.biglotUserId ?? null,
				feedback: input.feedback,
				reason: input.reason?.trim() || null,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'message_id' }
		);

		if (error) throw new Error(error.message);
	} catch (error) {
		if (shouldSuppress(error)) {
			logSuppressedError('message_feedback.upsert', error);
			return;
		}
		console.error('[BigLot.ai] saveMessageFeedback failed:', error);
	}
}
