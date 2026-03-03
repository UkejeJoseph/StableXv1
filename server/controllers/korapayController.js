import crypto from 'crypto';
import korapayService from '../services/korapayService.js';
import Transaction from '../models/transactionModel.js';
import User from '../models/userModel.js';
import { creditUserWallet, debitUserWallet } from '../services/walletService.js';


/**
 * Initialize a deposit (Pay-in) via Checkout Redirect
 */
export const initializeDeposit = async (req, res) => {
    try {
        const { amount, redirectUrl } = req.body;

        if (!amount || Number(amount) <= 0) {
            return res.status(400).json({ message: 'Invalid amount' });
        }

        const user = req.user;
        const reference = `STX-KPY-${Date.now()}-${user._id}`;
        console.log('[KORAPAY-CHECKOUT] Generated reference:', reference);

        // Create a pending transaction
        await Transaction.create({
            userId: user._id, // ✅ Consistent with new model
            type: 'ngn_deposit', // ✅ Consistent with new model
            status: 'pending',
            amount: Number(amount),
            currency: 'NGN',
            reference,
            provider: 'korapay', // ✅ Added provider
            metadata: { description: 'Korapay Web Checkout Deposit' },
        });

        const name = user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'StableX User';

        // Call Korapay Service
        const koraData = await korapayService.initializeCheckoutCharge({
            amount: Math.floor(parseFloat(amount)),
            email: user.email,
            name,
            reference,
            redirectUrl: redirectUrl || `${process.env.FRONTEND_URL}/web/deposit`
        });

        res.status(200).json({
            message: 'Checkout initialized successfully',
            publicKey: process.env.KORAPAY_PUBLIC_KEY, // ✅ Return PK for modal
            reference,
            checkoutUrl: koraData.checkoutUrl
        });
    } catch (error) {
        console.error('Korapay initializeDeposit error:', error);
        res.status(500).json({ message: error.message || 'Payment initialization failed' });
    }
};

/**
 * Create a Temporary Bank Account for a specific NGN deposit (Jeroid style)
 */
export const createTemporaryAccount = async (req, res) => {
    try {
        const { amount } = req.body;
        const user = req.user;

        if (!amount || Number(amount) <= 0) {
            return res.status(400).json({ message: 'Invalid amount' });
        }

        const accountReference = `KO_TEMP_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

        // Create a pending transaction for this account
        await Transaction.create({
            userId: user._id, // ✅ Consistent with new model
            type: 'ngn_deposit', // ✅ Consistent with new model
            status: 'pending',
            amount: Number(amount),
            currency: 'NGN',
            reference: accountReference,
            provider: 'korapay', // ✅ Added provider
            metadata: { description: 'Korapay Temporary Bank Transfer' },
        });

        // Request a non-permanent account from Kora
        const koraRes = await korapayService.initializeBankTransfer({
            amount: Number(amount),
            name: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'StableX User',
            email: user.email,
            reference: accountReference
        });

        if (!koraRes.status) {
            throw new Error(koraRes.message || 'Failed to generate bank account');
        }

        const vbaData = koraRes.data;

        res.status(200).json({
            success: true,
            message: 'Temporary bank account generated',
            virtualAccount: {
                bankName: vbaData.bank_name,
                bankCode: vbaData.bank_code,
                accountNumber: vbaData.account_number,
                accountReference: accountReference,
                accountName: vbaData.account_name,
                amount: Number(amount)
            }
        });
    } catch (error) {
        console.error('Korapay createTemporaryAccount error:', error);
        res.status(500).json({ message: error.message || 'Failed to generate temporary account' });
    }
};

/**
 * Initialize a "Pay with Bank" (Direct Debit) transaction
 */
export const initializePayWithBank = async (req, res) => {
    try {
        const { amount, bankCode, redirectUrl, narration } = req.body;
        const user = req.user;

        if (!amount || Number(amount) < 200) {
            return res.status(400).json({ message: 'Minimum amount for Pay with Bank is ₦200' });
        }

        if (!bankCode) {
            return res.status(400).json({ message: 'Bank code is required' });
        }

        const reference = `STX-KPY-PWB-${Date.now()}-${user._id}`;
        console.log('[KORAPAY-PWB] Generated reference:', reference);

        // Create a pending transaction
        await Transaction.create({
            userId: user._id,
            type: 'ngn_deposit',
            status: 'pending',
            amount: Number(amount),
            currency: 'NGN',
            reference,
            provider: 'korapay',
            metadata: { description: 'Korapay Pay with Bank Deposit', bankCode, narration },
        });

        const name = user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'StableX User';

        // Call Korapay Service
        const koraRes = await korapayService.initializePayWithBank({
            amount: Number(amount),
            name,
            email: user.email,
            reference,
            bankCode,
            redirectUrl,
            narration: narration || 'StableX NGN Deposit'
        });

        if (!koraRes.status) {
            throw new Error(koraRes.message || 'Failed to initialize Pay with Bank');
        }

        res.status(200).json({
            success: true,
            message: 'Pay with Bank initialized',
            checkoutUrl: koraRes.data.authorization?.redirect_url,
            reference
        });
    } catch (error) {
        console.error('Korapay initializePayWithBank error:', error);
        res.status(500).json({ message: error.message || 'Payment initialization failed' });
    }
};

/**
 * Verify a deposit (Pay-in) status
 */
export const verifyDeposit = async (req, res) => {
    try {
        const { reference } = req.body; // ✅ Frontend sends this in body (POST)

        if (!reference) {
            return res.status(400).json({ message: 'Reference is required' });
        }

        const transaction = await Transaction.findOne({ reference, provider: 'korapay' });
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        // If already processed via webhook, return early
        if (transaction.status === 'success') {
            return res.status(200).json({
                success: true,
                message: 'Transaction already completed',
                amount: transaction.amount
            });
        }

        const chargeData = await korapayService.queryCharge(reference);

        if (chargeData.status === 'success') {
            if (transaction.status !== 'success') {
                // ✅ Credit the NGN Wallet atomically via unified service
                await creditUserWallet(
                    transaction.userId,
                    'NGN',
                    transaction.amount,
                    reference,
                    { korapayData: chargeData, method: 'verify_call' },
                    'korapay'
                );
            }
            return res.status(200).json({
                success: true,
                message: 'Deposit successful',
                amount: transaction.amount
            });
        } else if (chargeData.status === 'failed') {
            transaction.status = 'failed';
            await transaction.save();
            return res.status(400).json({ success: false, message: 'Deposit failed on Korapay' });
        }

        res.status(200).json({ success: false, message: 'Deposit still pending', status: chargeData.status });
    } catch (error) {
        console.error('Korapay verifyDeposit error:', error);
        res.status(500).json({ message: error.message || 'Verification failed' });
    }
};

/**
 * Initiate a Payout (Withdrawal)
 */
export const initiatePayout = async (req, res) => {
    const { amount, bankCode, accountNumber } = req.body;
    const userId = req.user._id;

    console.log('[KORAPAY-PAYOUT] ══════════════════════════');
    console.log('[KORAPAY-PAYOUT] User:', userId, 'Amount: ₦', amount);
    console.log('[KORAPAY-PAYOUT] Bank:', bankCode, 'Account:', accountNumber);

    try {
        // Step 1: Resolve bank account first
        console.log('[KORAPAY-PAYOUT] Step 1: Resolving bank account...');
        const resolved = await korapayService.resolveBankAccount(bankCode, accountNumber);

        if (!resolved) {
            console.error('[KORAPAY-PAYOUT] ❌ Bank account resolution failed');
            return res.status(400).json({ success: false, error: 'Invalid bank account details' });
        }

        const reference = `STX-KPY-WDR-${Date.now()}`;
        const narration = 'StableX NGN Withdrawal';

        // Step 2 & 3: Check balance and deduct atomically via unified service
        console.log('[KORAPAY-PAYOUT] Step 2: Deducting balance via walletService...');
        const debitResult = await debitUserWallet(userId, 'NGN', amount, reference, {
            bankCode,
            accountNumber,
            accountName: resolved.account_name,
        }, 'korapay');

        const transaction = debitResult.transaction;
        const user = req.user;

        // Step 4: Send payout request via korapayService
        console.log('[KORAPAY-PAYOUT] Step 3: Sending payout to KoraPay service...');
        const payoutResult = await korapayService.disburseToBankAccount(
            amount,
            bankCode,
            accountNumber,
            resolved.account_name,
            reference,
            user.email,
            user.fullName || user.username,
            narration
        );

        console.log('[KORAPAY-PAYOUT] Response:', JSON.stringify(payoutResult));

        if (!payoutResult.status) {
            // 🔴 CRITICAL: Check if it's a re-triable error or a definitive failure
            // If it's a 4xx "insufficient funds" on OUR bank account, or validation error
            console.error('[KORAPAY-PAYOUT] ❌ KoraPay rejected payout:', payoutResult.message);

            // Refund the user atomically
            await creditUserWallet(userId, 'NGN', amount, `refund_${reference}`, {
                type: 'withdrawal_refund',
                reason: payoutResult.message
            }, 'korapay');

            transaction.status = 'failed';
            await transaction.save();

            return res.status(400).json({ success: false, error: payoutResult.message });
        }

        console.log('[KORAPAY-PAYOUT] ✅ Payout initiated successfully');
        transaction.status = 'completed'; // For Korapay, initiation is often success
        await transaction.save();

        res.json({
            success: true,
            message: 'Withdrawal initiated successfully',
            reference,
            accountName: resolved.account_name,
        });

    } catch (err) {
        console.error('[KORAPAY-PAYOUT] ❌ FATAL:', err.message);
        return res.status(500).json({ success: false, error: err.message || 'Payout failed' });
    }
};

/**
 * Resolve Bank Account Name
 */
export const resolveAccount = async (req, res) => {
    try {
        const { bankCode, accountNumber } = req.query;
        if (!bankCode || !accountNumber) {
            return res.status(400).json({ message: 'Bank code and account number are required' });
        }

        console.log(`[KORAPAY-RESOLVE] 🔍 Resolving: ${accountNumber} at ${bankCode}`);
        const resolved = await korapayService.resolveBankAccount(bankCode, accountNumber);

        if (!resolved) {
            return res.status(404).json({ message: 'Could not resolve account name' });
        }

        res.status(200).json({
            success: true,
            accountName: resolved.account_name,
            accountNumber: resolved.account_number,
            bankCode: bankCode
        });
    } catch (error) {
        console.error('Korapay resolveAccount error:', error);
        res.status(500).json({ message: error.message || 'Failed to resolve account' });
    }
};

/**
 * Get Supported Banks
 */
export const getBanks = async (req, res) => {
    try {
        console.log('[KORAPAY-BANKS] 🏦 Fetching bank list...');
        const banks = await korapayService.listBanks();
        res.status(200).json(banks);
    } catch (error) {
        console.error('Korapay getBanks error:', error);
        res.status(500).json({ message: error.message || 'Failed to fetch banks' });
    }
};

/**
 * Get Supported Banks for Pay with Bank
 */
export const getPayWithBankBanks = async (req, res) => {
    try {
        console.log('[KORAPAY-PWB-BANKS] 🏦 Fetching PWB bank list...');
        const banks = await korapayService.listPayWithBankBanks();
        res.status(200).json(banks);
    } catch (error) {
        console.error('Korapay getPayWithBankBanks error:', error);
        res.status(500).json({ message: error.message || 'Failed to fetch PWB banks' });
    }
};

