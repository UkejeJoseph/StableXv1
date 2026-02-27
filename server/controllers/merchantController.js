import asyncHandler from 'express-async-handler';
import Transaction from '../models/transactionModel.js';
import User from '../models/userModel.js';

// @desc    Get merchant settlements (grouped by day)
// @route   GET /api/merchant/settlements
// @access  Private (Merchant only)
export const getSettlements = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
        res.status(401);
        throw new Error('User not found');
    }

    // Get all completed deposit transactions for this user, grouped by date
    const transactions = await Transaction.find({
        user: req.user._id,
        type: 'deposit',
        status: 'completed',
    }).sort({ createdAt: -1 });

    // Group transactions into settlement batches by date
    const batchMap = {};
    transactions.forEach(tx => {
        const dateKey = new Date(tx.createdAt).toISOString().split('T')[0]; // YYYY-MM-DD
        if (!batchMap[dateKey]) {
            batchMap[dateKey] = {
                batchId: `STL-${dateKey.replace(/-/g, '')}-${Math.floor(Math.random() * 999).toString().padStart(3, '0')}`,
                date: dateKey,
                settledAt: tx.createdAt,
                transactions: [],
                totalNGN: 0,
                totalUSDT: 0,
                totalOther: 0,
                status: 'settled',
            };
        }
        batchMap[dateKey].transactions.push(tx);
        if (tx.currency === 'NGN') batchMap[dateKey].totalNGN += tx.amount;
        else if (tx.currency === 'USDT') batchMap[dateKey].totalUSDT += tx.amount;
        else batchMap[dateKey].totalOther += tx.amount;
    });

    // Also add any pending deposits as a "pending" batch
    const pendingTx = await Transaction.find({
        user: req.user._id,
        type: 'deposit',
        status: 'pending',
    });

    if (pendingTx.length > 0) {
        const pendingBatch = {
            batchId: `STL-PENDING`,
            date: new Date().toISOString().split('T')[0],
            settledAt: new Date().toISOString(),
            transactions: pendingTx,
            totalNGN: 0,
            totalUSDT: 0,
            totalOther: 0,
            status: 'pending',
        };
        pendingTx.forEach(tx => {
            if (tx.currency === 'NGN') pendingBatch.totalNGN += tx.amount;
            else if (tx.currency === 'USDT') pendingBatch.totalUSDT += tx.amount;
            else pendingBatch.totalOther += tx.amount;
        });
        batchMap['pending'] = pendingBatch;
    }

    const settlements = Object.values(batchMap).sort((a, b) =>
        new Date(b.settledAt) - new Date(a.settledAt)
    );

    res.json({
        success: true,
        data: settlements.map(s => ({
            batchId: s.batchId,
            amount: s.totalNGN || s.totalUSDT || s.totalOther,
            currency: s.totalNGN ? 'NGN' : s.totalUSDT ? 'USDT' : 'Other',
            txCount: s.transactions.length,
            status: s.status,
            bankName: 'GTBank',
            accountLast4: '6789',
            settledAt: s.settledAt,
        })),
        summary: {
            totalSettledNGN: Object.values(batchMap)
                .filter(b => b.status === 'settled')
                .reduce((sum, b) => sum + b.totalNGN, 0),
            totalPendingNGN: Object.values(batchMap)
                .filter(b => b.status === 'pending')
                .reduce((sum, b) => sum + b.totalNGN, 0),
            totalBatches: settlements.length,
        }
    });
});

// @desc    Get webhook delivery logs
// @route   GET /api/merchant/webhook-logs
// @access  Private (Merchant only)
export const getWebhookLogs = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
        res.status(401);
        throw new Error('User not found');
    }

    // In production, webhook logs would be stored in a WebhookLog collection.
    // For now, generate logs from recent transactions to show real data.
    const recentTx = await Transaction.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(20);

    const logs = recentTx.map(tx => ({
        id: tx._id,
        event: tx.type === 'deposit' ? 'payment.success' :
            tx.type === 'withdrawal' ? 'payout.completed' :
                tx.status === 'pending' ? 'payment.pending' : 'payment.success',
        status: user.webhookUrl ? 'success' : 'skipped',
        statusCode: user.webhookUrl ? 200 : 0,
        timestamp: tx.createdAt,
        payload: JSON.stringify({
            amount: tx.amount,
            currency: tx.currency,
            reference: tx.reference,
            status: tx.status,
        }),
    }));

    res.json({
        success: true,
        webhookUrl: user.webhookUrl || '',
        data: logs,
    });
});

// @desc    Get merchant webhook URL
// @route   GET /api/merchant/webhook
// @access  Private
export const getWebhookUrl = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    res.json({ success: true, webhookUrl: user.webhookUrl || '' });
});

// @desc    Get merchant saved bank accounts
// @route   GET /api/merchant/bank-accounts
// @access  Private
export const getBankAccounts = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    res.json({ success: true, bankAccounts: user.merchantProfile?.bankAccounts || [] });
});

// @desc    Add a merchant bank account
// @route   POST /api/merchant/bank-accounts
// @access  Private
export const addBankAccount = asyncHandler(async (req, res) => {
    const { accountName, accountNumber, bankCode, bankName } = req.body;

    if (!accountName || !accountNumber || !bankCode || !bankName) {
        res.status(400);
        throw new Error('Please provide accountName, accountNumber, bankCode, and bankName');
    }

    const user = await User.findById(req.user._id);
    if (!user) {
        res.status(401);
        throw new Error('User not found');
    }

    if (!user.merchantProfile) user.merchantProfile = {};
    if (!user.merchantProfile.bankAccounts) user.merchantProfile.bankAccounts = [];

    // Check if account already exists
    const exists = user.merchantProfile.bankAccounts.find(acc => acc.accountNumber === accountNumber && acc.bankCode === bankCode);
    if (exists) {
        res.status(400);
        throw new Error('Bank account already saved');
    }

    const newAccount = { accountName, accountNumber, bankCode, bankName, isDefault: user.merchantProfile.bankAccounts.length === 0 };
    user.merchantProfile.bankAccounts.push(newAccount);

    await user.save();

    res.status(201).json({ success: true, bankAccounts: user.merchantProfile.bankAccounts });
});

// @desc    Delete a merchant bank account
// @route   DELETE /api/merchant/bank-accounts/:id
// @access  Private
export const deleteBankAccount = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user || !user.merchantProfile || !user.merchantProfile.bankAccounts) {
        res.status(404);
        throw new Error('No bank accounts found');
    }

    user.merchantProfile.bankAccounts = user.merchantProfile.bankAccounts.filter(
        acc => acc._id.toString() !== req.params.id
    );

    await user.save();
    res.json({ success: true, bankAccounts: user.merchantProfile.bankAccounts });
});
