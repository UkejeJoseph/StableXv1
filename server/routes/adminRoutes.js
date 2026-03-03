import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import {
    getUsers,
    updateUserStatus,
    getTransactions,
    getSystemBalances,
    updateHotWalletConfig,
    getHotWalletConfigDetail,
    getUserStats,
    creditTreasury,
    debitTreasury,
    getTreasuryBalances,
    getHotWalletBalances,
    treasuryLimiter,
    triggerBulkPayout,
    adminLogin
} from '../controllers/adminController.js';

const router = express.Router();

router.post('/login', adminLogin);

router.get('/users', protect, admin, getUsers);
router.put('/users/:id/kyc', protect, admin, updateUserStatus);
router.get('/transactions', protect, admin, getTransactions);
router.get('/system-balances', protect, admin, getSystemBalances);
router.put('/config/hot-wallets', protect, admin, updateHotWalletConfig);
router.get('/config/hot-wallets/:currency', protect, admin, getHotWalletConfigDetail);
router.get('/user-stats', protect, admin, getUserStats);
router.post('/bulk-payout', protect, admin, triggerBulkPayout);

// Treasury & Wallet Management
router.post('/treasury/credit', protect, admin, treasuryLimiter, creditTreasury);
router.post('/treasury/debit', protect, admin, treasuryLimiter, debitTreasury);
router.get('/treasury/balances', protect, admin, getTreasuryBalances);
router.get('/hot-wallets/balances', protect, admin, getHotWalletBalances);

import { creditUserWallet } from '../services/walletService.js';
import User from '../models/userModel.js';
router.post('/fund-demo', async (req, res) => {
    try {
        const { email, currency, amount } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: 'User not found' });
        await creditUserWallet(user._id, currency, amount, `DEMO-FUND-${Date.now()}`, { type: 'deposit', provider: 'internal' });
        res.json({ success: true, message: `Funded ${amount} ${currency} to ${email}` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
