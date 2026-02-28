const counters = {};

const LIMITS = {
    trongrid: 100000,
    tronscan: 100000,
    infura: 300000,
    helius: 1000000,
    blockcypher: 100000,
    blockstream: 500000,
    publicnode: 500000,
};

// Reset daily at midnight
const scheduleReset = () => {
    const now = new Date();
    const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0, 0, 0
    );
    setTimeout(() => {
        Object.keys(counters).forEach(k => {
            counters[k] = 0;
        });
        console.log('[API TRACKER] ✅ Daily counters reset');
        scheduleReset();
    }, midnight - now);
};
scheduleReset();

export const trackApiCall = (provider) => {
    if (!counters[provider]) counters[provider] = 0;
    counters[provider]++;

    const limit = LIMITS[provider];
    if (!limit) return;

    const pct = Math.round(counters[provider] / limit * 100);
    if (pct === 80) {
        console.warn(
            `[API TRACKER] ⚠️ ${provider} at 80% daily budget ` +
            `(${counters[provider]}/${limit})`
        );
    }
    if (counters[provider] >= limit) {
        console.error(
            `[API TRACKER] 🚨 ${provider} daily limit reached! ` +
            `(${counters[provider]}/${limit}) — rotate provider`
        );
    }
};

export const getApiStats = () => {
    return Object.keys(LIMITS).map(provider => ({
        provider,
        used: counters[provider] || 0,
        limit: LIMITS[provider],
        remaining: LIMITS[provider] - (counters[provider] || 0),
        pct: Math.round((counters[provider] || 0) / LIMITS[provider] * 100)
    }));
};
