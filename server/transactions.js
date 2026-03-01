import express from 'express';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import { getLiveRates } from './utils/priceService.js';
import mongoose from 'mongoose';
import User from './models/userModel.js';
import { protect } from './middleware/authMiddleware.js';
import Wallet from './models/walletModel.js';
import Transaction from './models/transactionModel.js';
import { creditUserWallet, debitUserWallet } from './services/walletService.js';
import { validateCryptoAddress } from './utils/addressValidator.js';
import { transferLimiter } from './middleware/rateLimiter.js';
import { idempotency } from './middleware/idempotency.js';
import { broadcastFromHotWallet } from './services/broadcastService.js';

const PLATFORM_FEE_WALLET_ID = process.env.PLATFORM_FEE_WALLET_ID;
const router = express.Router();
const ECPair = ECPairFactory(ecc);
bitcoin.initEccLib(ecc);

// Constants
const BTC_API = "https://blockstream.info/api";
const TRON_API = "https://api.trongrid.io";
const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

// ─── INTERNAL TRANSFERS ──────────────────────────────────────────

router.post('/transfer/internal', protect, transferLimiter, idempotency, async (req, res) => {
  const { recipient_username, amount, currency } = req.body;
  const senderId = req.user._id;

  if (!recipient_username || !amount || !currency) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  const transferRef = `INT-${Date.now()}`;
  console.log(`\n[TX:InternalTransfer] 🔄 Ref: ${transferRef} | From: @${req.user.username} | To: @${recipient_username} | Amount: ${amount} ${currency}`);

  try {
    const cleanUsername = recipient_username.replace('@', '').toLowerCase();
    const recipient = await User.findOne({ username: new RegExp(`^${cleanUsername}$`, 'i') });

    if (!recipient) {
      console.warn(`[TX:InternalTransfer] ❌ Recipient @${cleanUsername} not found.`);
      return res.status(404).json({ success: false, error: "Recipient not found" });
    }

    if (recipient._id.toString() === senderId.toString()) {
      return res.status(400).json({ success: false, error: "You cannot send money to yourself" });
    }

    const transferAmount = Number(amount);
    const TRANSFER_FEE_PERCENTAGE = 0.001;
    const TRANSFER_FEE_CAP = 1;
    const transferFee = Math.min(transferAmount * TRANSFER_FEE_PERCENTAGE, TRANSFER_FEE_CAP);
    const totalDeduction = transferAmount + transferFee;

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // 1. Debit Sender
        await debitUserWallet(
          senderId, currency, totalDeduction, transferRef,
          { recipientId: recipient._id, recipientUsername: recipient.username, fee: transferFee },
          'internal', session
        );

        // 2. Credit Recipient
        await creditUserWallet(
          recipient._id, currency, transferAmount, `IN-${transferRef}`,
          { senderId: senderId, senderUsername: req.user.username },
          'internal', session
        );

        // 3. Fee Routing
        if (PLATFORM_FEE_WALLET_ID && transferFee > 0) {
          await creditUserWallet(
            PLATFORM_FEE_WALLET_ID, currency, transferFee, `FEE_${transferRef}`,
            { type: 'transfer_fee', originalRef: transferRef }, 'internal', session
          );
        }
      });

      // Fetch final sender balance outside transaction for response
      const updatedSenderWallet = await Wallet.findOne({ user: senderId, currency: currency });
      res.json({ success: true, message: 'Transfer successful', balance: updatedSenderWallet?.balance });
    } catch (error) {
      console.error(`[TX:InternalTransfer] 💥 FATAL (ROLLED BACK): ${error.message}`);
      res.status(400).json({ success: false, error: error.message });
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error(`[TX:InternalTransfer] 💥 FATAL (OUTER CATCH): ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── DEPOSITS ──────────────────────────────────────────────────

router.post('/deposit', protect, async (req, res) => {
  const { amount, currency, reference } = req.body;
  if (!amount || !currency) return res.status(400).json({ success: false, error: 'Missing fields' });

  const depositRef = reference || `DEP-${Date.now()}`;
  try {
    const { wallet, transaction } = await creditUserWallet(
      req.user._id, currency, Number(amount), depositRef,
      { type: 'manual_deposit' }, 'manual'
    );
    res.json({ success: true, balance: wallet.balance, transaction });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/deposit-pending', protect, async (req, res) => {
  const { amount, currency, reference } = req.body;
  try {
    const transaction = await Transaction.create({
      user: req.user._id, type: 'deposit', status: 'pending',
      amount: Number(amount), currency, reference,
      description: `Pending ${currency} deposit`
    });
    res.json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── WITHDRAWALS ───────────────────────────────────────────────

router.post('/withdraw-crypto', protect, transferLimiter, idempotency, async (req, res) => {
  const { amount, toAddress, currency, network } = req.body;
  const addressCheck = validateCryptoAddress(toAddress, network);
  if (!addressCheck.valid) return res.status(400).json({ success: false, error: addressCheck.error });

  const transactionRef = `CW-${Date.now()}`;
  const FEES = { 'USDT_TRC20': 2, 'TRX': 2, 'ETH': 0.005, 'USDT_ERC20': 12, 'BTC': 0.0002, 'SOL': 0.02 };
  const GAS = { 'USDT_TRC20': 0.3, 'TRX': 0.5, 'ETH': 0.001, 'USDT_ERC20': 3, 'BTC': 0.0001, 'SOL': 0.00005 };

  if (!FEES[network]) return res.status(400).json({ success: false, error: 'Unsupported network' });

  try {
    const totalDeduction = Number(amount) + FEES[network];
    const { wallet, transaction: txnRecord } = await debitUserWallet(
      req.user._id, network, totalDeduction, transactionRef,
      { toAddress, network, fee: FEES[network] }, 'crypto'
    );

    // Step 2: Broadcast from HOT WALLET
    console.log('[CRYPTO-WDR] Calling real broadcaster...');
    console.log('[CRYPTO-WDR] Network:', network);
    console.log('[CRYPTO-WDR] To:', toAddress);
    console.log('[CRYPTO-WDR] Amount:', amount);
    console.log('[CRYPTO-WDR] Currency:', currency);

    let txHash;
    try {
      txHash = await broadcastFromHotWallet(network, toAddress, amount, currency);
      console.log('[CRYPTO-WDR] ✅ Real TX hash:', txHash);
    } catch (broadcastErr) {
      console.error('[CRYPTO-WDR] ❌ Broadcast failed:', broadcastErr.message);
      console.error('[CRYPTO-WDR] ⚠️ Marking as processing - DO NOT refund yet');

      await Transaction.findByIdAndUpdate(
        txnRecord._id,
        { status: 'processing', metadata: { ...txnRecord.metadata, broadcastError: broadcastErr.message } }
      );

      return res.status(202).json({ processing: true, reference: transactionRef, message: 'Withdrawal processing' });
    }

    // Step 3: Update transaction with real hash
    await Transaction.findByIdAndUpdate(
      txnRecord._id,
      {
        status: 'completed',
        metadata: { ...txnRecord.metadata, txHash, toAddress, network, currency }
      }
    );

    console.log('[CRYPTO-WDR] ✅ Withdrawal complete with real TX:', txHash);
    res.json({ success: true, txHash, balance: wallet.balance });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/withdraw', protect, async (req, res) => {
  const { amount, accountNumber, bankCode, beneficiaryName } = req.body;
  const withdrawalRef = `W-${Date.now()}`;

  try {
    const { wallet, transaction: txnRecord } = await debitUserWallet(
      req.user._id, 'NGN', Number(amount), withdrawalRef,
      { bankCode, accountNumber, beneficiaryName }, 'fiat'
    );

    const protocol = req.protocol;
    const host = req.get('host');
    const transferUrl = `${protocol}://${host}/api/interswitch/transfer`;

    const response = await fetch(transferUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': req.headers.authorization },
      body: JSON.stringify({ amount, accountNumber, bankCode, beneficiaryName, transactionRef: withdrawalRef })
    });

    const data = await response.json();
    if (data.success) {
      await Transaction.findByIdAndUpdate(txnRecord._id, { status: 'completed' });
      res.json({ success: true, balance: wallet.balance });
    } else {
      await creditUserWallet(req.user._id, 'NGN', Number(amount), `REFUND_${withdrawalRef}`, { reason: data.error }, 'fiat');
      await Transaction.findByIdAndUpdate(txnRecord._id, { status: 'failed', description: data.error });
      res.status(400).json({ success: false, error: data.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── SWAP & RATES ─────────────────────────────────────────────

router.get('/rates', async (req, res) => {
  try {
    const liveRates = await getLiveRates();
    const SPREAD = 0.025;
    const rates = {};

    // Process all rates from priceService with spread
    Object.keys(liveRates).forEach(pair => {
      if (pair.endsWith('_NGN')) {
        const base = pair.replace('_NGN', '');
        rates[`${base}_NGN`] = liveRates[pair] * (1 - SPREAD); // User sells crypto to us
        rates[`NGN_${base}`] = 1 / (liveRates[pair] * (1 + SPREAD)); // User buys crypto from us
      }
    });

    res.json({ success: true, rates, marketRate: liveRates.USDT_NGN, spread: SPREAD });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/swap', protect, async (req, res) => {
  const { fromCurrency, toCurrency, amount } = req.body;
  const swapRef = `SWAP-${Date.now()}`;

  try {
    const liveRates = await getLiveRates();
    const SPREAD = 0.025;

    // Normalize currencies (e.g. USDT_TRC20 -> USDT)
    const normalize = (c) => c.split('_')[0];
    const fromBase = normalize(fromCurrency);
    const toBase = normalize(toCurrency);

    const fromValNgn = fromCurrency === 'NGN' ? 1 : liveRates[`${fromCurrency}_NGN`] || liveRates[`${fromBase}_NGN`] || 0;
    const toValNgn = toCurrency === 'NGN' ? 1 : liveRates[`${toCurrency}_NGN`] || liveRates[`${toBase}_NGN`] || 0;

    if (!fromValNgn || !toValNgn) throw new Error(`Rates unavailable for ${fromCurrency}/${toCurrency}`);

    const rate = (fromValNgn / toValNgn) * (1 - SPREAD);
    const receiveAmount = Number(amount) * rate;
    const profit = (Number(amount) * fromValNgn) * SPREAD;

    const treasuryUser = await User.findOne({ email: 'platform@stablex.internal' });
    if (!treasuryUser) throw new Error('Treasury error');

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // Step 1: Debit user fromCurrency
        await debitUserWallet(
          req.user._id, fromCurrency, Number(amount), `${swapRef}-1`, { toCurrency, rate }, 'internal', session
        );

        // Step 2: Credit treasury fromCurrency
        await creditUserWallet(
          treasuryUser._id, fromCurrency, Number(amount), `TREAS_IN_${swapRef}-2`, { fromUser: req.user._id }, 'internal', session
        );

        // Step 3: Debit treasury toCurrency
        await debitUserWallet(
          treasuryUser._id, toCurrency, receiveAmount, `TREAS_OUT_${swapRef}-3`, { toUser: req.user._id }, 'internal', session
        );

        // Step 4: Credit user toCurrency
        await creditUserWallet(
          req.user._id, toCurrency, receiveAmount, `IN_${swapRef}-4`, { fromCurrency, rate, profit }, 'internal', session
        );

        // Step 5: Credit fee wallet (NGN profit)
        if (PLATFORM_FEE_WALLET_ID && profit > 0) {
          await creditUserWallet(
            PLATFORM_FEE_WALLET_ID, 'NGN', profit, `PROFIT_${swapRef}-5`, { type: 'swap_profit' }, 'internal', session
          );
        }
      });

      // Get final balance outside transaction for response
      const finalWallet = await Wallet.findOne({ user: req.user._id, currency: toCurrency });
      res.json({ success: true, balance: finalWallet?.balance, receiveAmount, transactionRef: swapRef });
    } catch (err) {
      console.error('[SWAP] ❌ SWAP FAILED - ALL STEPS ROLLED BACK:', err.message);
      res.status(500).json({ success: false, error: err.message });
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error(`[SWAP] 💥 FATAL (OUTER CATCH): ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── UTILS ────────────────────────────────────────────────────

router.get('/history', protect, async (req, res) => {
  try {
    const { type, status, limit = 50 } = req.query;
    const filter = { user: req.user._id };
    if (type) filter.type = type;
    if (status) filter.status = status;
    const transactions = await Transaction.find(filter).sort({ createdAt: -1 }).limit(Number(limit)).lean();
    res.json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
