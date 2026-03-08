/**
 * BigLot.ai - Rate Limiting Middleware
 * In-memory rate limiter for API routes
 */

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

// In-memory store (use Redis for production/multi-instance)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
        if (entry.resetAt < now) {
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
    windowMs: number;  // Time window in milliseconds
    maxRequests: number;  // Max requests per window
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
}

/**
 * Check if request is allowed under rate limit
 * @param identifier - Unique identifier (IP, user ID, etc.)
 * @param config - Rate limit configuration
 */
export function checkRateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const key = `ratelimit:${identifier}`;
    
    const entry = rateLimitStore.get(key);
    
    if (!entry || entry.resetAt < now) {
        // New window
        const resetAt = now + config.windowMs;
        rateLimitStore.set(key, {
            count: 1,
            resetAt
        });
        
        return {
            allowed: true,
            remaining: config.maxRequests - 1,
            resetAt
        };
    }
    
    if (entry.count >= config.maxRequests) {
        // Rate limited
        return {
            allowed: false,
            remaining: 0,
            resetAt: entry.resetAt
        };
    }
    
    // Increment count
    entry.count += 1;
    rateLimitStore.set(key, entry);
    
    return {
        allowed: true,
        remaining: config.maxRequests - entry.count,
        resetAt: entry.resetAt
    };
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
    const secondsUntilReset = Math.ceil((result.resetAt - Date.now()) / 1000);
    
    return {
        'X-RateLimit-Limit': String(result.resetAt ? 1 : 1), // This will be set by config
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(secondsUntilReset)
    };
}

// Pre-configured rate limits
export const RATE_LIMITS = {
    // Chat API: 30 requests per minute per user
    chat: { windowMs: 60 * 1000, maxRequests: 30 },
    
    // Engine API: 10 requests per minute (indicator generation is expensive)
    engine: { windowMs: 60 * 1000, maxRequests: 10 },
    
    // Telegram webhook: 60 requests per minute (handled separately)
    telegram: { windowMs: 60 * 1000, maxRequests: 60 },
    
    // Default API: 60 requests per minute
    default: { windowMs: 60 * 1000, maxRequests: 60 }
} as const;
