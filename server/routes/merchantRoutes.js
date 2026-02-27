import express from 'express';
import { getSettlements, getWebhookLogs, getWebhookUrl, getBankAccounts, addBankAccount, deleteBankAccount } from '../controllers/merchantController.js';
import { protect } from '../middleware/authMiddleware.js';

import { merchantLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.use(merchantLimiter);

router.get('/settlements', protect, getSettlements);
router.get('/webhook-logs', protect, getWebhookLogs);
router.get('/webhook', protect, getWebhookUrl);

router.get('/bank-accounts', protect, getBankAccounts);
router.post('/bank-accounts', protect, addBankAccount);
router.delete('/bank-accounts/:id', protect, deleteBankAccount);

export default router;
