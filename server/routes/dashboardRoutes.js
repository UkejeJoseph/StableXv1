import express from 'express';
const router = express.Router();
import {
    getDashboardSummary,
    getAnnouncements,
    getRewardsStatus
} from '../controllers/dashboardController.js';
import { protect } from '../middleware/authMiddleware.js';

router.route('/summary').get(protect, getDashboardSummary);
router.route('/announcements').get(getAnnouncements);
router.route('/rewards').get(protect, getRewardsStatus);

export default router;
