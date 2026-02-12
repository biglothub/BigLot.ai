// ─── OHLCV & Indicator Data Types ───

export type OHLCV = {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
};

export type IndicatorValue = {
    timestamp: number;
    values: Record<string, number | null>;
    signal?: 'buy' | 'sell' | 'neutral';
};

export type IndicatorConfig = {
    name: string;
    description: string;
    params: Record<string, { default: number; min?: number; max?: number; step?: number; label?: string }>;
    overlayType: 'overlay' | 'separate'; // overlay = on price chart, separate = below
    colors?: Record<string, string>;
};

export type CustomIndicator = {
    id: string;
    user_id?: string;
    name: string;
    description: string;
    code: string;
    config: IndicatorConfig;
    manus_task_id: string;
    version: number;
    is_active: boolean;
    created_at: string;
    updated_at?: string;
};

// ─── Manus API Types ───

export type ManusTaskMode = 'chat' | 'adaptive' | 'agent';
export type ManusAgentProfile = 'manus-1.6' | 'manus-1.6-lite' | 'manus-1.6-max';
export type ManusTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ManusCreateTaskRequest = {
    prompt: string;
    agentProfile?: ManusAgentProfile;
    task_mode?: ManusTaskMode;
    attachments?: ManusAttachment[];
    project_id?: string;
    task_id?: string; // for multi-turn
    hide_in_task_list?: boolean;
    locale?: string;
};

export type ManusAttachment = {
    type: 'file_id' | 'url' | 'base64';
    file_id?: string;
    url?: string;
    data?: string;
    mime_type?: string;
    file_name?: string;
};

export type ManusCreateTaskResponse = {
    task_id: string;
    task_title: string;
    task_url: string;
    share_url?: string;
};

export type ManusTaskOutputContent = {
    type: 'output_text' | 'output_file';
    text?: string;
    fileUrl?: string;
    fileName?: string;
    mimeType?: string;
};

export type ManusTaskOutputMessage = {
    id: string;
    status: string;
    role: 'user' | 'assistant';
    type: string;
    content: ManusTaskOutputContent[];
};

export type ManusTask = {
    id: string;
    object: string;
    created_at: number;
    updated_at: number;
    status: ManusTaskStatus;
    error?: string;
    instructions?: string;
    model?: string;
    metadata?: {
        task_title?: string;
        task_url?: string;
    };
    output?: ManusTaskOutputMessage[];
    credit_usage?: number;
};

export type ManusGetTasksResponse = {
    object: string;
    data: ManusTask[];
    first_id: string;
    last_id: string;
    has_more: boolean;
};

// ─── Webhook Types ───

export type ManusWebhookEvent = {
    event_id: string;
    event_type: 'task_created' | 'task_progress' | 'task_stopped';
    task_detail?: {
        task_id: string;
        task_title?: string;
        task_url?: string;
        message?: string;
        attachments?: { file_name: string; url: string; size_bytes: number }[];
        stop_reason?: 'finish' | 'ask';
    };
    progress_detail?: {
        task_id: string;
        progress_type: string;
        message: string;
    };
};

// ─── Indicator Builder State Types ───

export type IndicatorGenerationStatus =
    | 'idle'
    | 'submitting'
    | 'generating'
    | 'parsing'
    | 'ready'
    | 'error';

export type IndicatorActivityLog = {
    id: string;
    type: 'task_created' | 'task_progress' | 'task_stopped' | 'system';
    message: string;
    receivedAt: number;
};

export type IndicatorGenerationProgress = {
    status: IndicatorGenerationStatus;
    taskId?: string;
    taskUrl?: string;
    currentStep?: string;
    error?: string;
    generatedCode?: string;
    generatedPreviewCode?: string;
    generatedConfig?: IndicatorConfig;
    activityLog?: IndicatorActivityLog[];
};
