import mongoose from 'mongoose';
import Wallet from '../models/walletModel.js';
import Transaction from '../models/transactionModel.js';
import User from '../models/userModel.js';

export async function creditUserWallet(
    userId, currency, networkOrAmount, amountOrRef, referenceOrMeta, metaOrProvider = {}, sessionOrNull = null
) {
    let network, amount, reference, meta, session, provider;
    if (typeof networkOrAmount === 'number') {
        network = currency === 'NGN' ? 'INTERNAL' : currency;
        amount = networkOrAmount;
        reference = amountOrRef;
        meta = referenceOrMeta || {};
        provider = typeof metaOrProvider === 'string' ? metaOrProvider : 'internal';
        session = sessionOrNull;
    } else {
        network = networkOrAmount;
        amount = amountOrRef;
        reference = referenceOrMeta;
        meta = metaOrProvider || {};
        provider = meta.provider || 'internal';
        session = sessionOrNull;
    }

    // Normalization
    currency = currency?.toUpperCase();
    network = network?.toUpperCase();

    console.log('[WALLET-SERVICE] CREDIT');
    console.log('[WALLET-SERVICE] User:', userId);
    console.log('[WALLET-SERVICE] Currency:', currency, 'Network:', network);
    console.log('[WALLET-SERVICE] Amount:', amount);
    console.log('[WALLET-SERVICE] Reference:', reference);
    console.log('[WALLET-SERVICE] Session active:', !!session);

    if (!userId || !currency || !amount || !reference) {
        console.error('[WALLET-SERVICE] ❌ Missing params');
        throw new Error('Missing required params');
    }

    if (amount <= 0) {
        console.error('[WALLET-SERVICE] ❌ Invalid amount:', amount);
        throw new Error('Amount must be positive');
    }

    const options = { new: true, upsert: true };
    if (session) options.session = session;

    const wallet = await Wallet.findOneAndUpdate(
        { user: userId, currency, network },
        { $inc: { balance: amount } },
        options
    );

    console.log('[WALLET-SERVICE] ✅ Wallet credited:', amount, currency);
    console.log('[WALLET-SERVICE] New balance:', wallet.balance);

    const txnOptions = { upsert: true, new: true };
    if (session) txnOptions.session = session;

    const txn = await Transaction.findOneAndUpdate(
        { reference },
        {
            $set: {
                userId,
                status: 'completed',
                amount,
                currency,
                provider,
                metadata: { ...meta, balanceAfter: wallet.balance }
            },
            $setOnInsert: {
                type: currency === 'NGN' ? 'ngn_deposit' : 'crypto_deposit',
            }
        },
        txnOptions
    );

    console.log('[WALLET-SERVICE] ✅ Transaction logged:', txn._id);
    return { wallet, transaction: txn };
}

export async function debitUserWallet(
    userId, currency, networkOrAmount, amountOrRef, referenceOrMeta, metaOrProvider = {}, sessionOrNull = null
) {
    let network, amount, reference, meta, session, provider;
    if (typeof networkOrAmount === 'number') {
        network = currency === 'NGN' ? 'INTERNAL' : currency;
        amount = networkOrAmount;
        reference = amountOrRef;
        meta = referenceOrMeta || {};
        provider = typeof metaOrProvider === 'string' ? metaOrProvider : 'internal';
        session = sessionOrNull;
    } else {
        network = networkOrAmount;
        amount = amountOrRef;
        reference = referenceOrMeta;
        meta = metaOrProvider || {};
        provider = meta.provider || 'internal';
        session = sessionOrNull;
    }

    // Normalization
    currency = currency?.toUpperCase();
    network = network?.toUpperCase();

    console.log('[WALLET-SERVICE] DEBIT');
    console.log('[WALLET-SERVICE] User:', userId);
    console.log('[WALLET-SERVICE] Currency:', currency, 'Network:', network);
    console.log('[WALLET-SERVICE] Amount:', amount);
    console.log('[WALLET-SERVICE] Reference:', reference);
    console.log('[WALLET-SERVICE] Session active:', !!session);

    if (amount <= 0) {
        console.error('[WALLET-SERVICE] ❌ Invalid amount:', amount);
        throw new Error('Amount must be positive');
    }

    const findOptions = session ? { session } : {};

    // Check balance within session
    const current = await Wallet.findOne(
        { user: userId, currency, network },
        null,
        findOptions
    );

    console.log('[WALLET-SERVICE] Current balance:', current?.balance);

    if (!current || current.balance < amount) {
        console.error('[WALLET-SERVICE] ❌ Insufficient balance');
        console.error('[WALLET-SERVICE] Has:', current?.balance, 'Needs:', amount);
        throw new Error(`Insufficient ${currency} balance`);
    }

    const updateOptions = { new: true };
    if (session) updateOptions.session = session;

    // Atomic debit with $gte guard
    const wallet = await Wallet.findOneAndUpdate(
        { user: userId, currency, network, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        updateOptions
    );

    if (!wallet) {
        console.error('[WALLET-SERVICE] ❌ Atomic debit failed - race condition');
        throw new Error('Debit failed - race condition');
    }

    console.log('[WALLET-SERVICE] ✅ Wallet debited:', amount, currency);
    console.log('[WALLET-SERVICE] New balance:', wallet.balance);

    const txnOptions = { upsert: true, new: true };
    if (session) txnOptions.session = session;

    const txn = await Transaction.findOneAndUpdate(
        { reference },
        {
            $set: {
                userId,
                status: 'processing', // pending/processing
                amount,
                currency,
                provider,
                metadata: { ...meta, balanceAfter: wallet.balance }
            },
            $setOnInsert: {
                type: currency === 'NGN' ? 'ngn_withdrawal' : 'crypto_withdrawal',
            }
        },
        txnOptions
    );

    console.log('[WALLET-SERVICE] ✅ Transaction logged');
    return { wallet, transaction: txn };
}
