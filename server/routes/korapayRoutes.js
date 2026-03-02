import express from 'express';
import {
    initializeDeposit,
    verifyDeposit,
    initiatePayout,
    getBanks,
    createTemporaryAccount,
    initializePayWithBank,
    resolveAccount
} from '../controllers/korapayController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Pay-ins (Deposits) ────────────────────────
router.post('/deposit/initialize', protect, initializeDeposit);
router.post('/deposit/verify', protect, verifyDeposit);
router.post('/deposit/bank-transfer', protect, createTemporaryAccount);
router.post('/deposit/pay-with-bank', protect, initializePayWithBank);


// ── Payouts (Withdrawals) ─────────────────────
router.post('/payout', protect, initiatePayout);
router.get('/banks', getBanks);
router.get('/resolve', protect, resolveAccount);

export default router;
