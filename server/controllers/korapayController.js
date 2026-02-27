import crypto from 'crypto';
import korapayService from '../services/korapayService.js';
import Transaction from '../models/transactionModel.js';
import Wallet from '../models/walletModel.js';
import User from '../models/userModel.js';


/**
 * Initialize a deposit (Pay-in) via Checkout Redirect
 */
export const initializeDeposit = async (req, res) => {
    try {
        const { amount, redirectUrl } = req.body;

        if (!amount || Number(amount) <= 0) {
            return res.status(400).json({ message: 'Invalid amount' });
        }

        const reference = `KO_DEP_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
        const user = req.user;

        // Create a pending transaction
        await Transaction.create({
            user: user._id,
            type: 'deposit',
            status: 'pending',
            amount: Number(amount),
            currency: 'NGN',
            reference,
            description: 'Korapay Web Checkout Deposit',
        });

        const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'StableX User';

        // Call Korapay Service
        const checkoutData = await korapayService.initializeCheckoutCharge(
            Number(amount),
            user.email,
            name,
            reference,
            redirectUrl || `${process.env.FRONTEND_URL}/web/deposit`
        );

        res.status(200).json({
            message: 'Checkout initialized successfully',
            checkoutUrl: checkoutData.checkout_url,
            reference,
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
            user: user._id,
            type: 'deposit',
            status: 'pending',
            amount: Number(amount),
            currency: 'NGN',
            reference: accountReference,
            description: 'Korapay Temporary Bank Transfer',
        });

        // Request a non-permanent account from Kora
        const vbaData = await korapayService.createVirtualAccount(user, accountReference, false);

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
 * Verify a deposit (Pay-in) status
 */
export const verifyDeposit = async (req, res) => {
    try {
        const { reference } = req.params;

        const transaction = await Transaction.findOne({ reference });
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        // If already processed via webhook, return early
        if (transaction.status === 'completed') {
            return res.status(200).json({ message: 'Transaction already completed', transaction });
        }

        const chargeData = await korapayService.queryCharge(reference);

        if (chargeData.status === 'success') {
            if (transaction.status !== 'completed') {
                transaction.status = 'completed';
                transaction.metadata = { ...transaction.metadata, korapayData: JSON.stringify(chargeData) };
                await transaction.save();

                // Credit the NGN Wallet
                let walletType = 'user';
                if (req.user && req.user.role === 'merchant') walletType = 'merchant';

                await Wallet.findOneAndUpdate(
                    { user: transaction.user, currency: 'NGN', walletType },
                    { $inc: { balance: transaction.amount } },
                    { new: true, upsert: true }
                );
            }
            return res.status(200).json({ message: 'Deposit successful', transaction });
        } else if (chargeData.status === 'failed') {
            transaction.status = 'failed';
            await transaction.save();
            return res.status(400).json({ message: 'Deposit failed on Korapay', transaction });
        }

        res.status(200).json({ message: 'Deposit still pending', transaction, status: chargeData.status });
    } catch (error) {
        console.error('Korapay verifyDeposit error:', error);
        res.status(500).json({ message: error.message || 'Verification failed' });
    }
};

/**
 * Initiate a Payout (Withdrawal)
 */
export const initiatePayout = async (req, res) => {
    try {
        const { amount, bankCode, accountNumber, accountName } = req.body;
        const user = req.user;

        if (!amount || !bankCode || !accountNumber || !accountName) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const withdrawAmount = Number(amount);
        if (withdrawAmount <= 0) {
            return res.status(400).json({ message: 'Invalid payout amount' });
        }

        let walletType = user.role === 'merchant' ? 'merchant' : 'user';

        // 1. Debit Wallet Safely Avoid negative balance
        const wallet = await Wallet.findOneAndUpdate(
            { user: user._id, currency: 'NGN', walletType, balance: { $gte: withdrawAmount } },
            { $inc: { balance: -withdrawAmount } },
            { new: true }
        );

        if (!wallet) {
            return res.status(400).json({ message: 'Insufficient NGN balance' });
        }

        const reference = `KO_PAY_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

        // 2. Create Transaction Record
        const transaction = await Transaction.create({
            user: user._id,
            type: 'withdrawal',
            status: 'pending', // Will be updated by webhook
            amount: withdrawAmount,
            currency: 'NGN',
            reference,
            description: `Bank Withdrawal to ${accountNumber} (${bankCode})`,
        });

        // 3. Call Korapay
        try {
            const payoutData = await korapayService.disburseToBankAccount(
                withdrawAmount,
                bankCode,
                accountNumber,
                accountName,
                reference
            );

            return res.status(200).json({
                message: 'Payout initiated successfully',
                reference,
                status: payoutData.status // 'processing' usually
            });

        } catch (koraError) {
            // 4. REVERT on initial failure
            console.error('Korapay Payout API failed, reverting debit:', koraError.message);
            await Wallet.findOneAndUpdate(
                { _id: wallet._id },
                { $inc: { balance: withdrawAmount } }
            );
            transaction.status = 'failed';
            transaction.description += ` | Error: ${koraError.message}`;
            await transaction.save();

            return res.status(500).json({ message: koraError.message || 'Payout request failed' });
        }
    } catch (error) {
        console.error('Korapay initiatePayout error:', error);
        res.status(500).json({ message: error.message || 'Payout failed' });
    }
};

/**
 * Get Supported Banks
 */
export const getBanks = async (req, res) => {
    try {
        const banks = await korapayService.listBanks();
        res.status(200).json(banks);
    } catch (error) {
        console.error('Korapay getBanks error:', error);
        res.status(500).json({ message: error.message || 'Failed to fetch banks' });
    }
};

/**
 * Webhook handler for async status updates
 */
export const handleWebhook = async (req, res) => {
    try {
        const signature = req.headers['x-korapay-signature'];

        // Verify Webhook Signature using raw body if available
        const verificationBody = req.rawBody || req.body;
        if (!korapayService.verifyWebhookSignature(verificationBody, signature)) {
            console.warn('Invalid Korapay webhook signature');
            return res.status(401).send('Unauthorized');
        }

        const event = req.body;
        console.log(`[KORAPAY WEBHOOK] Received event: ${event.event}`);

        const data = event.data;
        // For virtual account payments, the unique identifier is account_reference
        // For checkout charges, it is reference
        const reference = data.reference || data.account_reference;

        if (!reference) return res.status(200).send('OK');

        const transaction = await Transaction.findOne({ reference });
        if (!transaction) {
            console.warn(`[KORAPAY WEBHOOK] Transaction not found for ref: ${reference}`);
            return res.status(200).send('OK');
        }

        if (transaction.status === 'completed' || transaction.status === 'failed') {
            return res.status(200).send('OK'); // Already handled
        }

        // ── Handle Successful Pay-ins (Deposits & Virtual Accounts) ──
        if (event.event === 'charge.success' || event.event === 'virtual_bank_account.payment') {

            const amount = data.amount || data.amount_paid || transaction.amount;
            const targetUser = await User.findById(transaction.user);

            if (!targetUser) {
                console.error(`[KORAPAY WEBHOOK] User not found for transaction: ${transaction._id}`);
                return res.status(200).send('OK');
            }

            transaction.status = 'completed';
            transaction.metadata = { ...transaction.metadata, korapayWebhook: 'success', event: event.event };
            // Ensure actual amount paid is recorded if different
            if (data.amount_paid && data.amount_paid !== transaction.amount) {
                transaction.amount = data.amount_paid;
                transaction.description += ` (Adjusted amount: ${data.amount_paid})`;
            }
            await transaction.save();

            let walletType = targetUser.role === 'merchant' ? 'merchant' : 'user';

            await Wallet.findOneAndUpdate(
                { user: targetUser._id, currency: 'NGN', walletType },
                { $inc: { balance: Number(amount) } },
                { upsert: true }
            );
            console.log(`[KORAPAY WEBHOOK] Credited ${walletType} for ${amount} NGN (Ref: ${reference})`);
        }
        // ── Handle Failed Pay-ins ──
        else if (event.event === 'charge.failed') {
            if (transaction) {
                transaction.status = 'failed';
                await transaction.save();
            }
        }
        // ── Handle Successful Payouts (Withdrawals) ──
        else if (event.event === 'transfer.success') {
            if (transaction) {
                transaction.status = 'completed';
                await transaction.save();
            }
            console.log(`[KORAPAY WEBHOOK] Marked payout ${reference} as completed`);
        }
        // ── Handle Failed Payouts (Revert Deduction) ──
        else if (event.event === 'transfer.failed') {
            if (transaction) {
                transaction.status = 'failed';
                await transaction.save();

                const targetUser = await User.findById(transaction.user);
                let walletType = targetUser?.role === 'merchant' ? 'merchant' : 'user';

                // Revert the deducted balance
                await Wallet.findOneAndUpdate(
                    { user: transaction.user, currency: 'NGN', walletType },
                    { $inc: { balance: transaction.amount } }
                );
                console.log(`[KORAPAY WEBHOOK] Reverted failed payout ${reference}`);
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Korapay Webhook Error:', error);
        res.status(500).send('Webhook Processing Error');
    }
};
