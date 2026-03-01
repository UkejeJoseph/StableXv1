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

            // Updated Live Rates helper
            const updateRate = (base, ngnValue) => {
                FALLBACK_RATES[`${base}_NGN`] = ngnValue;
                FALLBACK_RATES[`NGN_${base}`] = 1 / ngnValue;

                // Add common variants for frontend compatibility
                if (base === 'USDT') {
                    FALLBACK_RATES[`USDT_TRC20_NGN`] = ngnValue;
                    FALLBACK_RATES[`NGN_USDT_TRC20`] = 1 / ngnValue;
                    FALLBACK_RATES[`USDT_ERC20_NGN`] = ngnValue;
                    FALLBACK_RATES[`NGN_USDT_ERC20`] = 1 / ngnValue;
                }
                if (base === 'ETH') {
                    FALLBACK_RATES[`ETH_TRC20_NGN`] = ngnValue;
                    FALLBACK_RATES[`NGN_ETH_TRC20`] = 1 / ngnValue;
                }
                if (base === 'SOL') {
                    FALLBACK_RATES[`SOL_TRC20_NGN`] = ngnValue;
                    FALLBACK_RATES[`NGN_SOL_TRC20`] = 1 / ngnValue;
                }
            };

            updateRate('USDT', usdtRate);
            updateRate('BTC', data.bitcoin.ngn);
            updateRate('ETH', data.ethereum.ngn);
            updateRate('SOL', data.solana.ngn);
            updateRate('TRX', data.tron.ngn);

            lastFetchTime = now;
            console.log(`Updated Live Rates: USDT=${usdtRate.toFixed(2)}, BTC=${data.bitcoin.ngn.toLocaleString()}`);
        }
    } catch (error) {
        console.warn("Using existing/fallback rates:", error.message);
    }

    return FALLBACK_RATES;
};
