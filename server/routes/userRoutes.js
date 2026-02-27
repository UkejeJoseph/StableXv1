import express from 'express';
const router = express.Router();
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

router.post('/', registerUser);
router.post('/login', authUser);
router.post('/logout', logoutUser);
router.post('/verify', verifyOtp);
router.post('/resend-otp', resendOtp);
router.route('/profile').get(protect, getUserProfile);
router.route('/search').get(protect, searchUser);

export default router;
