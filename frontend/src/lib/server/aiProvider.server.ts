import OpenAI from 'openai';
import { env } from '$env/dynamic/private';

export type AIProvider = 'openai' | 'deepseek' | 'anthropic' | 'google';
export type AIModel =
    | 'gpt-4o'
    | 'gpt-4o-mini'
    | 'o3-mini'
    | 'deepseek'
    | 'deepseek-r1'
    | 'claude-sonnet'
    | 'claude-haiku'
    | 'gemini-2.5-flash'
    | 'gemini-2.5-pro';

type ModelConfig = {
    provider: AIProvider;
    apiModel: string;
    supportsImageInput: boolean;
};

const MODEL_CONFIG: Record<AIModel, ModelConfig> = {
    'gpt-4o': { provider: 'openai', apiModel: 'gpt-4o', supportsImageInput: true },
    'gpt-4o-mini': { provider: 'openai', apiModel: 'gpt-4o-mini', supportsImageInput: true },
    'o3-mini': { provider: 'openai', apiModel: 'o3-mini', supportsImageInput: false },
    // DeepSeek default chat model.
    'deepseek': { provider: 'deepseek', apiModel: 'deepseek-chat', supportsImageInput: false },
    // DeepSeek API model name for R1 is `deepseek-reasoner`.
    'deepseek-r1': { provider: 'deepseek', apiModel: 'deepseek-reasoner', supportsImageInput: false },
    // Anthropic via OpenAI-compatible endpoint
    'claude-sonnet': { provider: 'anthropic', apiModel: 'claude-sonnet-4-20250514', supportsImageInput: true },
    'claude-haiku': { provider: 'anthropic', apiModel: 'claude-haiku-4-5-20251001', supportsImageInput: true },
    // Google Gemini via OpenAI-compatible endpoint
    'gemini-2.5-flash': { provider: 'google', apiModel: 'gemini-2.5-flash', supportsImageInput: true },
    'gemini-2.5-pro': { provider: 'google', apiModel: 'gemini-2.5-pro', supportsImageInput: true }
};

export const AI_MODEL_LIST: AIModel[] = Object.keys(MODEL_CONFIG) as AIModel[];

export function isAIModel(value: unknown): value is AIModel {
    return typeof value === 'string' && value in MODEL_CONFIG;
}

export function resolveDefaultAIModel(): AIModel {
    const configured = env.AI_MODEL?.trim();
    if (configured === 'deepseek-chat') return 'deepseek';
    if (configured && isAIModel(configured)) return configured;
    return 'gpt-4o';
}

export function getModelConfig(model: AIModel): ModelConfig {
    return MODEL_CONFIG[model];
}

/** Provider-specific base URLs and API key env var names */
const PROVIDER_CONFIG: Record<AIProvider, { baseURL?: string; envKey: string; envLabel: string }> = {
    openai: { envKey: 'OPENAI_API_KEY', envLabel: 'OPENAI_API_KEY' },
    deepseek: { baseURL: 'https://api.deepseek.com', envKey: 'DEEPSEEK_API_KEY', envLabel: 'DEEPSEEK_API_KEY' },
    anthropic: { baseURL: 'https://api.anthropic.com/v1/', envKey: 'ANTHROPIC_API_KEY', envLabel: 'ANTHROPIC_API_KEY' },
    google: { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', envKey: 'GOOGLE_AI_API_KEY', envLabel: 'GOOGLE_AI_API_KEY' }
};

export function getClientForModel(model: AIModel): {
    client: OpenAI;
    apiModel: string;
    provider: AIProvider;
    supportsImageInput: boolean;
} {
    const config = MODEL_CONFIG[model];
    const providerCfg = PROVIDER_CONFIG[config.provider];

    const key = (env as Record<string, string | undefined>)[providerCfg.envKey];
    if (!key) throw new Error(`${providerCfg.envLabel} is not configured in .env`);

    const clientOpts: ConstructorParameters<typeof OpenAI>[0] = { apiKey: key };
    if (providerCfg.baseURL) {
        clientOpts.baseURL = providerCfg.baseURL;
    }

    return {
        client: new OpenAI(clientOpts),
        apiModel: config.apiModel,
        provider: config.provider,
        supportsImageInput: config.supportsImageInput
    };
}

/**
 * Try the primary model, fall back to alternates on error.
 * Returns the first successful client+model pair.
 */
export function getClientWithFallback(primary: AIModel, fallbacks: AIModel[]): {
    client: OpenAI;
    apiModel: string;
    provider: AIProvider;
    supportsImageInput: boolean;
    model: AIModel;
} {
    const chain = [primary, ...fallbacks];
    for (const model of chain) {
        try {
            const result = getClientForModel(model);
            return { ...result, model };
        } catch {
            // API key not configured, try next
            continue;
        }
    }
    throw new Error(`No AI provider available. Tried: ${chain.join(', ')}. Check your API keys in .env`);
}
