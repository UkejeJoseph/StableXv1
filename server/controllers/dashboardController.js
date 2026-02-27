import asyncHandler from 'express-async-handler';
import Wallet from '../models/walletModel.js';
import User from '../models/userModel.js';

// @desc    Get dashboard summary (balances, PnL mock, etc)
// @route   GET /api/dashboard/summary
// @access  Private
const getDashboardSummary = asyncHandler(async (req, res) => {
    const wallets = await Wallet.find({ user: req.user._id });

    // Mock 24h PnL data based on Binance style
    const dayPnL = {
        amount: 24.50,
        percentage: 3.2
    };

    const distribution = wallets.map(w => ({
        currency: w.currency || w.network,
        balance: w.balance,
        address: w.address,
    }));

    res.json({
        wallets: distribution,
        dayPnL,
        vipLevel: 'Regular User',
    });
});

// @desc    Get platform announcements
// @route   GET /api/dashboard/announcements
// @access  Public
const getAnnouncements = asyncHandler(async (req, res) => {
    res.json({
        success: true,
        announcements: [
            { id: 1, title: 'StableX Web V2 Launches with New Professional UI', date: new Date().toISOString() },
            { id: 2, title: 'Zero Fees on NGN Deposits for 7 Days', date: new Date().toISOString() },
            { id: 3, title: 'Earn up to 12% APY on USDT Staking', date: new Date().toISOString() }
        ]
    });
});

// @desc    Get rewards status
// @route   GET /api/dashboard/rewards
// @access  Private
const getRewardsStatus = asyncHandler(async (req, res) => {
    res.json({
        success: true,
        rewards: {
            referralCode: 'STABLEX2026',
            totalReferrals: 0,
            pendingRewards: 0,
            currency: 'USDT'
        }
    });
});

export { getDashboardSummary, getAnnouncements, getRewardsStatus };
