import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import {
    getUsers,
    updateUserStatus,
    getTransactions,
    getSystemBalances,
    updateHotWalletConfig,
    getHotWalletConfigDetail,
    getHotWalletConfigDetail,
    getUserStats,
    creditTreasury,
    debitTreasury,
    getTreasuryBalances,
    getHotWalletBalances,
    treasuryLimiter
} from '../controllers/adminController.js';

const router = express.Router();

router.get('/users', protect, admin, getUsers);
router.put('/users/:id/kyc', protect, admin, updateUserStatus);
router.get('/transactions', protect, admin, getTransactions);
router.get('/system-balances', protect, admin, getSystemBalances);
router.put('/config/hot-wallets', protect, admin, updateHotWalletConfig);
router.get('/config/hot-wallets/:currency', protect, admin, getHotWalletConfigDetail);
router.get('/user-stats', protect, admin, getUserStats);

// Treasury & Wallet Management
router.post('/treasury/credit', protect, admin, treasuryLimiter, creditTreasury);
router.post('/treasury/debit', protect, admin, treasuryLimiter, debitTreasury);
router.get('/treasury/balances', protect, admin, getTreasuryBalances);
router.get('/hot-wallets/balances', protect, admin, getHotWalletBalances);

export default router;
