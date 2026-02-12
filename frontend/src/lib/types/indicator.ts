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

// ─── GPT Model Types ───

export type GPTModelOption = 'gpt-4o' | 'gpt-4o-mini' | 'o3-mini';

// ─── Legacy Manus Types (kept for DB compatibility) ───
// The manus_task_id field in CustomIndicator is now used as a generation ID

export type ManusAgentProfile = GPTModelOption; // Alias for backward compatibility

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
    currentStep?: string;
    error?: string;
    generatedCode?: string;
    generatedPreviewCode?: string;
    generatedConfig?: IndicatorConfig;
    activityLog?: IndicatorActivityLog[];
};
