import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

/**
 * Middleware to enforce idempotency using Redis
 * Looks for 'x-idempotency-key' header.
 */
export const idempotency = async (req, res, next) => {
    const key = req.headers['x-idempotency-key'];

    if (!key) {
        return next(); // If no key provided, proceed without idempotency (or could be strict if required)
    }

    const userId = req.user ? req.user._id.toString() : 'guest';
    const redisKey = `idempotency:${userId}:${key}`;

    try {
        // Check if key exists
        const cachedResponse = await redisClient.get(redisKey);

        if (cachedResponse) {
            console.log(`[IDEMPOTENCY] Cache hit for ${redisKey}`);
            const { statusCode, body } = JSON.parse(cachedResponse);
            return res.status(statusCode).json(body);
        }

        // Intercept res.json to cache the response
        const originalJson = res.json;
        res.json = function (body) {
            // Only cache successful or 4xx responses, maybe avoid caching 5xx?
            if (res.statusCode < 500) {
                redisClient.set(
                    redisKey,
                    JSON.stringify({ statusCode: res.statusCode, body }),
                    'EX',
                    24 * 60 * 60 // 24 hours expiry
                ).catch(err => console.error('[IDEMPOTENCY] Redis set error:', err));
            }

            return originalJson.call(this, body);
        };

        next();
    } catch (error) {
        console.error('[IDEMPOTENCY] Middleware error:', error);
        next();
    }
};
