// ──────────────────────────────────────────────────────────────
// Card Deposit Service
// Handles: Initiate Payment, OTP Auth, 3DS Auth, Refunds
// Docs: https://docs.interswitchgroup.com/reference/card-payment-api
// ──────────────────────────────────────────────────────────────
import { URLS, IS_LIVE, getAccessToken } from './interswitchConfig.js';

/**
 * Initiate a card payment charge.
 * POST {COLLECTIONS}/api/v3/purchases
 */
export async function initiateCardPayment({ customerId, amount, currency, authData, transactionRef, deviceInformation }) {
    const token = await getAccessToken();
    const url = `${URLS.COLLECTIONS}/api/v3/purchases`;

    const payload = {
        customerId,
        amount: String(amount),
        currency: currency || 'NGN',
        authData,
        transactionRef,
        ...(deviceInformation && { deviceInformation }),
    };

    console.log('[SVC:Card] ──────────────────────────────────');
    console.log('[SVC:Card] 📤 PAYLOAD SENT to:', url);
    console.log('[SVC:Card] Environment:', IS_LIVE ? '🔴 LIVE' : '🟢 TEST');
    console.log('[SVC:Card] Payload:', JSON.stringify(payload, null, 2));
    console.log('[SVC:Card] Headers: Authorization: Bearer *****, Content-Type: application/json');

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json();

    console.log('[SVC:Card] 📥 RESPONSE RECEIVED');
    console.log('[SVC:Card] HTTP Status:', response.status);
    console.log('[SVC:Card] Response Body:', JSON.stringify(data, null, 2));
    console.log('[SVC:Card] ──────────────────────────────────');

    return { status: response.status, ok: response.ok, data };
}

/**
 * Authenticate OTP for a card transaction.
 * POST {COLLECTIONS}/api/v3/purchases/otps/auths
 */
export async function authenticateOtp({ paymentId, otp, transactionRef }) {
    const token = await getAccessToken();
    const url = `${URLS.COLLECTIONS}/api/v3/purchases/otps/auths`;

    const payload = { paymentId, otp, transactionRef };

    console.log('[SVC:OTP] ──────────────────────────────────');
    console.log('[SVC:OTP] 📤 PAYLOAD SENT to:', url);
    console.log('[SVC:OTP] Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json();

    console.log('[SVC:OTP] 📥 RESPONSE RECEIVED');
    console.log('[SVC:OTP] HTTP Status:', response.status);
    console.log('[SVC:OTP] Response Body:', JSON.stringify(data, null, 2));
    console.log('[SVC:OTP] ──────────────────────────────────');

    return { status: response.status, ok: response.ok, data };
}

/**
 * Authorize a 3D Secure challenge.
 * POST {COLLECTIONS}/api/v3/purchases/otps/auths/
 */
export async function authorize3DSecure({ transactionId, eciFlag }) {
    const token = await getAccessToken();
    const url = `${URLS.COLLECTIONS}/api/v3/purchases/otps/auths/`;

    const payload = { transactionId, eciFlag };

    console.log('[SVC:3DS] ──────────────────────────────────');
    console.log('[SVC:3DS] 📤 PAYLOAD SENT to:', url);
    console.log('[SVC:3DS] Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json();

    console.log('[SVC:3DS] 📥 RESPONSE RECEIVED');
    console.log('[SVC:3DS] HTTP Status:', response.status);
    console.log('[SVC:3DS] Response Body:', JSON.stringify(data, null, 2));
    console.log('[SVC:3DS] ──────────────────────────────────');

    return { status: response.status, ok: response.ok, data };
}

/**
 * Create a refund for a completed transaction.
 * POST {COLLECTIONS}/api/v3/purchases/refunds
 */
export async function createRefund({ transactionRef, amount, refundRef }) {
    const token = await getAccessToken();
    const url = `${URLS.COLLECTIONS}/api/v3/purchases/refunds`;

    const payload = {
        primaryTransactionRef: transactionRef,
        refundAmount: String(amount),
        refundRef,
    };

    console.log('[SVC:Refund] ──────────────────────────────────');
    console.log('[SVC:Refund] 📤 PAYLOAD SENT to:', url);
    console.log('[SVC:Refund] Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json();

    console.log('[SVC:Refund] 📥 RESPONSE RECEIVED');
    console.log('[SVC:Refund] HTTP Status:', response.status);
    console.log('[SVC:Refund] Response Body:', JSON.stringify(data, null, 2));
    console.log('[SVC:Refund] ──────────────────────────────────');

    return { status: response.status, ok: response.ok, data };
}
