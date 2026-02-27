import express from 'express';
import { generateApiKeys, getApiKeys, updateWebhookUrl } from '../controllers/developerController.js';
import { protect } from '../middleware/authMiddleware.js';

import { merchantLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.use(merchantLimiter);

router.get('/keys', protect, getApiKeys);
router.post('/keys', protect, generateApiKeys);
router.put('/webhook', protect, updateWebhookUrl);

export default router;
