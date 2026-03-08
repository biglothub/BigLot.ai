/**
 * BigLot.ai - Environment Variable Validator
 * Validates required environment variables on startup
 */

import { env } from '$env/dynamic/private';

export type EnvValidationResult = {
    valid: boolean;
    errors: string[];
    warnings: string[];
};

function getEnv(key: string): string | undefined {
    return process.env[key];
}

export function validateEnvironment(): EnvValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required for AI features
    const openaiKey = getEnv('OPENAI_API_KEY') ?? '';
    const deepseekKey = getEnv('DEEPSEEK_API_KEY') ?? '';
    const hasOpenAI = !!openaiKey.trim();
    const hasDeepSeek = !!deepseekKey.trim();

    if (!hasOpenAI && !hasDeepSeek) {
        errors.push('Either OPENAI_API_KEY or DEEPSEEK_API_KEY is required');
    }

    if (hasOpenAI && !openaiKey.startsWith('sk-')) {
        warnings.push('OPENAI_API_KEY may not be valid (should start with sk-)');
    }

    if (hasDeepSeek && !deepseekKey.startsWith('sk-')) {
        warnings.push('DEEPSEEK_API_KEY may not be valid (should start with sk-)');
    }

    // Required for Supabase
    const supabaseUrl = getEnv('PUBLIC_SUPABASE_URL') ?? '';
    const supabaseAnonKey = getEnv('PUBLIC_SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl.trim()) {
        errors.push('PUBLIC_SUPABASE_URL is required');
    }

    if (!supabaseAnonKey.trim()) {
        errors.push('PUBLIC_SUPABASE_ANON_KEY is required');
    }

    if (!serviceRoleKey.trim()) {
        warnings.push('SUPABASE_SERVICE_ROLE_KEY is recommended for admin operations');
    }

    // AI Model validation
    const aiModel = getEnv('AI_MODEL') ?? '';
    const validModels = ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'deepseek', 'deepseek-r1'];
    if (aiModel && !validModels.includes(aiModel)) {
        warnings.push(`AI_MODEL "${aiModel}" is not recognized, defaulting to gpt-4o`);
    }

    // Telegram (optional but warn if partially configured)
    const telegramToken = getEnv('TELEGRAM_BOT_TOKEN') ?? '';
    const telegramUsername = getEnv('TELEGRAM_BOT_USERNAME') ?? '';
    const hasTelegramToken = !!telegramToken.trim();
    const hasTelegramUsername = !!telegramUsername.trim();

    if (hasTelegramToken && !hasTelegramUsername) {
        warnings.push('TELEGRAM_BOT_USERNAME is recommended when using Telegram');
    }

    // Production warnings
    const nodeEnv = getEnv('NODE_ENV') ?? '';
    const webhookSecret = getEnv('TELEGRAM_WEBHOOK_SECRET') ?? '';
    if (nodeEnv === 'production') {
        if (!webhookSecret.trim()) {
            warnings.push('TELEGRAM_WEBHOOK_SECRET is recommended in production');
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

export function logEnvStatus(): void {
    const result = validateEnvironment();

    if (result.errors.length > 0) {
        console.error('[BigLot.ai] ❌ Environment Configuration Errors:');
        result.errors.forEach(e => console.error(`  - ${e}`));
    }

    if (result.warnings.length > 0) {
        console.warn('[BigLot.ai] ⚠️ Environment Warnings:');
        result.warnings.forEach(w => console.warn(`  - ${w}`));
    }

    if (result.valid && result.warnings.length === 0) {
        console.log('[BigLot.ai] ✅ Environment configured correctly');
    }
}
