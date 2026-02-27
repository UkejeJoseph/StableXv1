import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import {
    getUsers,
    updateUserStatus,
    getTransactions,
    getSystemBalances,
    updateHotWalletConfig,
    getHotWalletConfigDetail
} from '../controllers/adminController.js';

const router = express.Router();

router.get('/users', protect, admin, getUsers);
router.put('/users/:id/kyc', protect, admin, updateUserStatus);
router.get('/transactions', protect, admin, getTransactions);
router.get('/system-balances', protect, admin, getSystemBalances);
router.put('/config/hot-wallets', protect, admin, updateHotWalletConfig);
router.get('/config/hot-wallets/:currency', protect, admin, getHotWalletConfigDetail);

export default router;
