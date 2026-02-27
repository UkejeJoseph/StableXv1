// ──────────────────────────────────────────────────────────────
// Payout Controller
// Express route handlers for Interswitch withdrawals/payouts
// ──────────────────────────────────────────────────────────────
import { getReceivingInstitutions, verifyBankAccount, initiateBankPayout } from '../services/payoutService.js';
import { IS_LIVE } from '../services/interswitchConfig.js';
import Transaction from '../models/transactionModel.js';
import Wallet from '../models/walletModel.js';

// ── GET /payout-banks ──────────────────────────────────────────
export async function handleGetPayoutBanks(req, res) {
    console.log('[CTRL:Payout] 🏦 Fetching supported receiving institutions...');

    try {
        const result = await getReceivingInstitutions();

        if (!result.ok) {
            console.error('[CTRL:Payout] 💥 Failed to fetch banks from ISW:', result.error);
            return res.status(result.status || 500).json({
                success: false,
                error: result.error || 'Failed to fetch bank list from provider.'
            });
        }

        const banks = result.data.institutions || result.data;

        if (!banks || banks.length === 0) {
            return res.status(503).json({
                success: false,
                message: 'Bank list temporarily unavailable. Please try again in a moment.'
            });
        }

        res.json({ success: true, banks: banks });

    } catch (error) {
        console.error('[CTRL:Payout] 💥 Failed to fetch banks:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}

// ── GET /account-inquiry ───────────────────────────────────────
export async function handleAccountInquiry(req, res) {
    console.log('');
    console.log('[CTRL:Payout] 🔍 REAL ACCOUNT NAME INQUIRY STARTED');

    try {
        const { bankCode, accountId } = req.query;

        if (!bankCode || !accountId) {
            return res.status(400).json({ success: false, error: 'Missing required query params: bankCode, accountId' });
        }

        // Bank account validation
        const accountRegex = /^\d{10}$/;
        if (!accountRegex.test(accountId)) {
            return res.status(400).json({
                success: false,
                message: 'Bank account number must be exactly 10 digits',
                field: 'accountId'
            });
        }

        const result = await verifyBankAccount(bankCode, accountId);

        if (!result.ok) {
            console.error('[CTRL:Payout] 💥 Account verification failed:', result.error);
            return res.status(422).json({
                success: false,
                message: 'Account verification failed. Please check the account number and bank code and try again.',
                details: result.error
            });
        }

        res.json({ success: true, accountName: result.data.accountName || result.data.name });

    } catch (error) {
        console.error('[CTRL:Payout] 💥 EXCEPTION:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}

// ── POST /transfer (Backend API endpoint for withdrawal) ───────
export async function handlePayoutTransfer(req, res) {
    const startTime = Date.now();
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('[CTRL:Payout] 💸 BANK PAYOUT INITIATED');
    console.log('[CTRL:Payout] Environment:', IS_LIVE ? '🔴 LIVE' : '🟢 TEST');
    console.log('═══════════════════════════════════════════════');

    try {
        const { amount, accountNumber, bankCode, beneficiaryName, narration, transactionRef } = req.body;
        const userId = req.user._id;

        if (!amount || !accountNumber || !bankCode || !beneficiaryName || !transactionRef) {
            return res.status(400).json({ success: false, error: 'Missing required fields for payout' });
        }

        // Bank account validation
        const accountRegex = /^\d{10}$/;
        if (!accountRegex.test(accountNumber)) {
            return res.status(400).json({
                success: false,
                message: 'Bank account number must be exactly 10 digits',
                field: 'accountNumber'
            });
        }

        if (!bankCode || bankCode.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Bank code is required',
                field: 'bankCode'
            });
        }

        const payoutAmount = parseFloat(amount);
        if (isNaN(payoutAmount) || payoutAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid payout amount' });
        }

        // 1. Check and debit wallet atomically
        const wallet = await Wallet.findOneAndUpdate(
            { user: userId, currency: 'NGN', balance: { $gte: payoutAmount } },
            { $inc: { balance: -payoutAmount } },
            { new: true }
        );

        if (!wallet) {
            return res.status(400).json({ success: false, error: 'Insufficient NGN balance or concurrent transaction' });
        }

        // 2. Log Transaction
        const transaction = await Transaction.create({
            user: userId,
            type: 'withdrawal',
            status: 'pending',
            amount: payoutAmount,
            currency: 'NGN',
            reference: transactionRef,
            description: narration || `Bank Transfer to ${beneficiaryName}`,
            metadata: {
                accountNumber,
                bankCode,
                beneficiaryName
            }
        });

        console.log('[CTRL:Payout] Ref:', transactionRef, 'Amount:', payoutAmount, 'Bank:', bankCode);
        console.log('[CTRL:Payout] ⏳ Calling Interswitch Bank Transfer Payout API...');

        const result = await initiateBankPayout({
            amount: payoutAmount,
            bankCode,
            accountNumber,
            beneficiaryName,
            narration,
            transactionRef
        });

        const elapsed = Date.now() - startTime;
        console.log(`[CTRL:Payout] ⏱️ Interswitch responded in ${elapsed}ms`);

        if (!result.ok) {
            console.log('[CTRL:Payout] ❌ Payout failed', result.error);
            // On failure, refund the wallet atomically
            await Wallet.findOneAndUpdate(
                { _id: wallet._id },
                { $inc: { balance: payoutAmount } }
            );

            transaction.status = 'failed';
            await transaction.save();

            return res.status(result.status || 400).json({
                success: false,
                error: typeof result.error === 'string' ? result.error : 'Interswitch processing error',
                details: result.error
            });
        }

        console.log('[CTRL:Payout] ✅ Payout processing completed!');
        transaction.status = 'completed';
        await transaction.save();

        res.json({ success: true, data: result.data, transactionRef });

    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`[CTRL:Payout] 💥 EXCEPTION after ${elapsed}ms:`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}
