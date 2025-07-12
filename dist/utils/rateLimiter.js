"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiterService = void 0;
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
const index_1 = require("../index");
class RateLimiterService {
    /**
     * Get rate limit configuration based on user's plan
     */
    static async getRateLimitConfig(userId) {
        try {
            const userPlan = await index_1.prisma.user_plans.findFirst({
                where: {
                    user_id: BigInt(userId),
                    is_active: true
                },
                include: {
                    plan: true
                }
            });
            if (!userPlan) {
                // Default limits for users without active plans
                return {
                    points: 10,
                    duration: 3600, // 1 hour
                    blockDuration: 3600 // 1 hour
                };
            }
            // Customize limits based on plan
            switch (userPlan.plan.name) {
                case 'free':
                    return {
                        points: 50,
                        duration: 3600, // 1 hour
                        blockDuration: 3600
                    };
                case 'pro':
                    return {
                        points: 200,
                        duration: 3600, // 1 hour
                        blockDuration: 1800 // 30 minutes
                    };
                case 'business':
                    return {
                        points: 1000,
                        duration: 3600, // 1 hour
                        blockDuration: 900 // 15 minutes
                    };
                default:
                    return {
                        points: 50,
                        duration: 3600,
                        blockDuration: 3600
                    };
            }
        }
        catch (error) {
            console.error('Error getting rate limit config:', error);
            // Fallback to conservative limits
            return {
                points: 10,
                duration: 3600,
                blockDuration: 3600
            };
        }
    }
    /**
     * Check if user has exceeded rate limit
     */
    static async checkRateLimit(userId) {
        try {
            const config = await this.getRateLimitConfig(userId);
            const key = `user:${userId}`;
            // Get or create rate limiter for this user
            let limiter = this.limiters.get(key);
            if (!limiter) {
                limiter = new rate_limiter_flexible_1.RateLimiterMemory({
                    points: config.points,
                    duration: config.duration,
                    blockDuration: config.blockDuration
                });
                this.limiters.set(key, limiter);
            }
            // Consume one point
            const result = await limiter.consume(key);
            return {
                allowed: true,
                remaining: result.remainingPoints,
                resetTime: new Date(Date.now() + result.msBeforeNext)
            };
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Rate limiter')) {
                // Rate limit exceeded
                return {
                    allowed: false,
                    remaining: 0
                };
            }
            console.error('Rate limiter error:', error);
            // Allow request on error (fail open)
            return {
                allowed: true,
                remaining: 1
            };
        }
    }
    /**
     * Get remaining requests for user
     */
    static async getRemainingRequests(userId) {
        try {
            const config = await this.getRateLimitConfig(userId);
            const key = `user:${userId}`;
            const limiter = this.limiters.get(key);
            if (!limiter) {
                return {
                    remaining: config.points,
                    resetTime: new Date(Date.now() + config.duration * 1000)
                };
            }
            const result = await limiter.get(key);
            return {
                remaining: result ? result.remainingPoints : config.points,
                resetTime: result ? new Date(Date.now() + result.msBeforeNext) : undefined
            };
        }
        catch (error) {
            console.error('Error getting remaining requests:', error);
            return {
                remaining: 0
            };
        }
    }
    /**
     * Reset rate limit for user (admin function)
     */
    static async resetRateLimit(userId) {
        const key = `user:${userId}`;
        const limiter = this.limiters.get(key);
        if (limiter) {
            await limiter.delete(key);
            this.limiters.delete(key);
        }
    }
    /**
     * Clean up old limiters (call periodically)
     */
    static cleanup() {
        // Remove limiters that haven't been used for a while
        // For now, we'll use a simple approach - in production you might want more sophisticated logic
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        // Clear all limiters periodically (simplified approach)
        this.limiters.clear();
    }
}
exports.RateLimiterService = RateLimiterService;
RateLimiterService.limiters = new Map();
//# sourceMappingURL=rateLimiter.js.map