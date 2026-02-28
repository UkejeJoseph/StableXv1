import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient = new Redis(process.env.REDIS_URL, {
    tls: { rejectUnauthorized: false },
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
        if (times > 2) return null;
        return Math.min(times * 200, 1000);
    },
    lazyConnect: true,
});

redisClient.on('error', (err) => {
    console.warn('[Redis] Connection error:', err.message);
    // Do NOT throw — just log and continue
});

export default redisClient;
