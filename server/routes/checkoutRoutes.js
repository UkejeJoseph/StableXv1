import express from 'express';
import { initializeCheckout, getCheckoutDetails, processInternalPayment } from '../controllers/checkoutController.js';
import { requireApiKey } from '../middleware/apiKeyMiddleware.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public/External B2B Routes
router.post('/initialize', requireApiKey, initializeCheckout);

// Public Widget Routes
router.get('/:sessionId/details', getCheckoutDetails);

// Internal User Payment Routes
router.post('/:sessionId/pay-internal', protect, processInternalPayment);

export default router;
