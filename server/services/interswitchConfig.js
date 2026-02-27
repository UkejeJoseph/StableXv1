// ──────────────────────────────────────────────────────────────
// Interswitch Centralized Configuration & Token Management
// Environment-driven: INTERSWITCH_MODE=TEST|LIVE in .env
// ──────────────────────────────────────────────────────────────

const IS_LIVE = process.env.INTERSWITCH_MODE === 'LIVE';

// ── URL Configuration ───────────────────────────────────────
// Per Interswitch docs:
//   QA/Sandbox : qa.interswitchng.com
//   Production : passport.interswitchng.com (OAuth), webpay.interswitchng.com (Collections)
//   Virtual Acct: payment-service.k8.isw.la (both environments)
const URLS = {
    PASSPORT: IS_LIVE
        ? 'https://passport.interswitchng.com'
        : 'https://qa.interswitchng.com',

    COLLECTIONS: IS_LIVE
        ? 'https://webpay.interswitchng.com'
        : 'https://qa.interswitchng.com',

    VIRTUAL_ACCOUNT: 'https://payment-service.k8.isw.la',

    CHECKOUT_SCRIPT: IS_LIVE
        ? 'https://newwebpay.interswitchng.com/inline-checkout.js'
        : 'https://newwebpay.qa.interswitchng.com/inline-checkout.js',
};

// ── Merchant Config ─────────────────────────────────────────
const CONFIG = {
    clientId: process.env.INTERSWITCH_CLIENT_ID,
    clientSecret: process.env.INTERSWITCH_CLIENT_SECRET,
    merchantCode: process.env.INTERSWITCH_MERCHANT_CODE || 'MX6072',
    payItemId: process.env.INTERSWITCH_PAY_ITEM_ID || '9405967',
    terminalId: process.env.INTERSWITCH_TERMINAL_ID || '3PBL0001',
    initiatingEntityCode: process.env.INTERSWITCH_ENTITY_CODE || 'PBL',
};

// ── OAuth2 Token Management ────────────────────────────────
let accessToken = null;
let tokenExpiry = null;

async function getAccessToken() {
    // Return cached token if still valid
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
        return accessToken;
    }

    if (!CONFIG.clientId || !CONFIG.clientSecret) {
        throw new Error('Missing INTERSWITCH_CLIENT_ID or INTERSWITCH_CLIENT_SECRET in .env');
    }

    const credentials = Buffer.from(
        `${CONFIG.clientId}:${CONFIG.clientSecret}`
    ).toString('base64');

    console.log(`[ISW] Requesting access token from ${URLS.PASSPORT} (${IS_LIVE ? 'LIVE' : 'TEST'} mode)...`);

    const response = await fetch(`${URLS.PASSPORT}/passport/oauth/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Interswitch token generation failed (${response.status}): ${error}`);
    }

    const data = await response.json();
    accessToken = data.access_token;
    // Refresh 60 seconds before actual expiry
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;

    console.log(`[ISW] Access token obtained. Expires in ${data.expires_in}s. Merchant: ${data.merchant_code || 'N/A'}`);
    return accessToken;
}

// Force-clear cached token (useful after errors)
function clearTokenCache() {
    accessToken = null;
    tokenExpiry = null;
}

export { URLS, CONFIG, IS_LIVE, getAccessToken, clearTokenCache };
