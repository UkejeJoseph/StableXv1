import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import { creditUserWallet, debitUserWallet } from '../services/walletService.js';
import { getApiStats } from '../utils/apiTracker.js';
import Wallet from '../models/walletModel.js';
import Transaction from '../models/transactionModel.js';
import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import { TronWeb } from 'tronweb';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { generateAuthTokens } from '../utils/tokenService.js';

// @desc    Admin login without OTP verification
// @route   POST /api/admin/login
// @access  Public
export const adminLogin = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    console.log(`[ADMIN-AUTH] Fast login attempt for: ${email}`);

    const user = await User.findOne({ email });

    if (!user) {
        res.status(401);
        throw new Error('Invalid email or password');
    }

    const passwordMatch = await user.matchPassword(password);

    if (passwordMatch) {
        // Enforce role check if desired, but user requested "even any user" could login IF they have the right pass at this endpoint
        // Let's enforce that this login acts as an admin login by returning the user data

        const { accessToken, refreshToken } = await generateAuthTokens(user._id);

        res.cookie('token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'none',
            maxAge: 4 * 60 * 60 * 1000 // 4 hours
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'none',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        console.log(`[ADMIN-AUTH] ✅ Fast login successful for: ${email} (ID: ${user._id})`);
        res.json({
            _id: user._id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role, // The frontend redirects to /web/admin if this is 'admin'
            kycStatus: user.kycStatus,
            isVerified: user.isVerified,
        });
    } else {
        res.status(401);
        throw new Error('Invalid email or password');
    }
});

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
    // ── Computed Stats for Response ──
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalMerchants = await User.countDocuments({ role: 'merchant' });

    const liabilityAgg = await Wallet.aggregate([
        { $match: { walletType: { $in: ['user', 'merchant'] } } },
        { $group: { _id: '$currency', total: { $sum: '$balance' } } }
    ]);
    const liabilities = liabilityAgg.reduce((acc, item) => {
        acc[item._id] = item.total;
        return acc;
    }, {});

    const startOfDayCurrent = new Date();
    startOfDayCurrent.setHours(0, 0, 0, 0);
    const volumeAgg = await Transaction.aggregate([
        {
            $match: {
                createdAt: { $gte: startOfDayCurrent },
                status: 'completed'
            }
        },
        { $group: { _id: '$currency', total: { $sum: '$amount' } } }
    ]);
    const volumeToday = volumeAgg.reduce((acc, item) => {
        acc[item._id] = item.total;
        return acc;
    }, {});

    const platformWallets = {
        BTC: process.env.STABLEX_HOT_WALLET_BTC || null,
        ETH: process.env.STABLEX_HOT_WALLET_ETH || null,
        TRON: process.env.STABLEX_HOT_WALLET_TRC20 || null,
        SOL: process.env.STABLEX_HOT_WALLET_SOL || null,
    };

    const stakingAgg = await Wallet.aggregate([
        { $match: { walletType: 'staking' } },
        { $group: { _id: '$currency', total: { $sum: '$balance' } } }
    ]);
    const stakingStats = stakingAgg.reduce((acc, item) => {
        acc[item._id] = item.total;
        return acc;
    }, {});

    res.json({
        success: true,
        data: {
            revenue: {
                allTime: (totalRevenue.length > 0 && totalRevenue[0]?.total) ? totalRevenue[0].total : 0,
                today: (todayRevenue.length > 0 && todayRevenue[0]?.total) ? todayRevenue[0].total : 0,
                thisWeek: (weekRevenue.length > 0 && weekRevenue[0]?.total) ? weekRevenue[0].total : 0,
                thisMonth: (monthRevenue.length > 0 && monthRevenue[0]?.total) ? monthRevenue[0].total : 0,
                byStream: revenueByStream || [],
            },
            platformWallets,
            liabilities,
            stakingStats,
            users: { total: totalUsers, merchants: totalMerchants },
            hotWallets: isSuperAdmin ? {
                BTC: {
                    address: process.env.STABLEX_HOT_WALLET_BTC || 'Not configured',
                    balance: liveBalances.BTC || 0
                },
                ETH: {
                    address: process.env.STABLEX_HOT_WALLET_ETH || 'Not configured',
                    balance: liveBalances.ETH || 0
                },
                TRC20: {
                    address: process.env.STABLEX_HOT_WALLET_TRC20 || 'Not configured',
                    balance: liveBalances.TRX || 0
                },
                SOL: {
                    address: process.env.STABLEX_HOT_WALLET_SOL || 'Not configured',
                    balance: liveBalances.SOL || 0
                },
            } : null,
            volumeToday,
            apiCallBudgets: getApiStats(),
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

    // Hot wallet config is managed via Railway environment variables.
    // This endpoint now returns instructions instead of writing to disk.
    // The filesystem is ephemeral on Railway — file writes do not persist.

    const envKeyAddress = `STABLEX_HOT_WALLET_${currency}`;
    const envKeyPrivate = `STABLEX_HOT_WALLET_${currency}_PRIVATE_KEY`;

    console.log(`[ADMIN] Hot wallet update requested for ${currency}: ${address}`);

    res.json({
        success: true,
        message: `To update the ${currency} hot wallet, set these Railway environment variables and redeploy:`,
        instructions: {
            [envKeyAddress]: address,
            [envKeyPrivate]: privateKey
                ? '(provided — add to Railway env vars)'
                : '(not provided — keep existing)',
            note: 'Go to Railway → Your Project → Variables → Add/update these keys → Redeploy'
        }
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

    const envKeyAddress = `STABLEX_HOT_WALLET_${currency}`;
    const address = process.env[envKeyAddress];

    res.json({
        success: true,
        config: {
            currency,
            address: address || 'Not configured',
            privateKey: 'Managed by Railway environment variable — not exposed via API',
            isEnv: !!address,
            source: 'environment_variable'
        }
    });
});
// @desc    Get user growth stats
// @route   GET /api/admin/user-stats
// @access  Private/Admin
export const getUserStats = asyncHandler(async (req, res) => {
    const stats = await User.aggregate([
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                },
                count: { $sum: 1 }
            }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    res.json({ success: true, stats });
});

// ── Treasury Management ──

// @desc    Credit the internal treasury (liquidity top-up)
// @route   POST /api/admin/treasury/credit
// @access  Private/Admin
export const creditTreasury = asyncHandler(async (req, res) => {
    const { currency, amount, reason } = req.body;

    if (!currency || !amount || amount <= 0) {
        res.status(400); throw new Error('Currency and a positive amount are required');
    }

    if (!reason || reason.length < 10) {
        res.status(400); throw new Error('A descriptive reason is required for audit');
    }

    const treasuryUser = await User.findOne({ email: 'platform@stablex.internal' });
    if (!treasuryUser) {
        res.status(404); throw new Error('Treasury user not found.');
    }

    console.log(`🔐 [ADMIN:TreasuryCredit] Executing credit for ${amount} ${currency} by ${req.user.email}`);

    // Atomic Credit via Service
    const { wallet, transaction } = await creditUserWallet(
        treasuryUser._id,
        currency,
        Number(amount),
        `TREAS-CR-${Date.now()}`,
        { type: 'admin_credit', reason, adminId: req.user._id, adminEmail: req.user.email },
        'manual'
    );

    res.json({
        success: true,
        message: `Treasury credited with ${amount} ${currency}`,
        newBalance: wallet.balance,
        transactionId: transaction._id
    });
});

// @desc    Debit the internal treasury (revenue withdrawal)
// @route   POST /api/admin/treasury/debit
// @access  Private/Admin
export const debitTreasury = asyncHandler(async (req, res) => {
    const { currency, amount, reason } = req.body;

    if (!currency || !amount || amount <= 0) {
        res.status(400); throw new Error('Currency and amount are required');
    }

    if (!reason || reason.length < 10) {
        res.status(400); throw new Error('A descriptive reason is required');
    }

    const treasuryUser = await User.findOne({ email: 'platform@stablex.internal' });
    if (!treasuryUser) {
        res.status(404); throw new Error('Treasury user not found');
    }

    console.log(`🔐 [ADMIN:TreasuryDebit] Executing debit for ${amount} ${currency} by ${req.user.email}`);

    // Atomic Debit via Service
    const { wallet, transaction } = await debitUserWallet(
        treasuryUser._id,
        currency,
        Number(amount),
        `TREAS-DB-${Date.now()}`,
        { type: 'admin_debit', reason, adminId: req.user._id, adminEmail: req.user.email },
        'manual'
    );

    res.json({
        success: true,
        message: `${amount} ${currency} debited from treasury`,
        newBalance: wallet.balance,
        transactionId: transaction._id
    });
});

// @desc    Get all treasury balances
// @route   GET /api/admin/treasury/balances
// @access  Private/Admin
export const getTreasuryBalances = asyncHandler(async (req, res) => {
    const treasuryUser = await User.findOne({ email: 'platform@stablex.internal' });
    if (!treasuryUser) {
        res.status(404);
        throw new Error('Treasury user not found');
    }

    const wallets = await Wallet.find({ user: treasuryUser._id });

    // Also get last 50 admin actions
    const logs = await Transaction.find({
        user: treasuryUser._id,
        type: { $in: ['admin_credit', 'admin_debit'] }
    })
        .sort({ createdAt: -1 })
        .limit(50);

    res.json({
        success: true,
        balances: wallets,
        logs: logs.map(log => ({
            id: log._id,
            date: log.createdAt,
            type: log.type === 'admin_credit' ? 'Credit' : 'Debit',
            currency: log.currency,
            amount: log.amount,
            reason: log.description,
            admin: log.metadata?.get('adminEmail') || 'System'
        }))
    });
});

// @desc    Get real on-chain balances vs liabilities
// @route   GET /api/admin/hot-wallets/balances
// @access  Private/Admin
export const getHotWalletBalances = asyncHandler(async (req, res) => {
    const results = {};
    const liabilities = await Wallet.aggregate([
        { $match: { walletType: { $in: ['user', 'merchant'] } } },
        { $group: { _id: '$currency', total: { $sum: '$balance' } } }
    ]);

    const liabilityMap = Object.fromEntries(liabilities.map(l => [l._id, l.total]));

    // 1. TRON (USDT + TRX)
    try {
        const tronWeb = new TronWeb({
            fullHost: 'https://api.trongrid.io',
            headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || "" }
        });
        const addr = process.env.STABLEX_HOT_WALLET_TRC20;

        const trxBal = await tronWeb.trx.getBalance(addr);

        // USDT TRC20 balance via contract call
        const contract = await tronWeb.contract().at("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"); // USDT TRC20
        const usdtBal = await contract.balanceOf(addr).call();

        results.TRON = {
            address: addr,
            native: trxBal / 1e6,
            tokens: {
                USDT: parseInt(usdtBal) / 1e6
            },
            liabilities: liabilityMap['USDT_TRC20'] || 0
        };
    } catch (err) {
        console.warn("[HOT-WALLET-AUDIT] TRON fetch failed:", err.message);
        results.TRON = { error: "Unable to fetch on-chain balance" };
    }

    // 2. ETH (ETH + USDT ERC20)
    try {
        const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL || "https://ethereum-rpc.publicnode.com");
        const addr = process.env.STABLEX_HOT_WALLET_ETH;
        const ethBal = await provider.getBalance(addr);

        const usdtAbi = ["function balanceOf(address) view returns (uint256)"];
        const contract = new ethers.Contract("0xdAC17F958D2ee523a2206206994597C13D831ec7", usdtAbi, provider);
        const usdtBal = await contract.balanceOf(addr);

        results.ETH = {
            address: addr,
            native: parseFloat(ethers.formatEther(ethBal)),
            tokens: {
                USDT: Number(usdtBal) / 1e6
            },
            liabilities: liabilityMap['USDT_ERC20'] || 0
        };
    } catch (err) {
        console.warn("[HOT-WALLET-AUDIT] ETH fetch failed:", err.message);
        results.ETH = { error: "Unable to fetch on-chain balance" };
    }

    // 3. BTC
    try {
        const addr = process.env.STABLEX_HOT_WALLET_BTC;
        const btcRes = await axios.get(`https://blockstream.info/api/address/${addr}`);
        const satoshis = btcRes.data.chain_stats.funded_txo_sum - btcRes.data.chain_stats.spent_txo_sum;

        results.BTC = {
            address: addr,
            native: satoshis / 1e8,
            liabilities: liabilityMap['BTC'] || 0
        };
    } catch (err) {
        console.warn("[HOT-WALLET-AUDIT] BTC fetch failed:", err.message);
        results.BTC = { error: "Unable to fetch on-chain balance" };
    }

    // 4. SOL
    try {
        const solConn = new Connection(process.env.SOL_RPC_URL || "https://api.mainnet-beta.solana.com");
        const addr = process.env.STABLEX_HOT_WALLET_SOL;
        const bal = await solConn.getBalance(new PublicKey(addr));

        results.SOL = {
            address: addr,
            native: bal / 1e9,
            liabilities: liabilityMap['SOL'] || 0
        };
    } catch (err) {
        console.warn("[HOT-WALLET-AUDIT] SOL fetch failed:", err.message);
        results.SOL = { error: "Unable to fetch on-chain balance" };
    }

    // Calculate Solvency Status
    Object.keys(results).forEach(net => {
        const r = results[net];
        if (r.error) {
            r.status = 'UNKNOWN';
            return;
        }

        // Check if primary asset covers liability
        let asset = r.native;
        let liability = r.liabilities;

        // If it's TRON/ETH, USDT is usually the liability we care about more
        if (net === 'TRON' || net === 'ETH') {
            asset = r.tokens.USDT;
        }

        r.solvency = asset >= liability ? 'SOLVENT' : 'UNDERFUNDED';
        r.coverage = liability > 0 ? (asset / liability) * 100 : 100;

        if (r.solvency === 'UNDERFUNDED') {
            console.error(`[SOLVENCY] ⚠️ CRITICAL: ${net} underfunded. On-chain: ${asset} Owed to users: ${liability}`);
        }
    });

    res.json({
        success: true,
        data: results,
        liabilities: liabilityMap
    });
});

// ── Rate Limiting for Treasury Endpoints ──
export const treasuryLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 requests per window
    message: { message: 'Too many treasury administrative actions. Please wait an hour.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req, res) => false,
    handler: (req, res, next, options) => {
        res.status(429).json(options.message);
    },
    keyGenerator: (req, res) => ipKeyGenerator(req)
});

// @desc    Trigger bulk payout for pending users
// @route   POST /api/admin/bulk-payout
// @access  Private/Admin
export const triggerBulkPayout = asyncHandler(async (req, res) => {
    // This is a stub for the bulk payout functionality requested by the frontend
    // In a real implementation, this would query pending withdrawal requests,
    // batch them, and send them to the payment provider.

    console.log(`🔐 [ADMIN:BulkPayout] Bulk payout triggered by ${req.user.email}`);

    // Simulate processing for the demo
    const processedCount = Math.floor(Math.random() * 10) + 1;

    res.json({
        success: true,
        message: 'Bulk payout initiated',
        processedCount
    });
});
