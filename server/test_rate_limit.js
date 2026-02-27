import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
import axios from 'axios';

async function testRateLimit() {
    const baseUrl = `http://localhost:${process.env.PORT || 5000}`;
    console.log(`Testing rate limit on ${baseUrl}/api/users/login`);

    for (let i = 1; i <= 12; i++) {
        try {
            const res = await axios.post(`${baseUrl}/api/users/login`, {
                email: 'test@example.com',
                password: 'wrongpassword'
            }, { validateStatus: false });

            console.log(`Request ${i}: Status ${res.status}`);
            if (res.status === 429) {
                console.log('✅ Rate limit hit (429)!');
                return;
            }
        } catch (err) {
            console.log(`Request ${i}: Error ${err.message}`);
        }
    }
    console.log('❌ Rate limit NOT hit after 12 requests.');
}

// Note: This requires the server to be running.
// Since Check 2 failed to start the server due to missing dependency,
// I will first check the code logic and then report.
// Actually, I can check the Redis connection log if I fix the server startup.
// But the prompt says NO code changes.
// I'll check the code logic in rateLimiter.js first.
