import asyncHandler from 'express-async-handler';
import Wallet from '../models/walletModel.js';
import User from '../models/userModel.js';
import Transaction from '../models/transactionModel.js';

// @desc    Get dashboard summary (balances, PnL, etc)
// @route   GET /api/dashboard/summary
// @access  Private
const getDashboardSummary = asyncHandler(async (req, res) => {
    const wallets = await Wallet.find({ user: req.user._id });

    // Fetch pending balances from transactions
    const pendingData = await Transaction.aggregate([
        {
            $match: {
                user: req.user._id,
                status: 'pending',
                type: 'deposit'
            }
        },
        {
            $group: {
                _id: '$currency',
                totalPending: { $sum: '$amount' }
            }
        }
    ]);

    const pendingMap = pendingData.reduce((acc, item) => {
        acc[item._id] = item.totalPending;
        return acc;
    }, {});

    const now = new Date();
    const yesterday = new Date(now - 24 * 60 * 60 * 1000);

    const pnlData = await Transaction.aggregate([
        {
            $match: {
                user: req.user._id, // Filter by user!
                createdAt: { $gte: yesterday },
                type: { $in: ['swap', 'withdrawal', 'p2p', 'merchant'] },
                status: 'completed'
            }
        },
        {
            $group: {
                _id: '$type',
                totalFees: { $sum: '$platformFee' },
                count: { $sum: 1 }
            }
        }
    ]);

    const totalPnL = pnlData.reduce((sum, item) => sum + (item.totalFees || 0), 0);

    const distribution = wallets.map(w => ({
        currency: w.currency || w.network,
        balance: w.balance,
        pending: pendingMap[w.currency] || 0,
        address: w.address,
    }));

    res.json({
        wallets: distribution,
        dayPnL: {
            amount: totalPnL,
            breakdown: pnlData
        },
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
