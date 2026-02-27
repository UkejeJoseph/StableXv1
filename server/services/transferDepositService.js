// ──────────────────────────────────────────────────────────────
// Bank Transfer (Virtual Account) Deposit Service
// Docs: https://docs.interswitchgroup.com/reference/pay-with-transfer-virtual-accounts
// ──────────────────────────────────────────────────────────────
import { URLS, CONFIG, IS_LIVE, getAccessToken } from './interswitchConfig.js';

/**
 * Create a virtual account for bank transfer deposit.
 * POST {VIRTUAL_ACCOUNT_BASE}/paymentgateway/api/v1/virtualaccounts/transaction
 */
export async function createVirtualAccount({ amount, transactionReference, accountName, currencyCode }) {
    const token = await getAccessToken();
    const url = `${URLS.VIRTUAL_ACCOUNT}/paymentgateway/api/v1/virtualaccounts/transaction`;

    const payload = {
        merchantCode: CONFIG.merchantCode,
        payableCode: CONFIG.payItemId,
        currencyCode: currencyCode || '566',
        amount: String(amount),
        accountName: accountName || 'StableX Customer',
        transactionReference,
    };

    console.log('[SVC:Transfer] ──────────────────────────────────');
    console.log('[SVC:Transfer] 📤 PAYLOAD SENT to:', url);
    console.log('[SVC:Transfer] Environment:', IS_LIVE ? '🔴 LIVE' : '🟢 TEST');
    console.log('[SVC:Transfer] Merchant Code:', CONFIG.merchantCode);
    console.log('[SVC:Transfer] Payable Code:', CONFIG.payItemId);
    console.log('[SVC:Transfer] Payload:', JSON.stringify(payload, null, 2));
    console.log('[SVC:Transfer] Headers: Authorization: Bearer *****, Content-Type: application/json');

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

    console.log('[SVC:Transfer] 📥 RESPONSE RECEIVED (took ' + elapsed + 'ms)');
    console.log('[SVC:Transfer] HTTP Status:', response.status);
    console.log('[SVC:Transfer] Response Body:', JSON.stringify(data, null, 2));
    if (data.accountNumber) {
        console.log('[SVC:Transfer] ✅ Account Number:', data.accountNumber);
        console.log('[SVC:Transfer] ✅ Bank Name:', data.bankName);
    }
    console.log('[SVC:Transfer] ──────────────────────────────────');

    return { status: response.status, ok: response.ok, data };
}
