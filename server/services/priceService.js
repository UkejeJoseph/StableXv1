import axios from 'axios';
import redisClient from '../config/redis.js';

// ════════════════════════════════════════
// CACHE KEYS
// ════════════════════════════════════════
const CACHE_KEYS = {
    MARKETS: 'prices:markets',
    RATES: 'prices:rates',
    LAST_KNOWN: 'prices:last_known',
};

const CACHE_TTL = 60; // 60 seconds

// ════════════════════════════════════════
// BINANCE - PRIMARY SOURCE
// Free, unlimited, no API key needed
// ════════════════════════════════════════
async function fetchFromBinance() {
    console.log('[PRICE-SERVICE] Fetching from Binance...');

    const symbols = [
        'BTCUSDT',
        'ETHUSDT',
        'SOLUSDT',
        'TRXUSDT',
        'BNBUSDT',
    ];

    const symbolQuery = JSON.stringify(symbols);

    const [tickerRes, priceRes] = await Promise.all([
        // 24hr stats (includes price change %)
        axios.get(
            `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbolQuery)}`,
            { timeout: 5000 }
        ),
        // Current prices
        axios.get(
            `https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(symbolQuery)}`,
            { timeout: 5000 }
        ),
    ]);

    console.log('[PRICE-SERVICE] ✅ Binance response received');

    const prices = {};

    tickerRes.data.forEach(ticker => {
        const symbol = ticker.symbol.replace('USDT', '');
        prices[symbol] = {
            usd: parseFloat(ticker.lastPrice),
            usd_24h_change: parseFloat(ticker.priceChangePercent),
            usd_24h_vol: parseFloat(ticker.volume),
            high_24h: parseFloat(ticker.highPrice),
            low_24h: parseFloat(ticker.lowPrice),
            source: 'binance',
            timestamp: Date.now(),
        };
        console.log(`[PRICE-SERVICE] ${symbol}: $${prices[symbol].usd} (${prices[symbol].usd_24h_change}%)`);
    });

    return prices;
}

// ════════════════════════════════════════
// KUCOIN - SECONDARY FALLBACK
// Free, no key needed for public endpoints
// ════════════════════════════════════════
async function fetchFromKuCoin() {
    console.log('[PRICE-SERVICE] Fetching from KuCoin...');

    const pairs = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'TRX-USDT', 'BNB-USDT'];
    const prices = {};

    await Promise.all(
        pairs.map(async (pair) => {
            try {
                const res = await axios.get(
                    `https://api.kucoin.com/api/v1/market/stats?symbol=${pair}`,
                    { timeout: 5000 }
                );

                const data = res.data.data;
                const symbol = pair.replace('-USDT', '');

                prices[symbol] = {
                    usd: parseFloat(data.last),
                    usd_24h_change: parseFloat(data.changeRate) * 100,
                    usd_24h_vol: parseFloat(data.vol),
                    high_24h: parseFloat(data.high),
                    low_24h: parseFloat(data.low),
                    source: 'kucoin',
                    timestamp: Date.now(),
                };

                console.log(`[PRICE-SERVICE] KuCoin ${symbol}: $${prices[symbol].usd}`);
            } catch (err) {
                console.error(`[PRICE-SERVICE] KuCoin failed for ${pair}:`, err.message);
            }
        })
    );

    return prices;
}

// ════════════════════════════════════════
// COINGECKO - FINAL FALLBACK
// Existing implementation - keep as is
// ════════════════════════════════════════
async function fetchFromCoinGecko() {
    console.log('[PRICE-SERVICE] Fetching from CoinGecko (fallback)...');

    const res = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price',
        {
            params: {
                ids: 'bitcoin,ethereum,solana,tron,binancecoin',
                vs_currencies: 'usd',
                include_24hr_change: true,
                include_24hr_vol: true,
            },
            timeout: 8000,
        }
    );

    console.log('[PRICE-SERVICE] ✅ CoinGecko response received');

    const mapping = {
        bitcoin: 'BTC',
        ethereum: 'ETH',
        solana: 'SOL',
        tron: 'TRX',
        binancecoin: 'BNB',
    };

    const prices = {};
    Object.entries(res.data).forEach(([id, data]) => {
        const symbol = mapping[id];
        if (symbol) {
            prices[symbol] = {
                usd: data.usd,
                usd_24h_change: data.usd_24h_change,
                usd_24h_vol: data.usd_24h_vol,
                source: 'coingecko',
                timestamp: Date.now(),
            };
            console.log(`[PRICE-SERVICE] CoinGecko ${symbol}: $${prices[symbol].usd}`);
        }
    });

    return prices;
}

// ════════════════════════════════════════
// NGN RATES
// StableX controls its own NGN rates
// Based on market rate + spread
// ════════════════════════════════════════
async function getNGNRates(cryptoPrices) {
    console.log('[PRICE-SERVICE] Calculating NGN rates...');

    // Get USD/NGN rate
    // Try multiple sources for NGN rate
    let usdToNgn = 1600; // fallback hardcoded rate

    try {
        // Try to get from your configured rate first
        const configuredRate = await redisClient.get('config:usd_ngn_rate');
        if (configuredRate) {
            usdToNgn = parseFloat(configuredRate);
            console.log('[PRICE-SERVICE] NGN rate from config:', usdToNgn);
        } else {
            // Try Quidax (Nigerian exchange - free public API)
            try {
                const quidaxRes = await axios.get(
                    'https://www.quidax.com/api/v1/markets/tickers/usdtngn',
                    { timeout: 5000 }
                );
                usdToNgn = parseFloat(quidaxRes.data?.data?.ticker?.last || 1600);
                console.log('[PRICE-SERVICE] NGN rate from Quidax:', usdToNgn);
            } catch (qErr) {
                console.warn('[PRICE-SERVICE] Quidax NGN rate failed, using fallback:', usdToNgn);
            }
        }
    } catch (err) {
        console.warn('[PRICE-SERVICE] NGN rate lookup failed, using fallback:', usdToNgn);
    }

    const SPREAD = 1.025; // 2.5% spread
    const ngnRates = {};

    // Calculate NGN price for each crypto
    Object.entries(cryptoPrices).forEach(([symbol, data]) => {
        ngnRates[symbol] = {
            ngn: data.usd * usdToNgn * SPREAD,
            usdToNgn,
        };
    });

    // USDT rates (pegged to USD)
    ngnRates['USDT_TRC20'] = {
        ngn: usdToNgn * SPREAD,
        usdToNgn,
    };
    ngnRates['USDT_ERC20'] = {
        ngn: usdToNgn * SPREAD,
        usdToNgn,
    };

    console.log('[PRICE-SERVICE] NGN rates calculated');
    console.log('[PRICE-SERVICE] USD/NGN rate:', usdToNgn);
    console.log('[PRICE-SERVICE] USDT/NGN rate:', ngnRates['USDT_TRC20'].ngn);

    return { ngnRates, usdToNgn };
}

// ════════════════════════════════════════
// MAIN PRICE FETCHER
// With fallback chain and Redis cache
// ════════════════════════════════════════
export async function getMarketPrices() {
    console.log('[PRICE-SERVICE] ══════════════════════════');
    console.log('[PRICE-SERVICE] getMarketPrices called');

    // Step 1: Check Redis cache first
    try {
        const cached = await redisClient.get(CACHE_KEYS.MARKETS);
        if (cached) {
            const parsed = JSON.parse(cached);
            console.log('[PRICE-SERVICE] ✅ Serving from cache');
            console.log('[PRICE-SERVICE] Cache age:',
                Math.round((Date.now() - parsed.cachedAt) / 1000), 'seconds');
            return { ...parsed, fromCache: true };
        }
    } catch (cacheErr) {
        console.warn('[PRICE-SERVICE] Cache read failed:', cacheErr.message);
    }

    // Step 2: Fetch from sources with fallback chain
    let cryptoPrices = null;
    let source = null;

    // Try Binance first
    try {
        cryptoPrices = await fetchFromBinance();
        source = 'binance';
        console.log('[PRICE-SERVICE] ✅ Using Binance prices');
    } catch (binanceErr) {
        console.warn('[PRICE-SERVICE] ⚠️ Binance failed:', binanceErr.message);

        // Try KuCoin second
        try {
            cryptoPrices = await fetchFromKuCoin();
            source = 'kucoin';
            console.log('[PRICE-SERVICE] ✅ Using KuCoin prices');
        } catch (kucoinErr) {
            console.warn('[PRICE-SERVICE] ⚠️ KuCoin failed:', kucoinErr.message);

            // Try CoinGecko last
            try {
                cryptoPrices = await fetchFromCoinGecko();
                source = 'coingecko';
                console.log('[PRICE-SERVICE] ✅ Using CoinGecko prices');
            } catch (geckoErr) {
                console.error('[PRICE-SERVICE] ❌ ALL sources failed');
                console.error('[PRICE-SERVICE] Binance:', binanceErr.message);
                console.error('[PRICE-SERVICE] KuCoin:', kucoinErr.message);
                console.error('[PRICE-SERVICE] CoinGecko:', geckoErr.message);

                // Return last known prices from cache
                try {
                    const lastKnown = await redisClient.get(CACHE_KEYS.LAST_KNOWN);
                    if (lastKnown) {
                        const parsed = JSON.parse(lastKnown);
                        console.warn('[PRICE-SERVICE] ⚠️ Returning last known prices');
                        return { ...parsed, stale: true, fromCache: true };
                    }
                } catch (e) {
                    console.error('[PRICE-SERVICE] No last known prices available');
                }

                throw new Error('All price sources unavailable');
            }
        }
    }

    // Step 3: Calculate NGN rates
    const { ngnRates, usdToNgn } = await getNGNRates(cryptoPrices);

    // Step 4: Build response
    const result = {
        prices: cryptoPrices,
        ngnRates,
        usdToNgn,
        // Flat rates for swap use
        rates: {
            USDT_NGN: ngnRates['USDT_TRC20']?.ngn || usdToNgn,
            NGN_USDT: 1 / (ngnRates['USDT_TRC20']?.ngn || usdToNgn),
            BTC_NGN: cryptoPrices['BTC']?.usd * usdToNgn,
            ETH_NGN: cryptoPrices['ETH']?.usd * usdToNgn,
            SOL_NGN: cryptoPrices['SOL']?.usd * usdToNgn,
        },
        source,
        stale: false,
        cachedAt: Date.now(),
        timestamp: new Date().toISOString(),
    };

    console.log('[PRICE-SERVICE] Result built from:', source);
    console.log('[PRICE-SERVICE] BTC price: $', cryptoPrices['BTC']?.usd);
    console.log('[PRICE-SERVICE] ETH price: $', cryptoPrices['ETH']?.usd);
    console.log('[PRICE-SERVICE] USDT/NGN rate:', result.rates.USDT_NGN);

    // Step 5: Cache the result
    try {
        await redisClient.setex(
            CACHE_KEYS.MARKETS,
            CACHE_TTL,
            JSON.stringify(result)
        );
        // Also save as last known prices (longer TTL)
        await redisClient.setex(
            CACHE_KEYS.LAST_KNOWN,
            3600, // 1 hour
            JSON.stringify(result)
        );
        console.log('[PRICE-SERVICE] ✅ Prices cached for', CACHE_TTL, 'seconds');
    } catch (cacheErr) {
        console.warn('[PRICE-SERVICE] Cache write failed:', cacheErr.message);
    }

    console.log('[PRICE-SERVICE] ══════════════════════════');
    return result;
}

// Get specific swap rate
export async function getSwapRate(fromCurrency, toCurrency) {
    console.log('[PRICE-SERVICE] getSwapRate:', fromCurrency, '→', toCurrency);

    const market = await getMarketPrices();

    const SPREAD = 1.025;
    const usdToNgn = market.usdToNgn;

    // Normalization helper: USDT_TRC20 -> USDT, SOL_TRC20 -> SOL
    const normalize = (c) => c.split('_')[0];
    const fromBase = normalize(fromCurrency);
    const toBase = normalize(toCurrency);

    // Build rate lookup in USD
    const usdPrices = {
        NGN: 1 / usdToNgn,
        USDT: 1,
        BTC: market.prices['BTC']?.usd,
        ETH: market.prices['ETH']?.usd,
        SOL: market.prices['SOL']?.usd,
        TRX: market.prices['TRX']?.usd,
        BNB: market.prices['BNB']?.usd,
    };

    const fromUsd = usdPrices[fromBase] || market.prices[fromBase]?.usd;
    const toUsd = usdPrices[toBase] || market.prices[toBase]?.usd;

    if (!fromUsd || !toUsd) {
        console.error('[PRICE-SERVICE] ❌ Unknown currency:', fromCurrency, '(', fromBase, ') or', toCurrency, '(', toBase, ')');
        throw new Error(`Unsupported currency pair: ${fromCurrency}/${toCurrency}`);
    }

    // Rate with spread applied
    // (fromUsd / toUsd) is the raw market rate
    const rawRate = fromUsd / toUsd;

    // Applying spread: 
    // If buying: rate is higher (costs more)
    // If selling: rate is lower (receive less)
    // Here we use a symmetric spread for simplicity or specific logic
    const rateWithSpread = rawRate / SPREAD;

    console.log('[PRICE-SERVICE] Rate:', fromCurrency, '→', toCurrency, '=', rateWithSpread);

    return {
        from: fromCurrency,
        to: toCurrency,
        rate: rateWithSpread,
        spread: '2.5%',
        source: market.source,
        stale: market.stale || false,
        timestamp: market.timestamp,
    };
}

// Get historical klines for charts
export async function getKlines(symbol, interval = '1h', limit = 24) {
    console.log(`[PRICE-SERVICE] getKlines: ${symbol} (${interval}, ${limit})`);

    // Map symbols if needed (e.g., BTC -> BTCUSDT)
    const binanceSymbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;

    try {
        const response = await axios.get(
            `https://api.binance.com/api/v3/klines`,
            {
                params: { symbol: binanceSymbol, interval, limit },
                timeout: 5000
            }
        );

        return response.data;
    } catch (err) {
        console.error(`[PRICE-SERVICE] ❌ Klines fetch failed:`, err.message);
        throw new Error('Failed to fetch historical data');
    }
}
