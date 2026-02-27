import express from 'express';
import asyncHandler from 'express-async-handler';
import { protect } from '../middleware/authMiddleware.js';
import { stakeTokens, unstakeTokens, getUserPositions } from '../services/stakingService.js';

const router = express.Router();

// @desc    Get user's staking positions
// @route   GET /api/staking/positions
// @access  Private
router.get('/positions', protect, asyncHandler(async (req, res) => {
    const positions = await getUserPositions(req.user._id);
    res.json({ success: true, data: positions });
}));

// @desc    Stake tokens
// @route   POST /api/staking/stake
// @access  Private
router.post('/stake', protect, asyncHandler(async (req, res) => {
    const { currency, amount } = req.body;
    if (!currency || !amount) {
        return res.status(400).json({ success: false, error: 'Missing currency or amount' });
    }
    const position = await stakeTokens(req.user._id, currency, Number(amount));
    res.json({ success: true, message: 'Tokens staked successfully', data: position });
}));

// @desc    Unstake tokens (return principal)
// @route   POST /api/staking/unstake
// @access  Private
router.post('/unstake', protect, asyncHandler(async (req, res) => {
    const { positionId } = req.body;
    if (!positionId) {
        return res.status(400).json({ success: false, error: 'Missing positionId' });
    }
    const result = await unstakeTokens(req.user._id, positionId);
    res.json({ success: true, message: 'Tokens unstaked successfully', data: result });
}));

export default router;
