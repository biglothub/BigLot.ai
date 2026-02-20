import OpenAI from 'openai';
import { env } from '$env/dynamic/private';

export type AIProvider = 'openai' | 'deepseek';
export type AIModel = 'gpt-4o' | 'gpt-4o-mini' | 'o3-mini' | 'deepseek-r1';

type ModelConfig = {
    provider: AIProvider;
    apiModel: string;
    supportsImageInput: boolean;
};

const MODEL_CONFIG: Record<AIModel, ModelConfig> = {
    'gpt-4o': { provider: 'openai', apiModel: 'gpt-4o', supportsImageInput: true },
    'gpt-4o-mini': { provider: 'openai', apiModel: 'gpt-4o-mini', supportsImageInput: true },
    'o3-mini': { provider: 'openai', apiModel: 'o3-mini', supportsImageInput: false },
    // DeepSeek API model name for R1 is `deepseek-reasoner`.
    'deepseek-r1': { provider: 'deepseek', apiModel: 'deepseek-reasoner', supportsImageInput: false }
};

export const AI_MODEL_LIST: AIModel[] = Object.keys(MODEL_CONFIG) as AIModel[];

export function isAIModel(value: unknown): value is AIModel {
    return typeof value === 'string' && value in MODEL_CONFIG;
}

export function resolveDefaultAIModel(): AIModel {
    const configured = env.AI_MODEL?.trim();
    if (configured && isAIModel(configured)) return configured;
    return 'gpt-4o';
}

export function getClientForModel(model: AIModel): {
    client: OpenAI;
    apiModel: string;
    provider: AIProvider;
    supportsImageInput: boolean;
} {
    const config = MODEL_CONFIG[model];

    if (config.provider === 'deepseek') {
        const key = env.DEEPSEEK_API_KEY;
        if (!key) throw new Error('DEEPSEEK_API_KEY is not configured in .env');
        return {
            client: new OpenAI({ apiKey: key, baseURL: 'https://api.deepseek.com' }),
            apiModel: config.apiModel,
            provider: config.provider,
            supportsImageInput: config.supportsImageInput
        };
    }

    const key = env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is not configured in .env');
    return {
        client: new OpenAI({ apiKey: key }),
        apiModel: config.apiModel,
        provider: config.provider,
        supportsImageInput: config.supportsImageInput
    };
}
