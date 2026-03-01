import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const SECRET_KEY = process.env.KORAPAY_SECRET_KEY;
const WEBHOOK_URL = 'https://stablexv1-production.up.railway.app/webhook/korapay';

async function sendTestWebhook(eventType, data) {
    console.log('\n[TEST] ══════════════════════════════════');
    console.log('[TEST] Sending event:', eventType);
    console.log('[TEST] Data:', JSON.stringify(data));

    const payload = { event: eventType, data };

    // Generate valid signature
    const signature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(JSON.stringify(data))
        .digest('hex');

    console.log('[TEST] Signature:', signature);

    try {
        const res = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-korapay-signature': signature,
            },
            body: JSON.stringify(payload),
        });

        console.log('[TEST] Response status:', res.status);
        const body = await res.json();
        console.log('[TEST] Response body:', JSON.stringify(body));
    } catch (err) {
        console.error('[TEST] Fetch failed:', err.message);
    }
}

// Test 1: charge.success (normal checkout deposit)
console.log('--- Test 1: charge.success ---');
await sendTestWebhook('charge.success', {
    reference: `STX-DEP-TEST-${Date.now()}`,
    amount: 5000,
    currency: 'NGN',
    status: 'success',
    fee: 25,
});

// Wait 2s between tests
await new Promise(r => setTimeout(r, 2000));

// Test 2: Same reference again (idempotency test - should be blocked)
console.log('\n[TEST] Sending DUPLICATE - should be blocked by idempotency');
await sendTestWebhook('charge.success', {
    reference: 'STX-DEP-DUPLICATE-TEST',
    amount: 5000,
    currency: 'NGN',
    status: 'success',
});

await new Promise(r => setTimeout(r, 2000));

// Test 3: Forged webhook (invalid signature - should be rejected)
console.log('\n[TEST] Sending FORGED webhook - should be rejected');
const fakePayload = {
    event: 'charge.success',
    data: { reference: 'FAKE-REF', amount: 999999, currency: 'NGN', status: 'success' }
};
try {
    const forgedRes = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-korapay-signature': 'fakesignature123',
        },
        body: JSON.stringify(fakePayload),
    });
    const forgedBody = await forgedRes.json();
    console.log('[TEST] Forged response:', forgedBody);
} catch (err) {
    console.error('[TEST] Forged fetch failed:', err.message);
}

await new Promise(r => setTimeout(r, 2000));

// Test 4: transfer.failed (should refund user)
await sendTestWebhook('transfer.failed', {
    reference: `STX-WDR-TEST-${Date.now()}`,
    amount: 2000,
    currency: 'NGN',
    status: 'failed',
});

console.log('\n[TEST] ✅ All tests sent. Check Railway logs for results.');
process.exit(0);
