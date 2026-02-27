import express from 'express';
import {
    initializeDeposit,
    verifyDeposit,
    initiatePayout,
    getBanks,
    handleWebhook,
    createTemporaryAccount
} from '../controllers/korapayController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Pay-ins (Deposits) ────────────────────────
router.post('/deposit/initialize', protect, initializeDeposit);
router.get('/deposit/verify/:reference', protect, verifyDeposit);
router.post('/deposit/bank-transfer', protect, createTemporaryAccount);


// ── Payouts (Withdrawals) ─────────────────────
router.post('/payout', protect, initiatePayout);
router.get('/banks', getBanks);

// ── Webhooks ──────────────────────────────────
router.post('/webhook', handleWebhook);

export default router;
