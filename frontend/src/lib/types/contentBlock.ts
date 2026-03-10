// Content Block Type System for Agent Mode
// Each assistant message can contain multiple content blocks of different types

export type OHLCV = {
	time: number; // Unix timestamp in seconds
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
};

export type IndicatorDataPoint = {
	time: number;
	value: number;
	label?: string;
};

// --- Block Types ---

export type TextBlock = {
	type: 'text';
	content: string; // markdown
};

export type ImageBlock = {
	type: 'image';
	url: string;
	alt?: string;
	caption?: string;
};

export type ChartBlock = {
	type: 'chart';
	chartType: 'candlestick' | 'line' | 'bar';
	symbol: string;
	interval: string;
	data: OHLCV[];
	indicators?: {
		name: string;
		data: IndicatorDataPoint[];
		color?: string;
		overlay: boolean; // true = on price chart, false = separate panel
	}[];
};

export type TableBlock = {
	type: 'table';
	title?: string;
	headers: string[];
	rows: (string | number)[][];
};

export type MetricCardBlock = {
	type: 'metric_card';
	title: string;
	metrics: {
		label: string;
		value: string;
		change?: string;
		direction?: 'up' | 'down' | 'neutral';
	}[];
};

export type NewsListBlock = {
	type: 'news_list';
	items: {
		title: string;
		url: string;
		source: string;
		publishedAt: string;
		sentiment?: 'bullish' | 'bearish' | 'neutral';
	}[];
};

export type EmbedBlock = {
	type: 'embed';
	url: string;
	height?: number;
	title?: string;
};

export type ErrorBlock = {
	type: 'error';
	message: string;
	tool?: string;
};

// --- Plan Block Types (Manus-like planning) ---

export type PlanStepStatus = 'pending' | 'running' | 'complete' | 'error' | 'skipped';

export type PlanStep = {
	id: string;
	title: string;
	description?: string;
	status: PlanStepStatus;
	toolName?: string;
	result?: string;
	startedAt?: number;
	completedAt?: number;
};

export type PlanBlock = {
	type: 'plan';
	planId: string;
	title: string;
	steps: PlanStep[];
	status: 'planning' | 'executing' | 'complete' | 'error';
	createdAt: number;
	updatedAt: number;
};

// --- Gauge Block (arc speedometer — COT positioning, RSI sentiment) ---

export type GaugeBlock = {
	type: 'gauge';
	title: string;
	value: number;   // 0–100
	label: string;   // e.g. "Extreme Long"
	thresholds: { value: number; color: string; label: string }[];
};

// --- Heatmap Block (multi-asset performance table) ---

export type HeatmapBlock = {
	type: 'heatmap';
	title: string;
	assets: string[];      // column headers
	timeframes: string[];  // row headers
	data: number[][];      // performance % [timeframe][asset]
	colorScale: 'redgreen' | 'goldblue';
};

// --- Trade Setup Block (institutional-grade trade plan) ---

export type TradeSetupBlock = {
	type: 'trade_setup';
	asset: string;
	direction: 'long' | 'short';
	thesis: string;
	entryZone: { low: number; high: number };
	stopLoss: number;
	targets: { price: number; label: string; rMultiple: number }[];
	riskRewardRatio: number;
	maxRiskPct: number;
	invalidation: string;
	timeframe: string;
};

// --- Discussion Block Types (multi-AI debate) ---

export type DiscussionPanelistId = 'bull' | 'bear' | 'moderator';

export type DiscussionPanelist = {
	id: DiscussionPanelistId;
	name: string;
	model: string;
	color: string;
	emoji: string;
};

export type DiscussionTurn = {
	panelistId: DiscussionPanelistId;
	round: number; // 0=intro, 1-2=debate, 99=synthesis
	content: string;
	model: string;
	startedAt: number;
	completedAt?: number;
};

export type DiscussionBlock = {
	type: 'discussion';
	discussionId: string;
	topic: string;
	panelists: DiscussionPanelist[];
	turns: DiscussionTurn[];
	status: 'running' | 'complete' | 'error';
	createdAt: number;
	updatedAt: number;
};

// --- Sources Block (data provenance / citations) ---

export type SourcesBlock = {
	type: 'sources';
	sources: {
		name: string;
		url?: string;
		accessedAt: number; // Unix ms timestamp
	}[];
};

export type ContentBlock =
	| TextBlock
	| ImageBlock
	| ChartBlock
	| TableBlock
	| MetricCardBlock
	| NewsListBlock
	| EmbedBlock
	| ErrorBlock
	| PlanBlock
	| GaugeBlock
	| HeatmapBlock
	| TradeSetupBlock
	| SourcesBlock
	| DiscussionBlock;

export type ContentBlockType = ContentBlock['type'];

export type AgentRouteType = 'direct_answer' | 'single_tool' | 'plan_then_execute' | 'discussion';

// --- Tool Call Status (for UI progress tracking) ---

export type ToolCallStatus = {
	id: string;
	name: string;
	args?: Record<string, unknown>;
	status: 'running' | 'complete' | 'error';
	startedAt: number;
	latencyMs?: number;
	resultSummary?: string;
};

// --- SSE Event Types ---

export type SSERunStart = {
	event: 'run_start';
	runId: string | null;
	routeType: AgentRouteType;
	mode: string;
	chatMode: 'normal' | 'agent' | 'discussion';
	model: string;
};

export type SSERunId = {
	event: 'run_id';
	runId: string;
};

export type SSETextDelta = {
	event: 'text_delta';
	content: string;
};

export type SSEToolStart = {
	event: 'tool_start';
	toolCallId: string;
	tool: string;
	args: Record<string, unknown>;
};

export type SSEToolResult = {
	event: 'tool_result';
	toolCallId: string;
	tool: string;
	blocks: ContentBlock[];
	success: boolean;
	textSummary: string;
};

export type SSEError = {
	event: 'error';
	message: string;
};

export type SSEDone = {
	event: 'done';
	runId?: string | null;
	routeType?: AgentRouteType;
	contentBlocks: ContentBlock[];
};

export type SSEPlanCreate = {
	event: 'plan_create';
	plan: PlanBlock;
};

export type SSEPlanUpdate = {
	event: 'plan_update';
	planId: string;
	stepId: string;
	status: PlanStepStatus;
	result?: string;
};

export type SSEPlanComplete = {
	event: 'plan_complete';
	planId: string;
	status: 'complete' | 'error';
};

export type SSEDiscussionTurnStart = {
	event: 'discussion_turn_start';
	discussionId: string;
	panelistId: DiscussionPanelistId;
	round: number;
	model: string;
};

export type SSEDiscussionTurnEnd = {
	event: 'discussion_turn_end';
	discussionId: string;
	panelistId: DiscussionPanelistId;
	round: number;
};

export type SSEEvent =
	| SSERunStart
	| SSERunId
	| SSETextDelta
	| SSEToolStart
	| SSEToolResult
	| SSEError
	| SSEDone
	| SSEPlanCreate
	| SSEPlanUpdate
	| SSEPlanComplete
	| SSEDiscussionTurnStart
	| SSEDiscussionTurnEnd;
