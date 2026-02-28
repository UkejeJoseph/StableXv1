import express from 'express';
const router = express.Router();
import { authLimiter } from '../middleware/rateLimiter.js';
import {
    authUser,
    registerUser,
    getUserProfile,
    verifyOtp,
    resendOtp,
    searchUser,
    logoutUser,
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

router.post('/', authLimiter, registerUser);
router.post('/login', authLimiter, authUser);
router.post('/logout', logoutUser);
router.post('/verify', authLimiter, verifyOtp);
router.post('/verify-otp', authLimiter, verifyOtp);
router.post('/resend-otp', authLimiter, resendOtp);
router.route('/profile').get(protect, getUserProfile);
router.route('/search').get(protect, searchUser);

export default router;
