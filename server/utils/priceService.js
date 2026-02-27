import fetch from 'node-fetch';

let cachedRate = 1600; // Default fallback
let lastFetchTime = 0;
const CACHE_DURATION = 60 * 1000; // 1 minute

// Fallback to these if API is down
const FALLBACK_RATES = {
    USDT_NGN: 1610, // Slightly higher than 1600 to show movement
};

export const getLiveRates = async () => {
    const now = Date.now();

    if (now - lastFetchTime < CACHE_DURATION && Object.keys(FALLBACK_RATES).length > 1) {
        return FALLBACK_RATES;
    }

    try {
        let usdtRate = null;

        // 1. Try Binance API first for USDT/NGN
        try {
            const binanceResponse = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDTNGN');
            if (binanceResponse.ok) {
                const binanceData = await binanceResponse.json();
                if (binanceData.price) {
                    usdtRate = parseFloat(binanceData.price);
                    console.log(`[Binance] USDT_NGN Rate fetched: ${usdtRate}`);
                }
            }
        } catch (binanceErr) {
            console.log("Binance API failed/delisted, falling back to CoinGecko...");
        }

        // 2. Fetch all from CoinGecko
        const ids = 'tether,bitcoin,ethereum,solana,tron';
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=ngn`);
        const data = await response.json();

        if (data.tether && data.tether.ngn) {
            // Use CoinGecko USDT rate if Binance failed
            usdtRate = usdtRate || data.tether.ngn;

            // Update the global rates object
            FALLBACK_RATES.USDT_NGN = usdtRate;
            FALLBACK_RATES.NGN_USDT = 1 / usdtRate;

            FALLBACK_RATES.BTC_NGN = data.bitcoin.ngn;
            FALLBACK_RATES.NGN_BTC = 1 / data.bitcoin.ngn;

            FALLBACK_RATES.ETH_NGN = data.ethereum.ngn;
            FALLBACK_RATES.NGN_ETH = 1 / data.ethereum.ngn;

            FALLBACK_RATES.SOL_NGN = data.solana.ngn;
            FALLBACK_RATES.NGN_SOL = 1 / data.solana.ngn;

            FALLBACK_RATES.TRX_NGN = data.tron.ngn;
            FALLBACK_RATES.NGN_TRX = 1 / data.tron.ngn;

            lastFetchTime = now;
            console.log(`Updated Live Rates: USDT=${usdtRate}, BTC=${data.bitcoin.ngn}`);
        }
    } catch (error) {
        console.warn("Using existing/fallback rates:", error.message);
    }

    return FALLBACK_RATES;
};
