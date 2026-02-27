// ──────────────────────────────────────────────────────────────
// Transaction Status Service (Shared across ALL deposit channels)
// Docs: https://docs.interswitchgroup.com/reference/get-transaction-status
// ──────────────────────────────────────────────────────────────
import { URLS, IS_LIVE, getAccessToken } from './interswitchConfig.js';

/**
 * Get the status of a transaction.
 * GET {COLLECTIONS}/api/v3/purchases
 *
 * IMPORTANT: Per Interswitch docs, `transactionRef` and `amount`
 * are sent as HTTP HEADERS, not query parameters.
 */
export async function getTransactionStatus(transactionRef, amount) {
    const token = await getAccessToken();
    const url = `${URLS.COLLECTIONS}/api/v3/purchases`;

    const headers = {
        'Authorization': `Bearer ${token}`,
        'transactionRef': transactionRef,
        'amount': String(amount),
    };

    console.log('[SVC:Status] ──────────────────────────────────');
    console.log('[SVC:Status] 📤 GET REQUEST to:', url);
    console.log('[SVC:Status] Environment:', IS_LIVE ? '🔴 LIVE' : '🟢 TEST');
    console.log('[SVC:Status] Headers sent:');
    console.log('[SVC:Status]   Authorization: Bearer *****');
    console.log('[SVC:Status]   transactionRef:', transactionRef);
    console.log('[SVC:Status]   amount:', amount);

    const startTime = Date.now();

    const response = await fetch(url, {
        method: 'GET',
        headers,
    });

    const elapsed = Date.now() - startTime;
    const data = await response.json();
    const isSuccess = data.responseCode === '00';

    console.log('[SVC:Status] 📥 RESPONSE RECEIVED (took ' + elapsed + 'ms)');
    console.log('[SVC:Status] HTTP Status:', response.status);
    console.log('[SVC:Status] Response Body:', JSON.stringify(data, null, 2));
    console.log('[SVC:Status] responseCode:', data.responseCode);
    console.log('[SVC:Status] message:', data.message || data.responseDescription || 'N/A');
    console.log('[SVC:Status] SUCCESS:', isSuccess ? '✅ YES' : '❌ NO');
    console.log('[SVC:Status] ──────────────────────────────────');

    return {
        status: response.status,
        ok: response.ok,
        success: isSuccess,
        data,
    };
}

/**
 * Validates a transaction before crediting wallet.
 * Ensures all safety checks pass.
 */
export function validateForWalletCredit(transaction, statusData) {
    console.log('[SVC:Validate] 🔐 Running wallet credit validation...');
    console.log('[SVC:Validate] Transaction:', transaction ? 'Found in DB' : '❌ NOT FOUND');

    if (!transaction) {
        console.log('[SVC:Validate] ❌ FAIL: Transaction reference not found in database');
        return { valid: false, reason: 'Transaction reference not found in database' };
    }

    if (transaction.status === 'credited' || transaction.status === 'completed') {
        console.log('[SVC:Validate] ❌ FAIL: Already credited (duplicate). Status:', transaction.status);
        return { valid: false, reason: 'Transaction already credited (duplicate)' };
    }

    if (statusData.responseCode !== '00') {
        console.log('[SVC:Validate] ❌ FAIL: Not successful. Code:', statusData.responseCode);
        return { valid: false, reason: `Transaction not successful: ${statusData.responseCode} - ${statusData.message || statusData.responseDescription}` };
    }

    if (transaction.expectedAmount && String(transaction.expectedAmount) !== String(statusData.amount)) {
        console.log('[SVC:Validate] ❌ FAIL: Amount mismatch. Expected:', transaction.expectedAmount, 'Got:', statusData.amount);
        return { valid: false, reason: `Amount mismatch: expected ${transaction.expectedAmount}, got ${statusData.amount}` };
    }

    console.log('[SVC:Validate] ✅ All checks passed. Safe to credit wallet.');
    return { valid: true };
}
