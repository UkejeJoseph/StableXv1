import Wallet from '../models/walletModel.js';
import Transaction from '../models/transactionModel.js';

/**
 * Credits a user's wallet using atomic operations and updates the associated transaction.
 * @param {string} userId - ID of the user
 * @param {string} currency - Wallet currency (e.g., 'NGN', 'USDT_TRC20')
 * @param {number} amount - Amount to credit
 * @param {string} transactionRef - Reference of the transaction
 * @param {Object} metadata - Extra metadata to save in the transaction
 * @returns {Promise<Object>} - The updated wallet and transaction
 */
export async function creditUserWallet(userId, currency, amount, transactionRef, metadata = {}) {
    console.log(`[SVC:Wallet] 💰 Crediting ${amount} ${currency} to User ${userId} (Ref: ${transactionRef})`);

    // 1. Find the transaction first for idempotency
    let transaction = await Transaction.findOne({ reference: transactionRef });

    if (transaction && (transaction.status === 'completed' || transaction.status === 'credited')) {
        console.log(`[SVC:Wallet] ⚠️ Transaction ${transactionRef} is already completed. Skipping credit.`);
        return { wallet: await Wallet.findOne({ user: userId, $or: [{ network: currency }, { currency: currency }] }), transaction };
    }

    // 2. Atomic balance increment (with upsert for missing fiat wallets)
    const wallet = await Wallet.findOneAndUpdate(
        { user: userId, $or: [{ network: currency }, { currency: currency }] },
        {
            $inc: { balance: Number(amount) },
            $setOnInsert: {
                user: userId,
                network: currency,
                currency: currency,
                address: 'FIAT_ACCOUNT', // Default for new custodial/fiat wallets created on the fly
                encryptedPrivateKey: 'N/A',
                privateKeyIv: 'N/A',
                privateKeyAuthTag: 'N/A',
            }
        },
        { new: true, upsert: true } // Upsert ensures we create a NGN wallet if it didn't exist
    );

    console.log(`[SVC:Wallet] ✅ Balance updated securely to: ${wallet.balance}`);

    // 3. Update Transaction Record
    transaction = await Transaction.findOneAndUpdate(
        { reference: transactionRef },
        {
            $set: {
                status: 'completed',
                user: userId,
                amount: Number(amount),
                currency: currency,
                metadata: metadata
            },
            $setOnInsert: {
                type: 'deposit',
                description: `Credit of ${amount} ${currency}`,
            }
        },
        { new: true, upsert: true }
    );

    console.log(`[SVC:Wallet] ✅ Transaction ${transactionRef} marked as completed`);

    return { wallet, transaction };
}

/**
 * Debits a user's wallet securely using atomic operations, preventing negative balances.
 * @param {string} userId - ID of the user
 * @param {string} currency - Wallet currency
 * @param {number} amount - Amount to debit
 * @param {string} transactionRef - Unique reference
 * @param {Object} metadata - Extra metadata
 * @returns {Promise<Object>}
 */
export async function debitUserWallet(userId, currency, amount, transactionRef, metadata = {}) {
    console.log(`[SVC:Wallet] 💸 Debiting ${amount} ${currency} from User ${userId} (Ref: ${transactionRef})`);

    // 1. Idempotency check
    const existing = await Transaction.findOne({ reference: transactionRef });
    if (existing && existing.status === 'completed') {
        console.log(`[SVC:Wallet] ⚠️ Transcation ${transactionRef} already debited.`);
        return { wallet: await Wallet.findOne({ user: userId, $or: [{ network: currency }, { currency: currency }] }), transaction: existing };
    }

    // 2. Atomic balance check + deduct in ONE operation
    // Only deducts if balance is sufficient — prevents negative balances
    const wallet = await Wallet.findOneAndUpdate(
        {
            user: userId,
            $or: [{ network: currency }, { currency: currency }],
            balance: { $gte: Number(amount) }
        },
        { $inc: { balance: -Number(amount) } },
        { new: true }
    );

    if (!wallet) {
        throw new Error(`Insufficient ${currency} balance for user ${userId}`);
    }

    // 3. Record transaction
    const transaction = await Transaction.findOneAndUpdate(
        { reference: transactionRef },
        {
            $set: {
                status: 'pending', // Can be updated to completed later if it's external withdrawal
                user: userId,
                amount: Number(amount),
                type: 'withdrawal',
                currency: currency,
                metadata: metadata
            }
        },
        { upsert: true, new: true }
    );

    console.log(`[SVC:Wallet] ✅ Wallet debited successfully. New balance: ${wallet.balance}`);

    return { wallet, transaction };
}
