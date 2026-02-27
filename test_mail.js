
import dotenv from 'dotenv';
import { sendOtpEmail } from './server/utils/mailService.js';

dotenv.config();

async function testEmail() {
    console.log('Testing email sending to ukejejoseph1@gmail.com...');
    const start = Date.now();
    try {
        const info = await sendOtpEmail('ukejejoseph1@gmail.com', '123456');
        const end = Date.now();
        console.log(`Done! Took ${end - start}ms`);
        console.log('Result:', info ? 'Success' : 'Failed (check console)');
    } catch (err) {
        console.error('Test script error:', err);
    }
}

testEmail();
