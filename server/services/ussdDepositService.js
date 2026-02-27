// ──────────────────────────────────────────────────────────────
// USSD Deposit Service
// Docs: https://docs.interswitchgroup.com/reference/pay-with-ussd
// ──────────────────────────────────────────────────────────────
import { URLS, IS_LIVE, getAccessToken } from './interswitchConfig.js';

/**
 * Initiate a USSD payment.
 * POST {COLLECTIONS}/collections/api/v1/sdk/ussd/generate
 */
export async function initiateUssdPayment({ amount, bankCode, surcharge, currencyCode, merchantTransactionReference }) {
    const token = await getAccessToken();
    const url = `${URLS.COLLECTIONS}/collections/api/v1/sdk/ussd/generate`;

    const payload = {
        amount: String(amount),
        bankCode,
        surcharge: surcharge || '0',
        currencyCode: currencyCode || '566',
        merchantTransactionReference,
    };

    console.log('[SVC:USSD] ──────────────────────────────────');
    console.log('[SVC:USSD] 📤 PAYLOAD SENT to:', url);
    console.log('[SVC:USSD] Environment:', IS_LIVE ? '🔴 LIVE' : '🟢 TEST');
    console.log('[SVC:USSD] Payload:', JSON.stringify(payload, null, 2));
    console.log('[SVC:USSD] Headers: Authorization: Bearer *****, Content-Type: application/json');

    const startTime = Date.now();

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const elapsed = Date.now() - startTime;
    const data = await response.json();

    console.log('[SVC:USSD] 📥 RESPONSE RECEIVED (took ' + elapsed + 'ms)');
    console.log('[SVC:USSD] HTTP Status:', response.status);
    console.log('[SVC:USSD] Response Body:', JSON.stringify(data, null, 2));
    if (data.ussdString) {
        console.log('[SVC:USSD] ✅ USSD String:', data.ussdString);
    }
    console.log('[SVC:USSD] ──────────────────────────────────');

    return { status: response.status, ok: response.ok, data };
}

/**
 * Get list of banks that support USSD payments.
 * GET {COLLECTIONS}/collections/api/v1/sdk/ussd/banks
 */
export async function getUssdBanks() {
    const token = await getAccessToken();
    const url = `${URLS.COLLECTIONS}/collections/api/v1/sdk/ussd/banks`;

    console.log('[SVC:USSD] ──────────────────────────────────');
    console.log('[SVC:USSD] 📤 GET REQUEST to:', url);
    console.log('[SVC:USSD] Headers: Authorization: Bearer *****');

    const startTime = Date.now();

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    const elapsed = Date.now() - startTime;
    const data = await response.json();

    console.log('[SVC:USSD] 📥 RESPONSE RECEIVED (took ' + elapsed + 'ms)');
    console.log('[SVC:USSD] HTTP Status:', response.status);
    console.log('[SVC:USSD] Banks count:', Array.isArray(data) ? data.length : 'N/A');
    console.log('[SVC:USSD] Response Body:', JSON.stringify(data, null, 2));
    console.log('[SVC:USSD] ──────────────────────────────────');

    return { status: response.status, ok: response.ok, data };
}
