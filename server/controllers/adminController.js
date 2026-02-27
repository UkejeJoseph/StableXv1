import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import Wallet from '../models/walletModel.js';
import Transaction from '../models/transactionModel.js';
import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import { TronWeb } from 'tronweb';

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

    // ── Hot Wallet Live Balances (Restricted to Super Admin) ──
    let hotWallets = {};
    const liveBalances = {};
    const SUPER_ADMIN = 'ukejejoseph1@gmail.com';
    const isSuperAdmin = req.user && req.user.email === SUPER_ADMIN;

    if (isSuperAdmin) {
        try {
            const hotWalletPath = path.join(process.cwd(), 'server', 'scripts', 'HOT_WALLETS.json');
            if (fs.existsSync(hotWalletPath)) {
                hotWallets = JSON.parse(fs.readFileSync(hotWalletPath, 'utf8'));
            }

            const ethProvider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL || "https://ethereum-rpc.publicnode.com");
            const solConnection = new Connection(process.env.SOL_RPC_URL || "https://api.mainnet-beta.solana.com");

            if (process.env.STABLEX_HOT_WALLET_ETH) {
                const bal = await ethProvider.getBalance(process.env.STABLEX_HOT_WALLET_ETH);
                liveBalances.ETH = parseFloat(ethers.formatEther(bal));
            }
            if (process.env.STABLEX_HOT_WALLET_SOL) {
                const bal = await solConnection.getBalance(new PublicKey(process.env.STABLEX_HOT_WALLET_SOL));
                liveBalances.SOL = bal / 1e9;
            }
            if (process.env.STABLEX_HOT_WALLET_BTC) {
                try {
                    const btcRes = await axios.get(`https://blockstream.info/api/address/${process.env.STABLEX_HOT_WALLET_BTC}`);
                    liveBalances.BTC = (btcRes.data.chain_stats.funded_txo_sum - btcRes.data.chain_stats.spent_txo_sum) / 1e8;
                } catch (btcErr) {
                    console.warn("BTC balance fetch failed:", btcErr.message);
                    liveBalances.BTC = 0;
                }
            }
            if (process.env.STABLEX_HOT_WALLET_TRC20) {
                try {
                    const tronWeb = new TronWeb({
                        fullHost: 'https://api.trongrid.io',
                        headers: { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY || "" }
                    });
                    const balance = await tronWeb.trx.getBalance(process.env.STABLEX_HOT_WALLET_TRC20);
                    liveBalances.TRX = balance / 1e6;
                } catch (tronErr) {
                    console.warn("TRON balance fetch failed:", tronErr.message);
                    liveBalances.TRX = 0;
                }
            }
        } catch (err) {
            console.error("Live balance fetch error:", err.message);
        }
    }

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
            hotWallets: isSuperAdmin ? {
                BTC: {
                    address: hotWallets.BTC?.address || process.env.STABLEX_HOT_WALLET_BTC || 'Not configured',
                    balance: liveBalances.BTC || 0
                },
                ETH: {
                    address: hotWallets.ETH?.address || process.env.STABLEX_HOT_WALLET_ETH || 'Not configured',
                    balance: liveBalances.ETH || 0
                },
                TRC20: {
                    address: hotWallets.TRX?.address || process.env.STABLEX_HOT_WALLET_TRC20 || 'Not configured',
                    balance: liveBalances.TRX || 0
                },
                SOL: {
                    address: hotWallets.SOL?.address || process.env.STABLEX_HOT_WALLET_SOL || 'Not configured',
                    balance: liveBalances.SOL || 0
                },
            } : null,
            volumeToday,
        }
    });
});

// @desc    Update Hot Wallet Configuration
// @route   PUT /api/admin/config/hot-wallets
// @access  Private/Admin
export const updateHotWalletConfig = asyncHandler(async (req, res) => {
    if (req.user.email !== 'ukejejoseph1@gmail.com') {
        res.status(403);
        throw new Error('Restricted: Only the Super Admin can modify hot wallets.');
    }
    const { currency, address, privateKey } = req.body;

    if (!currency || !address) {
        res.status(400);
        throw new Error('Currency and address are required');
    }

    // In a real prod environment, we would save this to a secure vault or encrypted DB field.
    // For this dashboard, we will update the HOT_WALLETS.json file which sweep bots use.
    const hotWalletPath = path.join(process.cwd(), 'server', 'scripts', 'HOT_WALLETS.json');
    let configs = {};

    if (fs.existsSync(hotWalletPath)) {
        configs = JSON.parse(fs.readFileSync(hotWalletPath, 'utf8'));
    }

    configs[currency] = {
        address,
        privateKey: privateKey || configs[currency]?.privateKey,
        updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(hotWalletPath, JSON.stringify(configs, null, 2));

    console.log(`🔐 [ADMIN] Updated hot wallet config for ${currency}: ${address}`);

    res.json({
        success: true,
        message: `Hot wallet for ${currency} updated successfully`,
        config: { currency, address }
    });
});

// @desc    Get Specific Hot Wallet Configuration (including PK)
// @route   GET /api/admin/config/hot-wallets/:currency
// @access  Private/Admin
export const getHotWalletConfigDetail = asyncHandler(async (req, res) => {
    if (req.user.email !== 'ukejejoseph1@gmail.com') {
        res.status(403);
        throw new Error('Restricted: Only the Super Admin can view hot wallet details.');
    }
    const { currency } = req.params;

    const hotWalletPath = path.join(process.cwd(), 'server', 'scripts', 'HOT_WALLETS.json');
    if (!fs.existsSync(hotWalletPath)) {
        return res.json({ success: true, config: {} });
    }

    const configs = JSON.parse(fs.readFileSync(hotWalletPath, 'utf8'));
    const config = configs[currency] || {};

    res.json({
        success: true,
        config: {
            currency,
            address: config.address || process.env[`STABLEX_HOT_WALLET_${currency}`],
            privateKey: config.privateKey || 'Managed by environment variable',
            isEnv: !config.privateKey && !!process.env[`STABLEX_HOT_WALLET_${currency}`]
        }
    });
});
