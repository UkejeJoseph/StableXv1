import fetch from 'node-fetch';

const RELOADLY_BASE_URL = 'https://giftcards.reloadly.com';

/**
 * Get Reloadly OAuth access token
 */
export const getReloadlyToken = async () => {
    const res = await fetch('https://auth.reloadly.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: process.env.RELOADLY_CLIENT_ID,
            client_secret: process.env.RELOADLY_CLIENT_SECRET,
            grant_type: 'client_credentials',
            audience: RELOADLY_BASE_URL,
        }),
    });
    const data = await res.json();
    if (!data.access_token) throw new Error('Reloadly auth failed: ' + JSON.stringify(data));
    return data.access_token;
};

/**
 * Get available gift cards for a country
 */
export const getGiftCards = async (countryCode = 'NG') => {
    const token = await getReloadlyToken();
    const res = await fetch(
        `${RELOADLY_BASE_URL}/products?countryCode=${countryCode}&size=50`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/com.reloadly.giftcards-v1+json',
            },
        }
    );
    return await res.json();
};

/**
 * Purchase a gift card via Reloadly
 */
export const purchaseGiftCardFromReloadly = async ({ productId, quantity, unitPrice, recipientEmail }) => {
    const token = await getReloadlyToken();
    const res = await fetch(`${RELOADLY_BASE_URL}/orders`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/com.reloadly.giftcards-v1+json',
        },
        body: JSON.stringify({
            productId,
            quantity,
            unitPrice,
            recipientEmail,
            customIdentifier: `stablex_${Date.now()}`,
        }),
    });
    return await res.json();
};
