// ──────────────────────────────────────────────────────────────
// Interswitch Payouts Service
// Handles Fiat Withdrawals (Bank Transfers) & Account Name Inquiry
// ──────────────────────────────────────────────────────────────
import { CONFIG, URLS, getAccessToken } from './interswitchConfig.js';
import crypto from 'crypto';

// Use same base URL as Collections for Quickteller Business APIs (which handle payouts)
const getBaseUrl = () => {
    // Interswitch QA / Live base for payouts
    // Often it lands on qa.interswitchng.com/api/v1/payouts or similar
    const baseUrl = URLS.COLLECTIONS;
    return baseUrl;
};

// Use Quickteller Service base URL for Name Enquiry and Bank Codes
const getQuicktellerBaseUrl = () => {
    return IS_LIVE
        ? 'https://quicktellerservice.interswitchng.com'
        : 'https://qa.interswitchng.com/quicktellerservice';
};

/**
 * Get Receiving Institutions (Banks)
 * GET /api/v5/configuration/fundstransferbanks
 */
export async function getReceivingInstitutions() {
    console.log('[ISW:Payout] 🏦 Fetching Receiving Institutions via Quickteller v5...');

    // Auth for these specific endpoints uses older Basic Auth with TerminalID
    const credentials = Buffer.from(`${CONFIG.clientId}:${CONFIG.clientSecret}`).toString('base64');
    const url = `${getQuicktellerBaseUrl()}/api/v5/configuration/fundstransferbanks`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'TerminalID': CONFIG.terminalId,
            'accept': 'application/json'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[ISW:Payout] ❌ Error fetching banks:', errorText);
        return { ok: false, status: response.status, error: errorText };
    }

    const data = await response.json();
    // The v5 API returns a 'banks' array with cbnCode and bankName
    return { ok: true, data: data.banks || data };
}

/**
 * Account Name Inquiry
 * POST /api/v5/Transactions/DoAccountNameInquiry
 */
export async function verifyBankAccount(bankCode, accountId) {
    console.log(`[ISW:Payout] 🔍 Verifying Account: ${accountId} at ${bankCode}`);

    const credentials = Buffer.from(`${CONFIG.clientId}:${CONFIG.clientSecret}`).toString('base64');
    const url = `${getQuicktellerBaseUrl()}/api/v5/Transactions/DoAccountNameInquiry`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'TerminalID': CONFIG.terminalId,
            'Content-Type': 'application/json',
            'accept': 'application/json',
            // Per docs, these are passed as headers, not in body
            'accountid': accountId,
            'bankcode': bankCode
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[ISW:Payout] ❌ Account Verification Failed:', errorText);
        return { ok: false, status: response.status, error: errorText };
    }

    const data = await response.json();
    return { ok: true, data };
}

/**
 * Initiate Bank Transfer Payout
 * POST /api/v1/payouts/bank-transfer
 */
export async function initiateBankPayout({ amount, bankCode, accountNumber, beneficiaryName, narration, transactionRef }) {
    console.log(`[ISW:Payout] 💸 Initiating Payout to ${accountNumber} (${bankCode})`);
    const token = await getAccessToken();
    const url = `${getBaseUrl()}/api/v1/payouts/bank-transfer`;

    const payload = {
        amount: Math.round(parseFloat(amount) * 100).toString(), // Usually specified in minor denomination or exactly as documented
        currencyCode: "NGN",
        narration: narration || "StableX Withdrawal",
        transactionRef: transactionRef,
        recipient: {
            recipientAccount: accountNumber,
            recipientBank: bankCode,
            recipientName: beneficiaryName
        }
    };

    console.log('[ISW:Payout] 📤 Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[ISW:Payout] ❌ Payout Request Failed:', errorText);
        // We will return structured error for the controller to handle refund logic
        return { ok: false, status: response.status, error: errorText };
    }

    const data = await response.json();
    return { ok: true, data };
}
