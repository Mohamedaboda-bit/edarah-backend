export interface RateLimitConfig {
    points: number;
    duration: number;
    blockDuration: number;
}
export declare class RateLimiterService {
    private static limiters;
    /**
     * Get rate limit configuration based on user's plan
     */
    static getRateLimitConfig(userId: string): Promise<RateLimitConfig>;
    /**
     * Check if user has exceeded rate limit
     */
    static checkRateLimit(userId: string): Promise<{
        allowed: boolean;
        remaining: number;
        resetTime?: Date;
    }>;
    /**
     * Get remaining requests for user
     */
    static getRemainingRequests(userId: string): Promise<{
        remaining: number;
        resetTime?: Date;
    }>;
    /**
     * Reset rate limit for user (admin function)
     */
    static resetRateLimit(userId: string): Promise<void>;
    /**
     * Clean up old limiters (call periodically)
     */
    static cleanup(): void;
}
//# sourceMappingURL=rateLimiter.d.ts.map