// ──────────────────────────────────────────────────────────────
// Blockchain Listener
// Polls TronGrid for TRC20 deposits to user wallets
// After confirmation: credits DB balance + sweeps to hot wallet
// ──────────────────────────────────────────────────────────────
import Wallet from '../models/walletModel.js';
import Transaction from '../models/transactionModel.js';
import { creditUserWallet } from '../services/walletService.js';
import { estimateTronGas } from '../utils/gasEstimator.js';
import { decrypt } from '../utils/encryption.js';
import fetch from 'node-fetch';
import crypto from 'crypto';
import * as ecc from 'tiny-secp256k1';
import SweepQueue from '../models/sweepQueueModel.js';

export const TRC20_TOKENS = [
    { symbol: 'USDT', contract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", decimals: 6, key: 'USDT_TRC20' },
    { symbol: 'ETH', contract: "TH1CPKStf9r5jV3M9oY4g8Dk64gM2D9V6", decimals: 18, key: 'ETH_TRC20' },
    { symbol: 'SOL', contract: "TPvJpQpXmH8r4g5f3D9V6", decimals: 9, key: 'SOL_TRC20' }
];

const TRON_GRID_API = "https://api.trongrid.io";
const HOT_WALLET = process.env.STABLEX_HOT_WALLET_TRC20;
const ENABLE_SWEEP = process.env.ENABLE_AUTO_SWEEP === 'true';
const TREASURY_PRIVATE_KEY = process.env.STABLEX_TREASURY_TRC20_PRIVATE_KEY;

// Confirmation thresholds per network
const CONFIRMATION_THRESHOLDS = {
    TRON: 20,   // 20 blocks (~60 seconds)
    ETH: 12,    // 12 blocks (~3 minutes)
    BTC: 3,     // 3 blocks (~30 minutes)
};

export const startBlockchainListener = () => {
    console.log("🔗 Blockchain Listener Started: Polling for TRC20 deposits (USDT, ETH, SOL)...");
    console.log(`📊 Confirmation thresholds: TRON=${CONFIRMATION_THRESHOLDS.TRON}, ETH=${CONFIRMATION_THRESHOLDS.ETH}, BTC=${CONFIRMATION_THRESHOLDS.BTC}`);
    if (HOT_WALLET) {
        console.log(`🏦 Hot Wallet: ${HOT_WALLET}`);
        console.log(`🔄 Auto-Sweep: ${ENABLE_SWEEP ? 'ENABLED' : 'DISABLED'}`);
    } else {
        console.log("⚠️ No hot wallet configured. Sweep disabled. Set STABLEX_HOT_WALLET_TRC20 in .env");
    }

    // Poll for new deposits every 30 seconds
    setInterval(checkDeposits, 30000);
    // Check confirmations for pending deposits every 60 seconds
    setInterval(checkPendingConfirmations, 60000);
};

const checkDeposits = async () => {
    try {
        const wallets = await Wallet.find({
            currency: { $in: ['USDT_TRC20', 'ETH_TRC20', 'SOL_TRC20'] }
        });

        if (wallets.length === 0) return;

        console.log(`[POLL] 🔍 Scanning ${wallets.length} wallets for deposits...`);

        // Use a simple concurrency pool (batch size of 10)
        // This prevents the O(N) sequential bottleneck while also avoiding 
        // overwhelming the TronGrid API rate limits.
        const BATCH_SIZE = 10;
        for (let i = 0; i < wallets.length; i += BATCH_SIZE) {
            const batch = wallets.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(wallet => checkWalletForDeposits(wallet)));

            // Subtle delay between batches if the userbase is very large (e.g. > 100)
            if (wallets.length > 50) {
                await new Promise(r => setTimeout(r, 500));
            }
        }
    } catch (error) {
        console.error("Blockchain Poll Error:", error.message);
    }
};

const checkWalletForDeposits = async (wallet) => {
    try {
        for (const token of TRC20_TOKENS) {
            if (token.key !== wallet.currency) continue;

            let url = `${TRON_GRID_API}/v1/accounts/${wallet.address}/transactions/trc20?contract_address=${token.contract}&limit=5`;
            let scanLimit = 5;

            // If we've checked before, scan forward from the exact millisecond of the last known tx
            if (wallet.lastCheckedTimestamp) {
                const minTimestamp = new Date(wallet.lastCheckedTimestamp).getTime();
                url = `${TRON_GRID_API}/v1/accounts/${wallet.address}/transactions/trc20?contract_address=${token.contract}&min_timestamp=${minTimestamp + 1}&limit=50`;
                scanLimit = 50;
            }

            const response = await fetch(url);
            const data = await response.json();

            if (!data.success || !data.data) continue;

            let highestTimestamp = wallet.lastCheckedTimestamp ? new Date(wallet.lastCheckedTimestamp).getTime() : 0;
            let foundNew = false;

            for (const tx of data.data) {
                // Track the highest timestamp we've seen in this scan batch
                const txTime = parseInt(tx.block_timestamp, 10);
                if (txTime > highestTimestamp) {
                    highestTimestamp = txTime;
                    foundNew = true;
                }

                // Skip if we've already processed this on-chain transaction
                const existingTx = await Transaction.findOne({ reference: tx.transaction_id });

                if (!existingTx) {
                    // New on-chain deposit detected
                    if (tx.to === wallet.address && tx.type === "Transfer") {
                        const amount = parseFloat(tx.value) / Math.pow(10, token.decimals);

                        console.log('');
                        console.log('═══════════════════════════════════════════════');
                        console.log(`💰 New ${token.symbol} Deposit Detected!`);
                        console.log(`   Amount: ${amount} ${token.symbol}`);
                        console.log(`   To: ${wallet.address}`);
                        console.log(`   From: ${tx.from}`);
                        console.log(`   TxHash: ${tx.transaction_id}`);
                        console.log(`   User: ${wallet.user}`);
                        console.log(`   Status: CONFIRMING (need ${CONFIRMATION_THRESHOLDS.TRON} confirmations)`);
                        console.log('═══════════════════════════════════════════════');

                        // Create deposit record with 'confirming' status
                        // Balance will NOT be credited until confirmations are met
                        const pendingTx = await Transaction.findOne({
                            user: wallet.user,
                            currency: token.symbol,
                            status: 'pending',
                            type: 'deposit',
                        });

                        if (pendingTx) {
                            pendingTx.status = 'confirming';
                            pendingTx.amount = amount;
                            pendingTx.metadata = pendingTx.metadata || new Map();
                            pendingTx.metadata.set('onChainTxHash', tx.transaction_id);
                            pendingTx.metadata.set('from', tx.from);
                            pendingTx.metadata.set('blockTimestamp', String(tx.block_timestamp));
                            pendingTx.metadata.set('network', 'TRC20');
                            pendingTx.metadata.set('confirmations', '0');
                            pendingTx.metadata.set('requiredConfirmations', String(CONFIRMATION_THRESHOLDS.TRON));
                            pendingTx.metadata.set('walletId', String(wallet._id));
                            await pendingTx.save();
                            console.log(`⏳ Matched pending tx ${pendingTx.reference} → now 'confirming'`);
                        } else {
                            await Transaction.create({
                                user: wallet.user,
                                type: 'deposit',
                                status: 'confirming',
                                amount: amount,
                                currency: token.symbol,
                                reference: tx.transaction_id,
                                description: `${token.symbol} deposit from ${tx.from} (confirming)`,
                                metadata: {
                                    from: tx.from,
                                    blockTimestamp: String(tx.block_timestamp),
                                    network: 'TRC20',
                                    onChainTxHash: tx.transaction_id,
                                    confirmations: '0',
                                    requiredConfirmations: String(CONFIRMATION_THRESHOLDS.TRON),
                                    walletId: String(wallet._id),
                                }
                            });
                            console.log('📝 Created new deposit record with status: confirming');
                        }
                    }
                }
            }

            // Save the updated cursor context to the wallet so we never miss deposits
            if (foundNew) {
                wallet.lastCheckedTimestamp = new Date(highestTimestamp);
                await wallet.save();
            }
        }
    } catch (error) {
        console.error(`Error checking wallet ${wallet.address}:`, error.message);
    }
};

// ── Check Pending Confirmations ──────────────────────────────────
// Polls unconfirmed deposits and checks if they've reached the threshold
const checkPendingConfirmations = async () => {
    try {
        const confirmingTxs = await Transaction.find({ status: 'confirming', type: 'deposit' });

        if (confirmingTxs.length === 0) return;

        // Get current TRON block number
        const blockResponse = await fetch(`${TRON_GRID_API}/wallet/getnowblock`);
        const blockData = await blockResponse.json();
        const currentBlock = blockData?.block_header?.raw_data?.number;

        if (!currentBlock) {
            console.error('Failed to get current TRON block number');
            return;
        }

        for (const tx of confirmingTxs) {
            const txHash = tx.metadata?.get('onChainTxHash') || tx.reference;
            const requiredConfs = Number(tx.metadata?.get('requiredConfirmations') || CONFIRMATION_THRESHOLDS.TRON);
            const walletId = tx.metadata?.get('walletId');

            try {
                // Get transaction info to find its block number
                const txInfoResponse = await fetch(`${TRON_GRID_API}/wallet/gettransactioninfobyid`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ value: txHash }),
                });
                const txInfo = await txInfoResponse.json();

                if (!txInfo.blockNumber) continue; // Transaction not yet in a block

                const confirmations = currentBlock - txInfo.blockNumber;
                tx.metadata.set('confirmations', String(confirmations));
                await tx.save();

                console.log(`⏳ Tx ${txHash.substring(0, 12)}... has ${confirmations}/${requiredConfs} confirmations`);

                if (confirmations >= requiredConfs) {
                    console.log(`✅ Tx ${txHash.substring(0, 12)}... CONFIRMED! Crediting balance...`);

                    // Prepare metadata combining old and new
                    const updatedMetadata = tx.metadata ? Object.fromEntries(tx.metadata) : {};
                    updatedMetadata.confirmedAt = new Date().toISOString();

                    // Credit user's balance and mark transaction complete atomically
                    let updatedWallet = await Wallet.findById(walletId); // Default to existing if credit fails idempotency
                    try {
                        const creditResult = await creditUserWallet(
                            tx.user,
                            tx.currency,
                            tx.amount,
                            tx.reference,
                            updatedMetadata
                        );
                        updatedWallet = creditResult.wallet;
                    } catch (err) {
                        console.error(`❌ Atomic credit failed for ${tx.reference}: ${err.message}`);
                    }

                    // Auto-sweep to hot wallet
                    if (ENABLE_SWEEP && HOT_WALLET && updatedWallet) {
                        console.log(`🔄 Initiating sweep to hot wallet: ${HOT_WALLET}`);
                        try {
                            const token = TRC20_TOKENS.find(t => t.symbol === tx.currency || t.key === updatedWallet.currency);
                            if (token) {
                                await sweepToHotWallet(updatedWallet, token, tx.amount, txHash);
                            }
                        } catch (sweepError) {
                            console.error(`❌ Sweep failed (will retry): ${sweepError.message}`);
                            try {
                                const token = TRC20_TOKENS.find(t => t.symbol === tx.currency || t.key === updatedWallet.currency);
                                await SweepQueue.create({
                                    walletId: updatedWallet._id,
                                    tokenSymbol: token ? token.symbol : tx.currency,
                                    amount: tx.amount,
                                    depositTxHash: txHash,
                                    status: 'pending',
                                    lastError: sweepError.message,
                                    nextRetryAt: new Date(Date.now() + 5 * 60 * 1000) // retry in 5 mins
                                });
                                console.log(`[SWEEP QUEUE] ✅ Added failed sweep to retry queue`);
                            } catch (queueErr) {
                                console.error(`[SWEEP QUEUE] ❌ Failed to add to queue: ${queueErr.message}`);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error(`Error checking confirmation for ${txHash}:`, err.message);
            }
        }
    } catch (error) {
        console.error('Confirmation check error:', error.message);
    }
};

/**
 * Sweep TRC20 tokens from user wallet → StableX hot wallet
 * Uses the user's encrypted private key to sign the transaction
 */
export const sweepToHotWallet = async (wallet, token, amount, depositTxHash) => {
    console.log(`[SWEEP] Starting sweep of ${amount} ${token.symbol}...`);

    // 1. Decrypt the user's private key
    const privateKey = decrypt(wallet.encryptedPrivateKey, wallet.iv, wallet.authTag);
    const cleanKey = privateKey.replace('0x', '');

    console.log(`[SWEEP] Private key decrypted. Building TRC20 transfer...`);

    // 1.5 - Fund the wallet with TRX gas to pay for network fee
    if (TREASURY_PRIVATE_KEY && TREASURY_PRIVATE_KEY !== 'REPLACE_WITH_YOUR_MASTER_PRIVATE_KEY') {
        // Use dynamic gas estimation instead of static .env value
        const trxGasAmount = await estimateTronGas(wallet.address, HOT_WALLET, amount);
        console.log(`[SWEEP] Dynamic gas estimate: ${trxGasAmount} TRX`);
        const gasFunded = await fundWalletWithTrx(wallet.address, trxGasAmount); // Sending TRX for gas
        if (gasFunded) {
            console.log(`[SWEEP] ⏳ Waiting 15 seconds for gas TRX to confirm on chain...`);
            await new Promise(r => setTimeout(r, 15000));
        } else {
            throw new Error('Failed to fund gas to user wallet. Sweep aborted to save energy.');
        }
    } else {
        console.warn(`[SWEEP] ⚠️ No TREASURY_PRIVATE_KEY set in .env. Attempting sweep assuming user has pre-existing TRX balance/energy.`);
    }

    // 2. Build TRC20 transfer transaction via TronGrid
    const amountInSmallestUnit = BigInt(Math.round(amount * Math.pow(10, token.decimals)));

    // Call triggersmartcontract to build the transfer
    const triggerUrl = `${TRON_GRID_API}/wallet/triggersmartcontract`;
    const triggerBody = {
        owner_address: tronAddressToHex(wallet.address),
        contract_address: tronAddressToHex(token.contract),
        function_selector: "transfer(address,uint256)",
        parameter: encodeTransferParams(HOT_WALLET, amountInSmallestUnit),
        fee_limit: 100000000, // 100 TRX max fee
        call_value: 0,
    };

    const triggerRes = await fetch(triggerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(triggerBody),
    });

    const triggerData = await triggerRes.json();

    if (!triggerData.result?.result) {
        throw new Error(`Trigger failed: ${JSON.stringify(triggerData.result)}`);
    }

    console.log(`[SWEEP] Transaction built. Signing...`);

    // 3. Sign the transaction
    const signedTx = signTronTransaction(triggerData.transaction, cleanKey);

    // 4. Broadcast
    const broadcastRes = await fetch(`${TRON_GRID_API}/wallet/broadcasttransaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signedTx),
    });

    const broadcastData = await broadcastRes.json();

    if (!broadcastData.result) {
        throw new Error(`Broadcast failed: ${broadcastData.message || JSON.stringify(broadcastData)}`);
    }

    const sweepTxHash = triggerData.transaction.txID;
    console.log(`[SWEEP] ✅ Swept ${amount} ${token.symbol} to hot wallet!`);
    console.log(`[SWEEP] Sweep TxHash: ${sweepTxHash}`);

    // 5. Record the sweep transaction
    await Transaction.create({
        user: wallet.user,
        type: 'sweep',
        status: 'completed',
        amount: amount,
        currency: token.symbol,
        reference: `SWEEP_${sweepTxHash}`,
        description: `Auto-sweep ${amount} ${token.symbol} to hot wallet`,
        metadata: {
            depositTxHash,
            sweepTxHash,
            fromAddress: wallet.address,
            toAddress: HOT_WALLET,
            network: 'TRC20',
        }
    });

    return sweepTxHash;
};

/**
 * Send TRX gas to the user wallet from the master treasury
 */
const fundWalletWithTrx = async (toAddress, trxAmount) => {
    try {
        console.log(`[TREASURY] Funding ${toAddress} with ${trxAmount} TRX for gas...`);
        const cleanTreasuryKey = TREASURY_PRIVATE_KEY.replace('0x', '');

        // 1. Derive treasury address from private key
        const keyPair = ECPair.fromPrivateKey(Buffer.from(cleanTreasuryKey, 'hex'));
        const pubKey = keyPair.publicKey;
        const msgHash = crypto.createHash('sha3-256').update(pubKey.slice(1)).digest();
        const addressHex = "41" + msgHash.slice(-20).toString('hex');

        const amountInSun = trxAmount * 1_000_000;

        // 2. Create TRX Transfer transaction
        const createUrl = `${TRON_GRID_API}/wallet/createtransaction`;
        const createBody = {
            to_address: tronAddressToHex(toAddress),
            owner_address: addressHex,
            amount: amountInSun
        };

        const createRes = await fetch(createUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(createBody)
        });

        const txData = await createRes.json();

        // Error on tron side, not success
        if (txData.Error) {
            console.error(`[TREASURY] ❌ Failed to create TRX transfer: ${txData.Error}`);
            return false;
        }

        // 3. Sign Transaction
        const signedTx = signTronTransaction(txData, cleanTreasuryKey);

        // 4. Broadcast
        const broadcastRes = await fetch(`${TRON_GRID_API}/wallet/broadcasttransaction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(signedTx)
        });

        const broadcastData = await broadcastRes.json();
        if (broadcastData.result) {
            console.log(`[TREASURY] ✅ Sent ${trxAmount} TRX. TxHash: ${txData.txID}`);
            return true;
        } else {
            console.error(`[TREASURY] ❌ Broadcast failed:`, broadcastData);
            return false;
        }
    } catch (e) {
        console.error(`[TREASURY] 💥 Fatal err during TRX funding: ${e.message}`);
        return false;
    }
};

// ── Helper: Convert Tron base58 address to hex ──
// (Copied from transactions.js — inline to avoid circular deps)
function tronAddressToHex(address) {
    if (address.startsWith('41')) return address;
    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let num = BigInt(0);
    for (const char of address) {
        num = num * BigInt(58) + BigInt(ALPHABET.indexOf(char));
    }
    return num.toString(16).slice(0, 42);
}

// ── Helper: Encode transfer(address,uint256) parameters ──
function encodeTransferParams(toAddress, amount) {
    const addressHex = tronAddressToHex(toAddress).slice(2).padStart(64, '0');
    const amountHex = amount.toString(16).padStart(64, '0');
    return addressHex + amountHex;
}

// ── Helper: Sign Tron transaction ──
function signTronTransaction(transaction, privateKey) {
    const txHash = transaction.raw_data_hex;
    const msgHash = crypto.createHash('sha256').update(Buffer.from(txHash, 'hex')).digest();
    const privKeyBytes = Buffer.from(privateKey, 'hex');
    const signature = ecc.sign(msgHash, privKeyBytes);
    const r = Buffer.from(signature.slice(0, 32)).toString('hex').padStart(64, '0');
    const s = Buffer.from(signature.slice(32, 64)).toString('hex').padStart(64, '0');
    const v = '1b';
    return { ...transaction, signature: [r + s + v] };
}
