import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import redisClient from '../config/redis.js';

const sendCommandMock = (command, windowMs) => {
    // console.warn(`[RateLimit] Using mock for command: ${command}`);
    if (command === 'SCRIPT') return "mock_sha";
    return [1, windowMs || 60000];
};

const createWrappedStore = (prefix, windowMs) => {
    return new RedisStore({
        sendCommand: async function (...args) {
            // Defensively handle command extraction
            if (!args || args.length === 0) return [1, windowMs || 60000];

            const cmd = args[0];
            try {
                if (redisClient.status === 'ready' || redisClient.status === 'connecting') {
                    return await redisClient.call(...args);
                }
            } catch (err) {
                // Silently fail-open
            }

            return sendCommandMock(cmd, windowMs);
        },
        prefix: `rl:${prefix}:`
    });
};

const createWrappedLimiter = ({ windowMs, max, message, prefix }) => {
    return rateLimit({
        windowMs,
        max,
        message: message || { error: 'Too many requests, please slow down.' },
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => {
            // Fix 4: Remove ALL rate limiting from /api/users/profile specifically
            return req.originalUrl && req.originalUrl.includes('/api/users/profile');
        },
        handler: (req, res, next, options) => {
            res.status(429).json(options.message);
        },
        store: createWrappedStore(prefix, windowMs),
    });
};

// Tier 1: Auth endpoints (strictest)
export const authLimiter = createWrappedLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many attempts, please try again in 15 minutes' },
    prefix: 'auth',
});

// Tier 2: General API (standard)
export const apiLimiter = createWrappedLimiter({
    windowMs: 60 * 1000,
    max: 60,
    message: { error: 'Rate limit exceeded. Max 60 requests per minute.' },
    prefix: 'api',
});

// Tier 3: Withdrawal/Transfer endpoints (extra strict)
export const transferLimiter = createWrappedLimiter({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Transfer rate limit exceeded.' },
    prefix: 'transfer',
});

// Tier 4: Merchant/Developer API (higher limits)
export const merchantLimiter = createWrappedLimiter({
    windowMs: 60 * 1000,
    max: 120,
    message: { error: 'Merchant rate limit exceeded.' },
    prefix: 'merchant',
});
