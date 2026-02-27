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

// Internal User Payment Routes
router.post('/:sessionId/pay-internal', protect, processInternalPayment);

export default router;
