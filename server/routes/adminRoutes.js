import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import {
    getUsers,
    updateUserStatus,
    getTransactions,
    getSystemBalances
} from '../controllers/adminController.js';

const router = express.Router();

router.get('/users', protect, admin, getUsers);
router.put('/users/:id/kyc', protect, admin, updateUserStatus);
router.get('/transactions', protect, admin, getTransactions);
router.get('/system-balances', protect, admin, getSystemBalances);

export default router;
