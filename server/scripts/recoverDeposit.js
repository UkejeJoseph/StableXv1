import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const SECRET_KEY = process.env.KORAPAY_SECRET_KEY;
const WEBHOOK_URL = 'https://stablexv1-production.up.railway.app/webhook/korapay';

async function recoverDeposit() {
    console.log('\n[RECOVERY] ══════════════════════════════════');

    // The exact reference the user paid for
    const data = {
        reference: 'STX-KPY-1772395637670-69a49c60630b40f056f9df1f',
        amount: 1000,
        currency: 'NGN',
        status: 'success'
    };

    console.log('[RECOVERY] Sending event: charge.success for', data.reference);

    const payload = { event: 'charge.success', data };

    // Generate valid signature
    const signature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(JSON.stringify(data))
        .digest('hex');

    try {
        const res = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-korapay-signature': signature,
            },
            body: JSON.stringify(payload),
        });

        console.log('[RECOVERY] Response status:', res.status);
        const body = await res.json();
        console.log('[RECOVERY] Response body:', JSON.stringify(body));
        console.log('[RECOVERY] ✅ Webhook fired. Check Railway logs to ensure it credited successfully.');
    } catch (err) {
        console.error('[RECOVERY] Fetch failed:', err.message);
    }
}

recoverDeposit();
