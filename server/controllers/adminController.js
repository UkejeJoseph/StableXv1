import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import Wallet from '../models/walletModel.js';
import Transaction from '../models/transactionModel.js';
import fs from 'fs';
import path from 'path';

// @desc    Get all users with basic wallet/balance info
// @route   GET /api/admin/users
// @access  Private/Admin
export const getUsers = asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const count = await User.countDocuments({});

    // Get users with pagination
    const users = await User.find({})
        .select('-password -mnemonic -encryptedMnemonic')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(limit * (page - 1));

    // Aggregate wallet balances per user
    const usersWithBalances = await Promise.all(users.map(async (user) => {
        const wallets = await Wallet.find({ user: user._id }).select('currency balance address');
        return {
            ...user.toObject(),
            wallets,
            totalActiveWallets: wallets.length
        };
    }));

    res.json({
        users: usersWithBalances,
        page,
        pages: Math.ceil(count / limit),
        totalUsers: count
    });
});

// @desc    Update user KYC status or Role
// @route   PUT /api/admin/users/:id/kyc
// @access  Private/Admin
export const updateUserStatus = asyncHandler(async (req, res) => {
    const { kycLevel, role } = req.body;

    const user = await User.findById(req.params.id);

    if (user) {
        if (kycLevel !== undefined) user.kycLevel = kycLevel;
        if (role !== undefined) user.role = role;

        const updatedUser = await user.save();
        res.json({
            _id: updatedUser._id,
            username: updatedUser.username,
            email: updatedUser.email,
            kycLevel: updatedUser.kycLevel,
            role: updatedUser.role
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// @desc    Get all transactions (Global Ledger)
// @route   GET /api/admin/transactions
// @access  Private/Admin
export const getTransactions = asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;

    const count = await Transaction.countDocuments({});

    const transactions = await Transaction.find({})
        .populate('user', 'username email')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(limit * (page - 1));

    res.json({
        transactions,
        page,
        pages: Math.ceil(count / limit),
        totalTransactions: count
    });
});

// @desc    Get system balances (Liabilities vs Hot Wallet Assets)
// @route   GET /api/admin/system-balances
// @access  Private/Admin
export const getSystemBalances = asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - 7);

    const thisMonthStart = new Date(today);
    thisMonthStart.setDate(1);

    // ── Revenue Aggregations ──
    const totalRevenue = await Transaction.aggregate([
        { $match: { profit: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$profit' } } }
    ]);

    const todayRevenue = await Transaction.aggregate([
        { $match: { profit: { $gt: 0 }, createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$profit' } } }
    ]);

    const weekRevenue = await Transaction.aggregate([
        { $match: { profit: { $gt: 0 }, createdAt: { $gte: thisWeekStart } } },
        { $group: { _id: null, total: { $sum: '$profit' } } }
    ]);

    const monthRevenue = await Transaction.aggregate([
        { $match: { profit: { $gt: 0 }, createdAt: { $gte: thisMonthStart } } },
        { $group: { _id: null, total: { $sum: '$profit' } } }
    ]);

    // Revenue by transaction type (swap, withdrawal, transfer, etc.)
    const revenueByStream = await Transaction.aggregate([
        { $match: { profit: { $gt: 0 } } },
        { $group: { _id: '$type', total: { $sum: '$profit' }, count: { $sum: 1 } } }
    ]);

    // ── Platform Wallet Balances ──
    let platformWallets = [];
    if (process.env.PLATFORM_FEE_WALLET_ID) {
        platformWallets = await Wallet.find({
            user: process.env.PLATFORM_FEE_WALLET_ID,
            walletType: 'treasury'
        }).select('currency balance');
    }

    // ── Liabilities (user balances grouped by currency) ──
    const liabilitiesAggr = await Wallet.aggregate([
        { $match: { walletType: 'user' } },
        { $group: { _id: '$currency', total: { $sum: '$balance' } } }
    ]);
    const liabilities = {};
    liabilitiesAggr.forEach(item => { liabilities[item._id] = item.total; });

    // ── Staking Stats ──
    let stakingStats = [];
    try {
        const StakingPosition = (await import('../models/stakingPositionModel.js')).default;
        stakingStats = await StakingPosition.aggregate([
            { $match: { status: 'active' } },
            { $group: { _id: '$currency', totalLocked: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]);
    } catch (e) { /* StakingPosition model may not exist yet */ }

    // ── User Counts ──
    const userCount = await User.countDocuments({ role: 'user' });
    const merchantCount = await User.countDocuments({ role: 'merchant' });

    // ── Hot Wallet Addresses ──
    let hotWallets = {};
    try {
        const hotWalletPath = path.join(process.cwd(), 'server', 'scripts', 'HOT_WALLETS.json');
        if (fs.existsSync(hotWalletPath)) {
            hotWallets = JSON.parse(fs.readFileSync(hotWalletPath, 'utf8'));
        }
    } catch (e) {
        console.error("Error reading Hot Wallets:", e.message);
    }

    // ── Transaction Volume Today ──
    const volumeToday = await Transaction.aggregate([
        { $match: { createdAt: { $gte: today }, status: 'completed' } },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    res.json({
        success: true,
        data: {
            revenue: {
                allTime: totalRevenue[0]?.total || 0,
                today: todayRevenue[0]?.total || 0,
                thisWeek: weekRevenue[0]?.total || 0,
                thisMonth: monthRevenue[0]?.total || 0,
                byStream: revenueByStream,
            },
            platformWallets,
            liabilities,
            stakingStats,
            users: { total: userCount, merchants: merchantCount },
            hotWallets: {
                BTC: hotWallets.BTC?.address || process.env.STABLEX_HOT_WALLET_BTC || 'Not configured',
                ETH: hotWallets.ETH?.address || process.env.STABLEX_HOT_WALLET_ETH || 'Not configured',
                TRC20: hotWallets.TRX?.address || process.env.STABLEX_HOT_WALLET_TRC20 || 'Not configured',
                SOL: hotWallets.SOL?.address || process.env.STABLEX_HOT_WALLET_SOL || 'Not configured',
            },
            volumeToday,
        }
    });
});
