import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient = new Redis(process.env.REDIS_URL, {
    tls: {
        rejectUnauthorized: false,
    },
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        if (times > 3) {
            console.error('[Redis] Max retries reached. Giving up.');
            return null;
        }
        return Math.min(times * 200, 1000);
    },
    lazyConnect: false,
});

redisClient.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
});

redisClient.on('connect', () => {
    console.log('[Redis] Connected to Upstash successfully.');
});

// Tier 1: Auth endpoints (strictest)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per 15 mins
    message: { error: 'Too many attempts, please try again in 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: 'rl:auth:'
    }),
});

// Tier 2: General API (standard)
export const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: { error: 'Rate limit exceeded. Max 60 requests per minute.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: 'rl:api:'
    }),
});

// Tier 3: Withdrawal/Transfer endpoints (extra strict)
export const transferLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10, // 10 transfers per minute max
    message: { error: 'Transfer rate limit exceeded.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: 'rl:transfer:'
    }),
});

// Tier 4: Merchant/Developer API (higher limits)
export const merchantLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120, // 120 requests per minute
    message: { error: 'Merchant rate limit exceeded.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: 'rl:merchant:'
    }),
});
