import express from 'express';
import { generateWallet, importWallet, connectWallet, getUserWallets } from '../controllers/walletController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/generate', protect, generateWallet);
router.post('/import', protect, importWallet);
router.post('/connect', protect, connectWallet);
router.get('/', protect, getUserWallets);

export default router;
