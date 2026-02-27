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
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

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

    // 1. Validation
    if (!currency || !amount || amount <= 0) {
        res.status(400);
        throw new Error('Currency and a positive amount are required');
    }

    if (!reason || reason.length < 10) {
        res.status(400);
        throw new Error('A descriptive reason (min 10 chars) is required for audit purposes');
    }

    const VALID_CURRENCIES = ['NGN', 'USDT_TRC20', 'USDT_ERC20', 'ETH', 'BTC', 'SOL', 'TRX'];
    if (!VALID_CURRENCIES.includes(currency)) {
        res.status(400);
        throw new Error('Invalid currency for treasury credit');
    }

    // 2. Find/Verify Treasury User
    const treasuryUser = await User.findOne({ email: 'platform@stablex.internal' });
    if (!treasuryUser) {
        res.status(404);
        throw new Error('Treasury user not found. Please run the platform wallet initialization script.');
    }

    // 3. Atomic Credit
    const wallet = await Wallet.findOneAndUpdate(
        { user: treasuryUser._id, currency, walletType: 'treasury' },
        { $inc: { balance: Number(amount) } },
        { new: true, upsert: true }
    );

    // 4. Create Audit Log (Transaction)
    await Transaction.create({
        user: treasuryUser._id,
        type: 'admin_credit',
        currency,
        amount: Number(amount),
        status: 'completed',
        reference: `admin_credit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        description: reason,
        metadata: {
            adminId: req.user._id,
            adminEmail: req.user.email,
            ip: req.ip
        }
    });

    console.log(`🔐 [ADMIN] ${req.user.email} credited ${amount} ${currency} to treasury. Reason: ${reason}`);

    res.json({
        success: true,
        message: `Treasury credited with ${amount} ${currency}`,
        newBalance: wallet.balance,
        currency
    });
});

// @desc    Debit the internal treasury (revenue withdrawal)
// @route   POST /api/admin/treasury/debit
// @access  Private/Admin
export const debitTreasury = asyncHandler(async (req, res) => {
    const { currency, amount, reason } = req.body;

    if (!currency || !amount || amount <= 0) {
        res.status(400);
        throw new Error('Currency and amount are required');
    }

    if (!reason || reason.length < 10) {
        res.status(400);
        throw new Error('A descriptive reason is required');
    }

    const treasuryUser = await User.findOne({ email: 'platform@stablex.internal' });
    if (!treasuryUser) {
        res.status(404);
        throw new Error('Treasury user not found');
    }

    // Atomic Balance Check + Debit
    const wallet = await Wallet.findOneAndUpdate(
        {
            user: treasuryUser._id,
            currency,
            balance: { $gte: Number(amount) }
        },
        { $inc: { balance: -Number(amount) } },
        { new: true }
    );

    if (!wallet) {
        res.status(400);
        throw new Error(`Insufficient treasury balance in ${currency}`);
    }

    // Audit Log
    await Transaction.create({
        user: treasuryUser._id,
        type: 'admin_debit',
        currency,
        amount: Number(amount),
        status: 'completed',
        reference: `admin_debit_${Date.now()}`,
        description: reason,
        metadata: {
            adminId: req.user._id,
            adminEmail: req.user.email
        }
    });

    res.json({
        success: true,
        message: `${amount} ${currency} debited from treasury`,
        newBalance: wallet.balance,
        currency
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
        { $match: { walletType: 'user' } },
        { $group: { _id: '$currency', total: { $sum: '$balance' } } }
    ]);

    const liabilityMap = Object.fromEntries(liabilities.map(l => [l._id, l.total]));

    // 1. TRON (USDT + TRX)
    try {
        const tronWeb = new TronWeb({
            fullHost: 'https://api.trongrid.io',
            headers: { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY || "" }
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
    keyGenerator: (req, res) => ipKeyGenerator(req) // Rate limit per IP using helper for IPv6 support
});
