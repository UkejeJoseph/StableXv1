import express from 'express';
import { getMarketPrices, getSwapRate, getKlines } from '../services/priceService.js';
import rateLimit from 'express-rate-limit';
import redisClient from '../config/redis.js';

const router = express.Router();

// Rate limiter - max 60 requests per minute per IP
const priceLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { error: 'Too many requests' },
});

// GET /api/prices/markets
// Returns all coin prices + NGN rates
router.get('/markets', priceLimiter, async (req, res) => {
    try {
        console.log('[PRICE-ROUTE] GET /markets');
        const data = await getMarketPrices();

        if (data.stale) {
            console.warn('[PRICE-ROUTE] ⚠️ Returning stale prices');
        }

        return res.json({
            success: true,
            ...data,
        });

    } catch (err) {
        console.error('[PRICE-ROUTE] ❌ Error:', err.message);
        return res.status(503).json({
            success: false,
            error: 'Price data temporarily unavailable',
        });
    }
});

// GET /api/prices/rate?from=USDT_TRC20&to=NGN
// Returns specific swap rate
router.get('/rate', priceLimiter, async (req, res) => {
    try {
        const { from, to } = req.query;
        console.log('[PRICE-ROUTE] GET /rate', from, '→', to);

        if (!from || !to) {
            return res.status(400).json({
                success: false,
                error: 'from and to query params required',
            });
        }

        const rate = await getSwapRate(from, to);

        return res.json({
            success: true,
            ...rate,
        });

    } catch (err) {
        console.error('[PRICE-ROUTE] ❌ Rate error:', err.message);
        return res.status(400).json({
            success: false,
            error: err.message,
        });
    }
});

// GET /api/prices/klines?symbol=BTCUSDT&interval=1h&limit=24
router.get('/klines', priceLimiter, async (req, res) => {
    try {
        const { symbol, interval, limit } = req.query;
        console.log('[PRICE-ROUTE] GET /klines', symbol, interval, limit);

        if (!symbol) {
            return res.status(400).json({
                success: false,
                error: 'symbol query param required',
            });
        }

        const data = await getKlines(symbol, interval, limit);
        return res.json(data);

    } catch (err) {
        console.error('[PRICE-ROUTE] ❌ Klines error:', err.message);
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});

// POST /api/prices/ngn-rate (admin only)
// Update the USD/NGN rate manually
router.post('/ngn-rate', async (req, res) => {
    try {
        const { rate } = req.body;
        console.log('[PRICE-ROUTE] Updating NGN rate to:', rate);

        if (!rate || isNaN(rate) || rate <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Valid rate required',
            });
        }

        await redisClient.set('config:usd_ngn_rate', rate.toString());
        // Clear price cache so next request uses new rate
        await redisClient.del('prices:markets');

        console.log('[PRICE-ROUTE] ✅ NGN rate updated:', rate);

        return res.json({
            success: true,
            message: 'NGN rate updated',
            rate,
        });

    } catch (err) {
        console.error('[PRICE-ROUTE] ❌ Error:', err.message);
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});

export default router;
