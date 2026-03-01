import express from 'express';
import { initializeCheckout, getCheckoutDetails, processInternalPayment } from '../controllers/checkoutController.js';
import { requireApiKey } from '../middleware/apiKeyMiddleware.js';
import { protect } from '../middleware/authMiddleware.js';
import { idempotency } from '../middleware/idempotency.js';

import { merchantLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.use(merchantLimiter);

// Public/External B2B Routes
router.post('/initialize', requireApiKey, idempotency, initializeCheckout);

// Public Widget Routes
router.get('/:sessionId/details', getCheckoutDetails);

// Status Polling Route (used by CheckoutWidget for crypto payment confirmation)
router.get('/:sessionId/status', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const CheckoutSession = (await import('../models/checkoutSessionModel.js')).default;

        const session = await CheckoutSession.findOne({ sessionId });
        if (!session) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }

        // Auto-expire if past expiry and still pending
        if (session.expiresAt < new Date() && session.status === 'pending') {
            session.status = 'expired';
            await session.save();
        }

        return res.json({
            success: true,
            status: session.status,
            sessionId: session.sessionId,
            amount: session.amount,
            currency: session.currency,
        });
    } catch (err) {
        console.error('[CHECKOUT-STATUS] Error:', err.message);
        return res.status(500).json({ success: false, error: 'Failed to fetch session status' });
    }
});

// Internal User Payment Routes
router.post('/:sessionId/pay-internal', protect, processInternalPayment);

export default router;
