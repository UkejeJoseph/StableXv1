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
        // Use SETNX for atomic pre-execution locking to prevent concurrent double-clicks
        const isNewKey = await redisClient.setnx(redisKey, JSON.stringify({ status: 'processing' }));

        if (isNewKey === 1) {
            // Successfully locked. Set TTL just in case node crashes to prevent infinite lock.
            await redisClient.expire(redisKey, 24 * 60 * 60);
        } else {
            // Key already exists (either processing or completed)
            const cachedResponse = await redisClient.get(redisKey);
            if (!cachedResponse) {
                // Rare race condition where TTL expired right between setnx and get
                return res.status(500).json({ error: 'Idempotency state error' });
            }

            const parsed = JSON.parse(cachedResponse);
            if (parsed.status === 'processing') {
                return res.status(409).json({ error: 'Request is already processing. Please wait.' });
            }

            console.log(`[IDEMPOTENCY] Cache hit for ${redisKey}`);
            return res.status(parsed.statusCode).json(parsed.body);
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
