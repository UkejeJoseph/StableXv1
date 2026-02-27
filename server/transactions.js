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
import { creditUserWallet } from './services/walletService.js';

const PLATFORM_FEE_WALLET_ID = process.env.PLATFORM_FEE_WALLET_ID;
import { transferLimiter } from './middleware/rateLimiter.js';
import { idempotency } from './middleware/idempotency.js';

const router = express.Router();
const ECPair = ECPairFactory(ecc);
bitcoin.initEccLib(ecc);

const BTC_API = "https://blockstream.info/api";
const TRON_API = "https://api.trongrid.io";
const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

// @desc    Internal transfer by username (0.1% fee, capped at 1 USDT equivalent)
// @route   POST /api/transactions/transfer/internal
router.post('/transfer/internal', protect, transferLimiter, idempotency, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { recipient_username, amount, currency } = req.body;
    const senderId = req.user._id;

    console.log(`[TX_TRACE] Internal Transfer Initialized: From @${req.user.username} to @${recipient_username} | Amount: ${amount} ${currency}`);

    if (!recipient_username || !amount || !currency) {
      throw new Error("Missing required fields");
    }

    const cleanUsername = recipient_username.replace('@', '').toLowerCase();

    // Find recipient
    const recipient = await User.findOne({
      username: new RegExp(`^${cleanUsername}$`, 'i')
    }).session(session);

    if (!recipient) {
      throw new Error("Recipient not found");
    }

    if (recipient._id.toString() === senderId.toString()) {
      throw new Error("You cannot send money to yourself");
    }

    const transferAmount = Number(amount);
    if (transferAmount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    // Calculate transfer fee: 0.1% capped at 1 unit
    const TRANSFER_FEE_PERCENTAGE = 0.001;
    const TRANSFER_FEE_CAP = 1;
    const transferFee = Math.min(transferAmount * TRANSFER_FEE_PERCENTAGE, TRANSFER_FEE_CAP);
    const totalDeduction = transferAmount + transferFee;

    // Find Sender Wallet
    const senderWallet = await Wallet.findOne({ user: senderId, currency: currency }).session(session);
    if (!senderWallet || senderWallet.balance < totalDeduction) {
      throw new Error(`Insufficient ${currency} balance (need ${totalDeduction} including ${transferFee} fee)`);
    }

    // Find Recipient Wallet
    const recipientWallet = await Wallet.findOne({ user: recipient._id, currency: currency }).session(session);
    if (!recipientWallet) {
      throw new Error(`Recipient does not have a ${currency} wallet setup`);
    }

    // Deduct amount + fee Atomically
    const updatedSender = await Wallet.findOneAndUpdate(
      { _id: senderWallet._id, balance: { $gte: totalDeduction } },
      { $inc: { balance: -totalDeduction } },
      { new: true, session }
    );
    if (!updatedSender) throw new Error(`Insufficient ${currency} balance or concurrent transaction`);

    // Credit full amount to recipient (fee excluded)
    await Wallet.findOneAndUpdate(
      { _id: recipientWallet._id },
      { $inc: { balance: transferAmount } },
      { new: true, session }
    );

    const txRef = `INT-${Date.now()}`;

    // Record Transaction for Sender
    await Transaction.create([{
      user: senderId,
      type: 'transfer',
      status: 'completed',
      amount: transferAmount,
      profit: transferFee,
      currency: currency,
      reference: `${txRef}-OUT`,
      description: `Internal Transfer to @${recipient.username} (Fee: ${transferFee} ${currency})`,
      metadata: { recipientId: recipient._id.toString(), recipientUsername: recipient.username, fee: String(transferFee) }
    }], { session });

    // Record Transaction for Recipient
    await Transaction.create([{
      user: recipient._id,
      type: 'deposit',
      status: 'completed',
      amount: transferAmount,
      currency: currency,
      reference: `${txRef}-IN`,
      description: `Received from @${req.user.username || 'user'}`,
      metadata: { senderId: senderId.toString(), senderUsername: req.user.username }
    }], { session });

    await session.commitTransaction();
    session.endSession();

    // Route transfer fee to platform wallet (outside session)
    if (PLATFORM_FEE_WALLET_ID && transferFee > 0) {
      try {
        await creditUserWallet(PLATFORM_FEE_WALLET_ID, currency, transferFee, `transfer_fee_${txRef}`, { type: 'transfer_fee' });
        console.log(`[FEE_ROUTING] ✅ Transfer fee (${transferFee} ${currency}) credited to platform wallet`);
      } catch (feeErr) {
        console.error(`[FEE_ROUTING] ❌ CRITICAL: Transfer fee credit failed for ${txRef}:`, feeErr.message);
      }
    }

    res.json({ success: true, message: 'Transfer completed successfully' });
    console.log(`[TX_TRACE] Internal Transfer Success: ${txRef} | Sender: ${senderId} | Recipient: ${recipient._id}`);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ success: false, error: error.message });
  }
});

// @desc    Generate a payment link
// @route   POST /api/transactions/payment-link/create
router.post('/payment-link/create', protect, async (req, res) => {
  const { currency, amount } = req.body;
  const user = req.user;

  if (!user.username) {
    return res.status(400).json({ success: false, error: 'You need to set up a username first' });
  }

  const baseUrl = process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:5000/web';
  let link = `${baseUrl}/pay/@${user.username}`;

  const params = new URLSearchParams();
  if (currency) params.append('currency', currency);
  if (amount) params.append('amount', amount);

  const queryString = params.toString();
  if (queryString) {
    link += `?${queryString}`;
  }

  res.json({ success: true, link });
});

router.post('/btc', async (req, res) => {
  try {
    const { fromAddress, toAddress, amount, privateKey } = req.body;

    if (!fromAddress || !toAddress || !amount || !privateKey) {
      return res.json({ success: false, error: "Missing required fields" });
    }

    const cleanKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
    const keyPair = ECPair.fromPrivateKey(Buffer.from(cleanKey, "hex"));

    const utxosResponse = await fetch(`${BTC_API}/address/${fromAddress}/utxo`);
    const utxos = await utxosResponse.json();

    if (!utxos || utxos.length === 0) {
      return res.json({ success: false, error: "No UTXOs available. Make sure the wallet has BTC." });
    }

    const satoshisToSend = Math.floor(parseFloat(amount) * 100000000);
    const feePerByte = 10;
    const estimatedSize = 180 + (utxos.length * 148);
    const fee = feePerByte * estimatedSize;

    let totalInput = 0;
    const selectedUtxos = [];

    for (const utxo of utxos) {
      selectedUtxos.push(utxo);
      totalInput += utxo.value;
      if (totalInput >= satoshisToSend + fee) break;
    }

    if (totalInput < satoshisToSend + fee) {
      return res.json({
        success: false,
        error: `Insufficient balance. Need ${(satoshisToSend + fee) / 100000000} BTC, have ${totalInput / 100000000} BTC`
      });
    }

    const psbt = new bitcoin.Psbt({ network: bitcoin.networks.bitcoin });

    for (const utxo of selectedUtxos) {
      const txHexResponse = await fetch(`${BTC_API}/tx/${utxo.txid}/hex`);
      const txHex = await txHexResponse.text();

      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        nonWitnessUtxo: Buffer.from(txHex, "hex"),
      });
    }

    psbt.addOutput({
      address: toAddress,
      value: BigInt(satoshisToSend),
    });

    const change = totalInput - satoshisToSend - fee;
    if (change > 546) {
      psbt.addOutput({
        address: fromAddress,
        value: BigInt(change),
      });
    }

    for (let i = 0; i < selectedUtxos.length; i++) {
      psbt.signInput(i, keyPair);
    }

    psbt.finalizeAllInputs();
    const txHex = psbt.extractTransaction().toHex();

    const broadcastResponse = await fetch(`${BTC_API}/tx`, {
      method: "POST",
      body: txHex,
    });

    if (!broadcastResponse.ok) {
      const errorText = await broadcastResponse.text();
      return res.json({ success: false, error: `Broadcast failed: ${errorText}` });
    }

    const txHash = await broadcastResponse.text();

    res.json({ success: true, txHash });
  } catch (error) {
    console.error("BTC transaction error:", error);
    res.json({ success: false, error: error.message || "BTC transaction failed" });
  }
});

router.post('/trc20', async (req, res) => {
  try {
    const { toAddress, amount, privateKey } = req.body;

    if (!toAddress || !amount || !privateKey) {
      return res.json({ success: false, error: "Missing required fields" });
    }

    const cleanKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;

    const amountInSun = Math.floor(parseFloat(amount) * 1000000);

    const ownerAddress = getAddressFromPrivateKey(cleanKey);

    const triggerResponse = await fetch(`${TRON_API}/wallet/triggersmartcontract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner_address: ownerAddress,
        contract_address: USDT_TRC20_CONTRACT,
        function_selector: "transfer(address,uint256)",
        parameter: encodeParameters([
          { type: "address", value: toAddress },
          { type: "uint256", value: amountInSun },
        ]),
        fee_limit: 100000000,
        call_value: 0,
      }),
    });

    const triggerResult = await triggerResponse.json();

    if (!triggerResult.result?.result) {
      return res.json({
        success: false,
        error: triggerResult.result?.message || "Failed to create TRC20 transaction"
      });
    }

    const transaction = triggerResult.transaction;
    const signedTx = signTronTransaction(transaction, cleanKey);

    const broadcastResponse = await fetch(`${TRON_API}/wallet/broadcasttransaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signedTx),
    });

    const broadcastResult = await broadcastResponse.json();

    if (!broadcastResult.result) {
      return res.json({ success: false, error: broadcastResult.message || "Broadcast failed" });
    }

    res.json({ success: true, txHash: transaction.txID });
  } catch (error) {
    console.error("TRC20 transaction error:", error);
    res.json({ success: false, error: error.message || "TRC20 transaction failed" });
  }
});

function getAddressFromPrivateKey(privateKey) {
  const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKey, "hex"));
  const pubKey = keyPair.publicKey;
  const { createHash } = require('crypto');
  const hash = createHash('sha3-256').update(pubKey.slice(1)).digest('hex');
  const addressBytes = hash.slice(-40);
  return "41" + addressBytes;
}

function encodeParameters(params) {
  let encoded = "";
  for (const param of params) {
    if (param.type === "address") {
      const addr = param.value.startsWith("T") ? tronAddressToHex(param.value) : param.value;
      encoded += addr.slice(2).padStart(64, "0");
    } else if (param.type === "uint256") {
      encoded += BigInt(param.value).toString(16).padStart(64, "0");
    }
  }
  return encoded;
}

function tronAddressToHex(address) {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = BigInt(0);
  for (const char of address) {
    num = num * BigInt(58) + BigInt(ALPHABET.indexOf(char));
  }
  return num.toString(16).slice(0, 42);
}

function signTronTransaction(transaction, privateKey) {
  const txHash = transaction.raw_data_hex;
  const { createHash } = require('crypto');
  const msgHash = createHash('sha256').update(Buffer.from(txHash, 'hex')).digest();
  const privKeyBytes = Buffer.from(privateKey, "hex");

  const signature = ecc.sign(msgHash, privKeyBytes);

  const r = Buffer.from(signature.slice(0, 32)).toString("hex").padStart(64, "0");
  const s = Buffer.from(signature.slice(32, 64)).toString("hex").padStart(64, "0");
  const v = "1b";

  return {
    ...transaction,
    signature: [r + s + v],
  };
}

// Transaction History Endpoint (with type/status filtering)
router.get('/history', protect, async (req, res) => {
  try {
    const { type, status, limit = 50 } = req.query;
    const filter = { user: req.user._id };

    if (type) filter.type = type;
    if (status) filter.status = status;

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    res.json({
      success: true,
      transactions,
    });
  } catch (error) {
    console.error("[TX History] Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manual Deposit Endpoint (For Demo / Bank Transfers)
router.post('/deposit', protect, async (req, res) => {
  const { amount, currency, reference } = req.body;

  if (!amount || !currency || !reference) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    // 1. Find the user's wallet for this currency
    // Note: For NGN, we might look for 'NGN'. For Crypto, 'USDT_TRC20' etc.
    // We need a mapping or strict currency match.
    // User wallets stored as: currency: "NGN", "BTC", etc.

    let wallet = await Wallet.findOne({ user: req.user._id, currency: currency });

    // If wallet doesn't exist (e.g. first NGN deposit), create it?
    // Usually wallets are created on signup, but maybe not NGN if it wasn't default.
    if (!wallet) {
      // Check if it's a valid currency we support
      // For now, allow creating it.
      wallet = await Wallet.create({
        user: req.user._id,
        currency: currency,
        balance: 0,
        address: "FIAT_ACCOUNT", // Placeholder for fiat
        encryptedPrivateKey: "N/A",
        iv: "N/A",
        authTag: "N/A"
      });
    }

    // 2. Create Transaction Record
    const transaction = await Transaction.create({
      user: req.user._id,
      type: 'deposit',
      status: currency === 'NGN' ? 'pending' : 'completed', // NGN is pending until verified/admin confirmed
      amount: Number(amount),
      currency: currency,
      reference: reference,
      description: `Manual deposit of ${amount} ${currency}`
    });

    // 3. Update Wallet Balance Atomically (ONLY for non-NGN or non-pending)
    let updatedWallet;
    if (transaction.status === 'completed') {
      updatedWallet = await Wallet.findOneAndUpdate(
        { _id: wallet._id },
        { $inc: { balance: Number(amount) } },
        { new: true }
      );
    } else {
      updatedWallet = wallet;
    }

    res.json({
      success: true,
      message: 'Deposit successful',
      balance: updatedWallet.balance,
      transaction
    });

  } catch (error) {
    console.error("Deposit error:", error);
    res.status(500).json({ message: 'Deposit failed', error: error.message });
  }
});

// Pending Crypto Deposit Endpoint (Balance NOT credited)
// The blockchain listener will detect the on-chain transfer and credit the wallet
router.post('/deposit-pending', protect, async (req, res) => {
  const { amount, currency, reference } = req.body;

  if (!amount || !currency || !reference) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    // Check for duplicate reference
    const existingTx = await Transaction.findOne({ reference });
    if (existingTx) {
      return res.status(400).json({ message: 'Transaction reference already exists' });
    }

    // Create PENDING transaction — blockchain listener will update to completed
    const transaction = await Transaction.create({
      user: req.user._id,
      type: 'deposit',
      status: 'pending',
      amount: Number(amount),
      currency: currency,
      reference: reference,
      description: `Pending ${currency} deposit — awaiting blockchain confirmation`
    });

    console.log(`📝 Pending crypto deposit created: ${amount} ${currency} for User ${req.user._id} (ref: ${reference})`);

    res.json({
      success: true,
      message: 'Deposit recorded. Your balance will be updated once the blockchain confirms the transfer.',
      transaction,
    });

  } catch (error) {
    console.error("Pending deposit error:", error);
    res.status(500).json({ message: 'Failed to record deposit', error: error.message });
  }
});

// Crypto Withdrawal Endpoint (Automated Hot Wallet Transfer)
router.post('/withdraw-crypto', protect, transferLimiter, idempotency, async (req, res) => {
  const { amount, toAddress, currency, network } = req.body;

  if (!amount || !toAddress || !currency || !network) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  console.log(`[TX_TRACE] Crypto Withdrawal Requested: User ${req.user._id} | ${amount} ${currency} on ${network} to ${toAddress}`);

  // Supported networks and their fee structure (gas + platform margin)
  const FEES = {
    'USDT_TRC20': 2,      // Gas: ~0.3 USDT  | Profit: ~1.7 USDT
    'TRX': 2,             // Gas: ~0.5 TRX   | Profit: ~1.5 TRX
    'ETH': 0.005,         // Gas: ~0.001 ETH | Profit: ~0.004 ETH
    'USDT_ERC20': 12,     // Gas: ~3 USDT    | Profit: ~9 USDT
    'BTC': 0.0002,        // Gas: ~0.0001 BTC| Profit: ~0.0001 BTC
    'SOL': 0.02,          // Gas: ~0.00005   | Profit: ~0.02 SOL
  };

  // Actual network gas costs (for profit tracking)
  const GAS_COSTS = {
    'USDT_TRC20': 0.3,
    'TRX': 0.5,
    'ETH': 0.001,
    'USDT_ERC20': 3,
    'BTC': 0.0001,
    'SOL': 0.00005,
  };

  if (!FEES.hasOwnProperty(network)) {
    return res.status(400).json({
      success: false,
      error: `Withdrawals not yet supported for ${network}. Supported: ${Object.keys(FEES).join(', ')}`
    });
  }

  const session = await Transaction.startSession();
  session.startTransaction();

  try {
    const user = req.user;
    const withdrawAmount = Number(amount);
    const fee = FEES[network];
    const totalDeduction = withdrawAmount + fee;

    // 1. Find User's Crypto Wallet
    const wallet = await Wallet.findOne({ user: user._id, currency: network }).session(session);

    if (!wallet) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, error: `${network} Wallet not found` });
    }

    if (wallet.balance < totalDeduction) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        error: `Insufficient balance. You need ${totalDeduction} ${currency} (amount + ${fee} fee). Available: ${wallet.balance}`
      });
    }

    // 2. Deduct Balance Atomically
    const updatedWallet = await Wallet.findOneAndUpdate(
      { _id: wallet._id, balance: { $gte: totalDeduction } },
      { $inc: { balance: -totalDeduction } },
      { new: true, session }
    );
    if (!updatedWallet) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, error: 'Insufficient balance or concurrent transaction.' });
    }

    // 3. Calculate platform profit from fee
    const gasCost = GAS_COSTS[network] || 0;
    const platformProfit = fee - gasCost;
    const transactionRef = `CW-${Date.now()}`;

    // 4. Create Pending Transaction Record
    const transaction = await Transaction.create([{
      user: user._id,
      type: 'withdrawal',
      status: 'pending',
      amount: withdrawAmount,
      profit: platformProfit,
      currency: currency,
      reference: transactionRef,
      description: `Crypto Withdrawal to ${toAddress.substring(0, 8)}... (Fee: ${fee} ${currency})`,
      metadata: { toAddress, network, fee: String(fee), gasCost: String(gasCost), platformProfit: String(platformProfit) }
    }], { session });

    await session.commitTransaction();
    session.endSession();

    // 5. Route withdrawal fee to platform wallet (outside session for safety)
    if (PLATFORM_FEE_WALLET_ID && fee > 0) {
      try {
        await creditUserWallet(PLATFORM_FEE_WALLET_ID, currency, fee, `fee_${transactionRef}`, { type: 'withdrawal_fee', gasCost, platformProfit });
        console.log(`[FEE_ROUTING] ✅ Withdrawal fee (${fee} ${currency}) credited to platform wallet`);
      } catch (feeErr) {
        console.error(`[FEE_ROUTING] ❌ CRITICAL: Withdrawal fee credit failed for ${transactionRef}:`, feeErr.message);
      }
    }

    // 4. Broadcast from the correct Hot Wallet based on network
    let txHash;

    try {
      if (network === 'USDT_TRC20' || network === 'TRX') {
        // ───── TRC20 / TRX Withdrawal (TRON Hot Wallet) ─────
        const hotWalletAddress = process.env.STABLEX_HOT_WALLET_TRC20;
        const hotWalletKey = process.env.STABLEX_HOT_WALLET_TRC20_PRIVATE_KEY;

        if (!hotWalletAddress || !hotWalletKey) {
          throw new Error("TRON Hot Wallet is not configured.");
        }

        const cleanKey = hotWalletKey.startsWith("0x") ? hotWalletKey.slice(2) : hotWalletKey;

        if (network === 'USDT_TRC20') {
          // USDT TRC20 token transfer
          const amountInSun = Math.floor(withdrawAmount * 1000000);
          const triggerResponse = await fetch(`${TRON_API}/wallet/triggersmartcontract`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              owner_address: tronAddressToHex(hotWalletAddress),
              contract_address: USDT_TRC20_CONTRACT,
              function_selector: "transfer(address,uint256)",
              parameter: encodeParameters([
                { type: "address", value: toAddress },
                { type: "uint256", value: amountInSun },
              ]),
              fee_limit: 100000000,
              call_value: 0,
            }),
          });

          const triggerResult = await triggerResponse.json();
          if (!triggerResult.result?.result) {
            throw new Error(triggerResult.result?.message || "Failed to create TRC20 transaction.");
          }

          const signedTx = signTronTransaction(triggerResult.transaction, cleanKey);
          const broadcastResponse = await fetch(`${TRON_API}/wallet/broadcasttransaction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(signedTx),
          });
          const broadcastResult = await broadcastResponse.json();
          if (!broadcastResult.result) {
            throw new Error(broadcastResult.message || "TRON broadcast rejected.");
          }
          txHash = triggerResult.transaction.txID;

        } else {
          // Native TRX transfer
          const amountInSun = Math.floor(withdrawAmount * 1000000);
          const createTxResponse = await fetch(`${TRON_API}/wallet/createtransaction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              owner_address: tronAddressToHex(hotWalletAddress),
              to_address: tronAddressToHex(toAddress),
              amount: amountInSun,
            }),
          });
          const createTxResult = await createTxResponse.json();
          if (!createTxResult.txID) {
            throw new Error("Failed to create TRX transaction.");
          }

          const signedTx = signTronTransaction(createTxResult, cleanKey);
          const broadcastResponse = await fetch(`${TRON_API}/wallet/broadcasttransaction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(signedTx),
          });
          const broadcastResult = await broadcastResponse.json();
          if (!broadcastResult.result) {
            throw new Error(broadcastResult.message || "TRX broadcast rejected.");
          }
          txHash = createTxResult.txID;
        }

      } else if (network === 'ETH') {
        const hotWalletKey = process.env.STABLEX_HOT_WALLET_ETH_PRIVATE_KEY;
        if (!hotWalletKey) throw new Error("ETH Hot Wallet is not configured.");

        const { ethers } = await import('ethers');
        const ethRpcUrl = process.env.ETH_RPC_URL || 'https://cloudflare-eth.com';
        const provider = new ethers.JsonRpcProvider(ethRpcUrl);
        const signer = new ethers.Wallet(hotWalletKey, provider);

        const tx = await signer.sendTransaction({
          to: toAddress,
          value: ethers.parseEther(String(withdrawAmount)),
        });
        const receipt = await tx.wait();
        txHash = receipt.hash;

      } else if (network === 'BTC') {
        const hotWalletKey = process.env.STABLEX_HOT_WALLET_BTC_PRIVATE_KEY;
        if (!hotWalletKey) throw new Error("BTC Hot Wallet is not configured.");

        const keyPair = ECPair.fromWIF(hotWalletKey, bitcoin.networks.bitcoin);
        const { address: hotWalletAddress } = bitcoin.payments.p2wpkh({
          pubkey: keyPair.publicKey,
          network: bitcoin.networks.bitcoin,
        });

        const utxoResponse = await fetch(`${BTC_API}/address/${hotWalletAddress}/utxo`);
        const utxos = await utxoResponse.json();

        if (!utxos || utxos.length === 0) {
          throw new Error("No UTXOs available in BTC hot wallet.");
        }

        const satoshisToSend = Math.floor(withdrawAmount * 100000000);
        const feeRate = 10;
        const estimatedTxSize = 140;
        const minerFee = feeRate * estimatedTxSize;

        let totalInput = 0;
        const selectedUtxos = [];
        for (const utxo of utxos) {
          selectedUtxos.push(utxo);
          totalInput += utxo.value;
          if (totalInput >= satoshisToSend + minerFee) break;
        }

        if (totalInput < satoshisToSend + minerFee) {
          throw new Error("Insufficient BTC in hot wallet.");
        }

        const psbt = new bitcoin.Psbt({ network: bitcoin.networks.bitcoin });
        for (const utxo of selectedUtxos) {
          psbt.addInput({
            hash: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
              script: bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network: bitcoin.networks.bitcoin }).output,
              value: utxo.value,
            },
          });
        }

        psbt.addOutput({ address: toAddress, value: satoshisToSend });
        const change = totalInput - satoshisToSend - minerFee;
        if (change > 546) psbt.addOutput({ address: hotWalletAddress, value: change });

        for (let i = 0; i < selectedUtxos.length; i++) psbt.signInput(i, keyPair);
        psbt.finalizeAllInputs();

        const rawTx = psbt.extractTransaction().toHex();
        const broadcastResponse = await fetch(`${BTC_API}/tx`, { method: 'POST', body: rawTx });
        if (!broadcastResponse.ok) {
          const errorText = await broadcastResponse.text();
          throw new Error(`BTC broadcast failed: ${errorText}`);
        }
        txHash = await broadcastResponse.text();

      } else if (network === 'SOL') {
        const hotWalletKey = process.env.STABLEX_HOT_WALLET_SOL_PRIVATE_KEY;
        if (!hotWalletKey) throw new Error("SOL Hot Wallet is not configured.");

        const { Connection, Keypair: SolKeypair, PublicKey, Transaction: SolTransaction, SystemProgram, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
        const solRpcUrl = process.env.SOL_RPC_URL || 'https://api.mainnet-beta.solana.com';
        const connection = new Connection(solRpcUrl, 'confirmed');
        const secretKey = Uint8Array.from(Buffer.from(hotWalletKey, 'hex'));
        const senderKeypair = SolKeypair.fromSecretKey(secretKey);

        const lamports = Math.floor(withdrawAmount * LAMPORTS_PER_SOL);
        const solTx = new SolTransaction().add(
          SystemProgram.transfer({
            fromPubkey: senderKeypair.publicKey,
            toPubkey: new PublicKey(toAddress),
            lamports: lamports,
          })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        solTx.recentBlockhash = blockhash;
        solTx.feePayer = senderKeypair.publicKey;
        solTx.sign(senderKeypair);
        txHash = await connection.sendRawTransaction(solTx.serialize());
        await connection.confirmTransaction(txHash, 'confirmed');
      }

      // 5. Mark Transaction as Complete
      await Transaction.findByIdAndUpdate(transaction[0]._id, {
        status: 'completed',
        'metadata.txHash': txHash
      });

      res.json({
        success: true,
        message: 'Withdrawal broadcasted successfully',
        txHash,
        balance: updatedWallet.balance
      });
      console.log(`[TX_TRACE] Crypto Withdrawal Broadcast Success: ${transactionRef} | Hash: ${txHash}`);

    } catch (broadcastError) {
      console.error("❌ Blockchain broadcast failed. Initiating automatic refund...", broadcastError.message);

      // CRITICAL: Refund the user's balance
      await Wallet.findOneAndUpdate(
        { _id: updatedWallet._id },
        { $inc: { balance: totalDeduction } }
      );

      // Mark transaction as failed with error details
      await Transaction.findByIdAndUpdate(transaction[0]._id, {
        status: 'failed',
        description: `Withdrawal failed: ${broadcastError.message}`
      });

      res.status(500).json({
        success: false,
        error: `Broadcast failed: ${broadcastError.message}. Funds have been refunded to your wallet.`
      });
    }
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    console.error("Crypto withdrawal prep error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Withdrawal Endpoint (Persistent + Interswitch)
router.post('/withdraw', protect, async (req, res) => {
  const { amount, accountNumber, bankCode, beneficiaryName, narration } = req.body;

  if (!amount || !accountNumber || !bankCode || !beneficiaryName) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  console.log(`[TX_TRACE] NGN Withdrawal Initialized: User ${req.user._id} | Amount: ₦${amount} to ${beneficiaryName} (${accountNumber})`);

  // 1. Transaction & Balance Logic (MongoDB)
  const session = await Transaction.startSession();
  session.startTransaction();

  try {
    const user = req.user;
    const withdrawAmount = Number(amount);

    // Find NGN Wallet
    const wallet = await Wallet.findOne({ user: user._id, currency: 'NGN' }).session(session);

    if (!wallet) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, error: 'NGN Wallet not found' });
    }

    if (wallet.balance < withdrawAmount) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, error: 'Insufficient balance' });
    }

    // Deduct Balance Atomically
    const updatedWallet = await Wallet.findOneAndUpdate(
      { _id: wallet._id, balance: { $gte: withdrawAmount } },
      { $inc: { balance: -withdrawAmount } },
      { new: true, session }
    );
    if (!updatedWallet) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, error: 'Insufficient balance or concurrent transaction.' });
    }

    // Create Transaction Record (Pending)
    const transaction = await Transaction.create([{
      user: user._id,
      type: 'withdrawal',
      status: 'pending',
      amount: withdrawAmount,
      currency: 'NGN',
      reference: `W-${Date.now()}`,
      description: `Withdrawal to ${beneficiaryName} (${accountNumber})`,
      metadata: { bankCode, accountNumber, beneficiaryName }
    }], { session });

    await session.commitTransaction();
    session.endSession();

    // 2. Call Interswitch Transfer (Real API)
    // We construct the payload exactly as server/interswitch.js expects, 
    // but here we call the localized logic or the external API directly.
    // To keep it dry and since we are in the same server, we can reuse the logic
    // OR for robustness, we just call the Interswitch API URL directly here.

    // For this implementation, we will fetch the local Interswitch endpoint we already built
    // This allows us to reuse the token management in interswitch.js without duplicating code.
    // In a microservice architecture, this would be an RPC call.

    const protocol = req.protocol;
    const host = req.get('host');
    const transferUrl = `${protocol}://${host}/api/interswitch/transfer`;

    const transferResponse = await fetch(transferUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization // Forward user token so protect middleware acts properly on route
      },
      body: JSON.stringify({
        amount: withdrawAmount,
        accountNumber,
        bankCode,
        beneficiaryName,
        senderName: user.name || 'StableX User',
        senderEmail: user.email || 'user@stablex.com',
        senderPhone: user.phone || '08000000000',
        narration: narration || 'StableX Withdrawal',
        transactionRef: transaction[0].reference
      })
    });

    const transferData = await transferResponse.json();

    // 3. Update Transaction Status based on Interswitch Response
    // Our payout controller will return { success: true, data: { ... } } if the request hit the bank transfer API cleanly
    if (transferData.success) {
      await Transaction.findByIdAndUpdate(transaction[0]._id, { status: 'completed' });
      res.json({
        success: true,
        message: 'Withdrawal processing successful',
        balance: updatedWallet.balance,
        transactionRef: transaction[0].reference,
        ...transferData.data
      });
    } else {
      // If Interswitch fails, we must REFUND the user (Reverse the transaction)
      // Re-open session for refund
      console.log("[Withdrawal] ⚠️ External Payout failed. Refunding user...");
      const refundSession = await Transaction.startSession();
      refundSession.startTransaction();
      try {
        const walletToRefund = await Wallet.findOne({ user: user._id, currency: 'NGN' }).session(refundSession);
        await Wallet.findOneAndUpdate(
          { _id: walletToRefund._id },
          { $inc: { balance: withdrawAmount } },
          { new: true, session: refundSession }
        );

        await Transaction.findByIdAndUpdate(transaction[0]._id, { status: 'failed', description: `Refunded: ${transferData.error}` }).session(refundSession);

        await refundSession.commitTransaction();
      } catch (refundError) {
        console.error("Critical Refund Error:", refundError);
        await refundSession.abortTransaction();
      } finally {
        refundSession.endSession();
      }

      res.status(400).json({ success: false, error: transferData.error || 'Transfer failed' });
    }

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Withdrawal error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 1. Define Spread Rates
const SPREAD_PERCENTAGE = 0.025; // 2.5% Profit Margin

// GET /api/transactions/rates - Fetch live rates for frontend
router.get('/rates', async (req, res) => {
  try {
    const liveRates = await getLiveRates();
    const marketRate = liveRates.USDT_NGN || 1600;

    const RATES = {
      // User SELLS USDT (We buy low)
      'USDT_NGN': marketRate * (1 - SPREAD_PERCENTAGE),
      // User BUYS USDT (We sell high) -> 1 USDT costs more NGN
      'NGN_USDT': 1 / (marketRate * (1 + SPREAD_PERCENTAGE))
    };

    // Add other pairs based on USDT value dynamically
    ['BTC', 'ETH', 'SOL', 'TRX'].forEach(coin => {
      if (liveRates[`${coin}_NGN`]) {
        RATES[`${coin}_NGN`] = liveRates[`${coin}_NGN`] * (1 - SPREAD_PERCENTAGE);
        RATES[`NGN_${coin}`] = 1 / (liveRates[`${coin}_NGN`] * (1 + SPREAD_PERCENTAGE));
      }
    });

    res.json({
      success: true,
      rates: RATES,
      marketRate: marketRate,
      spread: SPREAD_PERCENTAGE
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch rates" });
  }
});

// Swap Endpoint (Atomic Exchange with Profit Spread)
router.post('/swap', protect, async (req, res) => {
  const { fromCurrency, toCurrency, amount } = req.body;

  if (!fromCurrency || !toCurrency || !amount) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  console.log(`[TX_TRACE] Swap Requested: User ${req.user._id} | ${amount} ${fromCurrency} -> ${toCurrency}`);

  // Fetch Live Rates
  const liveRates = await getLiveRates();
  const SPREAD_PERCENTAGE = 0.025; // 2.5% — competitive with local exchanges (Bitnob 3-4%)

  const CURRENCY_NETWORKS = {
    'NGN': 'INTERNAL',
    'USDT': 'TRC20',
    'TRX': 'TRC20',
    'ETH_TRC20': 'TRC20',
    'SOL_TRC20': 'TRC20',
    'BTC': 'BTC',
    'ETH': 'ERC20',
    'USDT_ERC20': 'ERC20',
    'SOL': 'SOL'
  };

  // Option A Check: Same Chain or NGN bridge
  const fromNetwork = CURRENCY_NETWORKS[fromCurrency];
  const toNetwork = CURRENCY_NETWORKS[toCurrency];

  if (!fromNetwork || !toNetwork) {
    return res.status(400).json({ success: false, error: 'Invalid currency selection' });
  }

  const isNgnBridge = fromCurrency === 'NGN' || toCurrency === 'NGN';
  const isSameChain = fromNetwork === toNetwork;

  if (!isNgnBridge && !isSameChain) {
    return res.status(400).json({
      success: false,
      error: `Cross-chain swaps (e.g. ${fromNetwork} to ${toNetwork}) are not supported. Please swap to NGN first.`
    });
  }

  // Calculate Rate: (Value of From in NGN) / (Value of To in NGN)
  const getRateInNgn = (curr) => {
    if (curr === 'NGN') return 1;
    return liveRates[`${curr}_NGN`] || 0;
  };

  const fromValNgn = getRateInNgn(fromCurrency);
  const toValNgn = getRateInNgn(toCurrency);

  if (fromValNgn === 0 || toValNgn === 0) {
    return res.status(400).json({ success: false, error: 'Rate unavailable for this pair' });
  }

  // Final Rate with Spread
  // If moving out of NGN (buying crypto), rate is LOWER (user gets less)
  // If moving into NGN (selling crypto), rate is HIGHER (base NGN is higher, but we handle it via division)
  // Simpler: Just apply spread to the final amount
  const marketRate = fromValNgn / toValNgn;
  const rate = marketRate * (1 - SPREAD_PERCENTAGE);

  if (!rate) {
    return res.status(400).json({ success: false, error: 'Unsupported currency pair' });
  }

  const session = await Transaction.startSession();
  session.startTransaction();

  try {
    const user = req.user;
    const swapAmount = Number(amount);

    // 1. Get Source Wallet (Debit)
    const sourceWallet = await Wallet.findOne({ user: user._id, currency: fromCurrency }).session(session);
    if (!sourceWallet || sourceWallet.balance < swapAmount) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, error: `Insufficient ${fromCurrency} balance` });
    }

    // 2. Get Destination Wallet (Credit)
    let destWallet = await Wallet.findOne({ user: user._id, currency: toCurrency }).session(session);

    // Create destination wallet if it doesn't exist (e.g., first time holding USDT)
    if (!destWallet) {
      destWallet = await Wallet.create([{
        user: user._id,
        currency: toCurrency,
        balance: 0,
        address: "INTERNAL_SWAP",
        encryptedPrivateKey: "N/A",
        iv: "N/A",
        authTag: "N/A"
      }], { session });
      destWallet = destWallet[0];
    }

    // --- TREASURY LIQUIDITY CHECK ---
    const treasuryUser = await User.findOne({ email: 'platform@stablex.internal' }).session(session);
    if (!treasuryUser) {
      // This indicates a critical setup error, as the platform treasury user should always exist.
      // We throw an error to ensure the transaction is aborted and the issue is logged/addressed.
      throw new Error('Treasury account not found. Run seedAdmin.js first.');
    }

    const treasurySourceWallet = await Wallet.findOne({ user: treasuryUser._id, currency: toCurrency }).session(session);
    const treasuryDestWallet = await Wallet.findOne({ user: treasuryUser._id, currency: fromCurrency }).session(session);

    // 3. Calculate Exchange
    const receiveAmount = swapAmount * rate;

    if (!treasurySourceWallet || treasurySourceWallet.balance < receiveAmount) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, error: `Treasury liquidity low for ${toCurrency}. Try a smaller amount.` });
    }

    // 4. Perform Atomic Update (Move funds User <-> Treasury)
    // User pays 'from' -> Treasury gets 'from'
    const updatedSource = await Wallet.findOneAndUpdate(
      { _id: sourceWallet._id, balance: { $gte: swapAmount } },
      { $inc: { balance: -swapAmount } },
      { new: true, session }
    );
    if (!updatedSource) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, error: 'Insufficient balance or concurrent transaction during swap' });
    }

    const updatedDest = await Wallet.findOneAndUpdate(
      { _id: destWallet._id },
      { $inc: { balance: receiveAmount } },
      { new: true, session }
    );

    // Treasury pays 'to' -> User gets 'to'
    const updatedTreasurySource = await Wallet.findOneAndUpdate(
      { _id: treasurySourceWallet._id, balance: { $gte: receiveAmount } },
      { $inc: { balance: -receiveAmount } },
      { new: true, session }
    );
    if (!updatedTreasurySource) {
      await session.abortTransaction();
      return res.status(500).json({ success: false, error: 'Treasury liquidity error during swap execution' });
    }

    await Wallet.findOneAndUpdate(
      { user: treasuryUser._id, currency: fromCurrency },
      {
        $inc: { balance: swapAmount },
        $setOnInsert: {
          user: treasuryUser._id,
          currency: fromCurrency,
          network: fromNetwork,
          address: 'INTERNAL_TREASURY_SWAP',
          walletType: 'admin',
          encryptedPrivateKey: 'N/A',
          privateKeyIv: 'N/A',
          privateKeyAuthTag: 'N/A'
        }
      },
      { new: true, upsert: true, session }
    );

    // 5. Calculate Profit in NGN
    const tradeValueInNGN = swapAmount * fromValNgn;
    const estimatedProfit = tradeValueInNGN * SPREAD_PERCENTAGE;
    const swapRef = `SWAP-${Date.now()}`;

    // 6. Record Transaction
    const transaction = await Transaction.create([{
      user: user._id,
      type: 'swap',
      status: 'completed',
      amount: swapAmount,
      profit: estimatedProfit,
      currency: fromCurrency,
      reference: swapRef,
      description: `Swapped ${swapAmount} ${fromCurrency} to ${receiveAmount.toFixed(6)} ${toCurrency}`,
      metadata: {
        rate,
        receivedAmount: receiveAmount,
        toCurrency,
        marketRate: marketRate,
        spread: SPREAD_PERCENTAGE,
        network: fromNetwork
      }
    }], { session });

    await session.commitTransaction();
    session.endSession();

    // 7. Route swap spread profit to platform NGN wallet (outside session)
    if (PLATFORM_FEE_WALLET_ID && estimatedProfit > 0) {
      try {
        await creditUserWallet(PLATFORM_FEE_WALLET_ID, 'NGN', estimatedProfit, `spread_${swapRef}`, {
          type: 'swap_spread', fromCurrency, toCurrency, spreadPercentage: SPREAD_PERCENTAGE
        });
        console.log(`[FEE_ROUTING] ✅ Swap spread profit (${estimatedProfit} NGN) credited to platform wallet`);
      } catch (feeErr) {
        console.error(`[FEE_ROUTING] ❌ CRITICAL: Swap spread credit failed for ${swapRef}:`, feeErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Swap successful',
      fromBalance: updatedSource.balance,
      toBalance: updatedDest.balance,
      receivedAmount,
      transaction: transaction[0]
    });
    console.log(`[TX_TRACE] Swap Success: ${swapRef} | User ${user._id} | Net ${receiveAmount} ${toCurrency}`);

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Swap error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
