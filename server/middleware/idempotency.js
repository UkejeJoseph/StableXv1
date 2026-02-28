import redisClient from '../config/redis.js';

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
        // Use SETNX for atomic pre-execution locking
        let isNewKey = 0;
        try {
            if (redisClient.status === 'ready' || redisClient.status === 'connecting') {
                isNewKey = await redisClient.setnx(redisKey, JSON.stringify({ status: 'processing' }));
            }
        } catch (err) {
            console.warn(`[IDEMPOTENCY] Redis error (fail-open): ${err.message}`);
            return next();
        }

        if (isNewKey === 1) {
            // Successfully locked. Set TTL.
            await redisClient.expire(redisKey, 24 * 60 * 60).catch(() => { });
        } else if (redisClient.status === 'ready') {
            // Key already exists
            const cachedResponse = await redisClient.get(redisKey);
            if (cachedResponse) {
                const parsed = JSON.parse(cachedResponse);
                if (parsed.status === 'processing') {
                    return res.status(409).json({ error: 'Request is already processing. Please wait.' });
                }
                console.log(`[IDEMPOTENCY] Cache hit for ${redisKey}`);
                return res.status(parsed.statusCode).json(parsed.body);
            }
        }

        // Intercept res.json to cache the response
        const originalJson = res.json;
        res.json = function (body) {
            if (res.statusCode < 500 && redisClient.status === 'ready') {
                redisClient.set(
                    redisKey,
                    JSON.stringify({ statusCode: res.statusCode, body }),
                    'EX',
                    24 * 60 * 60
                ).catch(() => { });
            }
            return originalJson.call(this, body);
        };

        next();
    } catch (error) {
        console.error('[IDEMPOTENCY] Middleware caught error:', error);
        next();
    }
};
