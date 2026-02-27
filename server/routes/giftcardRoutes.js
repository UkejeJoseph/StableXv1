import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { listGiftCards, purchaseGiftCard } from '../controllers/giftcardController.js';

const router = express.Router();

router.get('/', protect, listGiftCards);
router.post('/purchase', protect, purchaseGiftCard);

export default router;
