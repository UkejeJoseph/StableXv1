import { TronWeb } from 'tronweb';
import Wallet from '../models/walletModel.js';
import User from '../models/userModel.js';
import Transaction from '../models/transactionModel.js';
import { creditUserWallet } from '../services/walletService.js';
import { estimateTronGas } from '../utils/gasEstimator.js';
import { decrypt } from '../utils/encryption.js';
import { queueWebhook } from '../services/webhookService.js';
import { sendOperationalAlert } from '../utils/alerting.js';
import fetch from 'node-fetch';
import crypto from 'crypto';
import * as ecc from 'tiny-secp256k1';
import SweepQueue from '../models/sweepQueueModel.js';
import { trackApiCall } from '../utils/apiTracker.js';
import { ECPairFactory } from 'ecpair';
const ECPair = ECPairFactory(ecc);
import axios from 'axios';
import http from 'http';
import https from 'https';

const httpAgent = new http.Agent({ family: 4 });
const httpsAgent = new https.Agent({ family: 4 });

const axiosIPv4 = axios.create({
    httpAgent,
    httpsAgent,
    timeout: 15000
});

export const TRC20_TOKENS = [
    { symbol: 'USDT', contract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", decimals: 6, key: 'USDT_TRC20' },
    { symbol: 'ETH', contract: "TH1CPKStf9r5jV3M9oY4g8Dk64gM2D9V6", decimals: 18, key: 'ETH_TRC20' },
    { symbol: 'SOL', contract: "TPvJpQpXmH8r4g5f3D9V6", decimals: 9, key: 'SOL_TRC20' }
];

const TRON_MIN_CONFIRMATIONS = 10;
const HOT_WALLET = process.env.STABLEX_HOT_WALLET_TRC20;
const ENABLE_SWEEP = process.env.ENABLE_AUTO_SWEEP === 'true';
const TREASURY_PRIVATE_KEY = process.env.STABLEX_TREASURY_TRC20_PRIVATE_KEY;
const TRON_GRID_API = 'https://api.trongrid.io';

const TRON_PROVIDERS = [
    {
        name: "TronGrid",
        buildUrl: (address, minTimestamp) =>
            `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?only_to=true&min_timestamp=${minTimestamp}&limit=50`,
        parse: (data) => data.data || [],
        extract: (tx) => ({
            txId: tx.transaction_id,
            amount: Number(tx.value) / 1_000_000,
            from: tx.from,
            to: tx.to,
            timestamp: tx.block_timestamp,
            confirmations: tx.confirmed ? 20 : 0
        }),
        hasMore: () => false
    },
    {
        name: "Ankr",
        buildUrl: (address) => `https://rpc.ankr.com/tron_jsonrpc`,
        fetchFn: async (address, minTimestamp) => {
            const hexAddress = TronWeb.address.toHex(address).replace('41', '0x');
            const ankrRes = await axiosIPv4.post(
                'https://rpc.ankr.com/tron_jsonrpc',
                {
                    jsonrpc: '2.0', id: 1,
                    method: 'eth_getLogs',
                    params: [{
                        fromBlock: 'latest',
                        toBlock: 'latest',
                        address: '0x' + tronAddressToHex(
                            "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
                        ).slice(2),
                        topics: [
                            '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
                            null,
                            hexAddress.padStart(66, '0')
                        ]
                    }]
                },
                { headers: { 'Content-Type': 'application/json' } }
            );
            const json = ankrRes.data;
            if (json.error) throw new Error(json.error.message);
            const logs = json.result || [];
            return logs.map(log => {
                const amount = Number(BigInt(log.data)) / 1_000_000;
                const fromHex = '41' + log.topics[1].slice(-40);
                return {
                    txId: log.transactionHash,
                    amount,
                    from: TronWeb.address.fromHex(fromHex),
                    to: address,
                    timestamp: Date.now(),
                    confirmations: 20
                };
            });
        },
        parse: (data) => data || [],
        extract: (tx) => tx,
        hasMore: () => false
    },
    {
        name: "Tronscan",
        buildUrl: (address, minTimestamp, start = 0) =>
            `https://apilist.tronscan.org/api/token_trc20/transfers?toAddress=${address}&contract_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t&start_timestamp=${minTimestamp}&limit=50&start=${start}`,
        parse: (data) => data.token_transfers || [],
        extract: (tx) => ({
            txId: tx.transaction_id,
            amount: Number(tx.quant) / 1_000_000,
            from: tx.from_address,
            to: tx.to_address,
            timestamp: tx.block_ts,
            confirmations: tx.confirmed ? 20 : 0
        }),
        hasMore: (data) => (data.token_transfers || []).length === 50
    }
];

let currentTronProviderIndex = 0;
let tronBackoffDelay = 2000;
const TRON_BACKOFF_CAP = 30000;

const getTronProvider = () => TRON_PROVIDERS[currentTronProviderIndex];

const rotateTronProvider = () => {
    const now = Date.now();
    // Prevent multiple rotations/backoffs in a single batch (within 5 seconds)
    if (global.lastTronRotation && (now - global.lastTronRotation < 5000)) {
        return;
    }
    global.lastTronRotation = now;

    currentTronProviderIndex = (currentTronProviderIndex + 1) % TRON_PROVIDERS.length;
    tronBackoffDelay = Math.min(tronBackoffDelay * 2, TRON_BACKOFF_CAP);
    const newProvider = getTronProvider();
    console.warn(`[TRON] 🔄 FALLBACK: Rotating provider to ${newProvider.name}. Reason: RPC Error. New backoff: ${tronBackoffDelay}ms`);
};

const fetchTronWithIPv4 = async (url, options = {}) => {
    console.log(`[TRON-FETCH] 🌐 Requesting: ${url}`);
    try {
        const response = await axiosIPv4.get(url, {
            headers: {
                'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY,
                'User-Agent': 'Mozilla/5.0',
                ...options.headers
            }
        });
        return {
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            json: async () => response.data,
            text: async () => JSON.stringify(response.data)
        };
    } catch (err) {
        if (err.code === 'ECONNABORTED') {
            throw new Error('Timeout');
        }
        throw err;
    }
};

const fetchWithTimeout = async (url, options = {}, timeout = 15000) => {
    const isHttps = url.startsWith('https');
    const agent = isHttps ? httpsAgent : httpAgent;

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        ...options.headers
    };
    // Log URL for production debugging
    if (url.includes('trc20')) {
        console.log(`[TRON-FETCH] 🌐 Requesting: ${url}`);
    }
    return Promise.race([
        fetch(url, { ...options, headers, agent }),
        new Promise((_, reject) =>
            setTimeout(() => {
                console.warn(`[TRON] ⚠️ TIMEOUT: Request to ${url} exceeded ${timeout}ms`);
                reject(new Error("Timeout"));
            }, timeout)
        )
    ]);
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Confirmation thresholds per network
const CONFIRMATION_THRESHOLDS = {
    TRON: 20,   // 20 blocks (~60 seconds)
    ETH: 12,    // 12 blocks (~3 minutes)
    BTC: 3,     // 3 blocks (~30 minutes)
};

export const startBlockchainListener = () => {
    const gridKey = process.env.TRONGRID_API_KEY || '';
    const scanKey = process.env.TRONSCAN_API_KEY || '';
    console.log('************************************************');
    console.log('[TRON] API Key Check:');
    console.log('[TRON] TronGrid Key Length:', gridKey.length);
    console.log('[TRON] TronScan Key Length:', scanKey.length);
    if (gridKey) console.log('[TRON] TronGrid Start/End:', gridKey.substring(0, 4) + '...' + gridKey.substring(gridKey.length - 4));
    if (scanKey) console.log('[TRON] TronScan Start/End:', scanKey.substring(0, 4) + '...' + scanKey.substring(scanKey.length - 4));
    console.log('************************************************');

    console.log("🔗 Blockchain Listener Started: Polling for TRC20 deposits (USDT, ETH, SOL)...");
    console.log(`📊 Confirmation thresholds: TRON=${CONFIRMATION_THRESHOLDS.TRON}, ETH=${CONFIRMATION_THRESHOLDS.ETH}, BTC=${CONFIRMATION_THRESHOLDS.BTC}`);
    if (HOT_WALLET) {
        console.log(`🏦 Hot Wallet: ${HOT_WALLET}`);
        console.log(`🔄 Auto-Sweep: ${ENABLE_SWEEP ? 'ENABLED' : 'DISABLED'}`);
    } else {
        console.log("⚠️ No hot wallet configured. Sweep disabled. Set STABLEX_HOT_WALLET_TRC20 in .env");
    }

    // Start recursive polling
    checkDeposits();
    checkPendingConfirmations();
};

const checkDeposits = async () => {
    try {
        const wallets = await Wallet.find({
            currency: { $in: ['USDT_TRC20', 'ETH_TRC20', 'SOL_TRC20'] },
            address: { $ne: 'FIAT_ACCOUNT' },
            $or: [
                { walletType: 'user' },
                { walletType: 'merchant' }
            ]
        });

        if (wallets.length === 0) return;

        // Deduplicate wallets by address to prevent redundant scans
        const uniqueWallets = [];
        const seenAddresses = new Set();
        for (const w of wallets) {
            if (!seenAddresses.has(w.address)) {
                seenAddresses.add(w.address);
                uniqueWallets.push(w);
            }
        }

        console.log(`[POLL] 🔍 Scanning ${uniqueWallets.length} unique addresses for deposits...`);

        for (const wallet of uniqueWallets) {
            try {
                await checkWalletForDeposits(wallet);
            } catch (err) {
                console.error(`[POLL] ❌ Failed to scan address ${wallet.address}:`, err.message);
            }
        }
    } catch (error) {
        console.error("Blockchain Poll Error:", error.message);
    } finally {
        setTimeout(checkDeposits, 10000); // Recursive call after completion
    }
};

const checkWalletForDeposits = async (wallet) => {
    try {
        for (const token of TRC20_TOKENS) {
            if (token.key !== wallet.currency) continue;

            const minTimestamp = wallet.lastCheckedTimestamp ? new Date(wallet.lastCheckedTimestamp).getTime() : 0;
            let start = 0;
            let hasMore = true;
            let highestTimestamp = minTimestamp;
            let foundNew = false;

            while (hasMore) {
                const provider = getTronProvider();
                const url = provider.buildUrl(wallet.address, minTimestamp, start);

                try {
                    // Use custom fetchFn if provider has one (e.g. Ankr RPC)
                    if (provider.fetchFn) {
                        try {
                            const txs = await provider.fetchFn(wallet.address, minTimestamp);
                            // process txs same as normal
                            for (const tx of txs) {
                                if (tx.confirmations < TRON_MIN_CONFIRMATIONS) continue;
                                const existingTx = await Transaction.findOne({ reference: tx.txId });
                                if (existingTx) continue;
                                if (tx.to === wallet.address) {
                                    // same deposit handling as below
                                    highestTimestamp = Math.max(highestTimestamp, tx.timestamp);
                                    foundNew = true;

                                    const amount = tx.amount;

                                    console.log('');
                                    console.log('═══════════════════════════════════════════════');
                                    console.log(`💰 New ${token.symbol} Deposit Detected! (via Ankr)`);
                                    console.log(`   Amount: ${amount} ${token.symbol}`);
                                    console.log(`   To: ${wallet.address}`);
                                    console.log(`   From: ${tx.from}`);
                                    console.log(`   TxHash: ${tx.txId}`);
                                    console.log(`   User: ${wallet.user}`);
                                    console.log(`   Status: CONFIRMING (need ${CONFIRMATION_THRESHOLDS.TRON} confirmations)`);
                                    console.log('═══════════════════════════════════════════════');

                                    // Create deposit record with 'confirming' status
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
                                        pendingTx.metadata.set('onChainTxHash', tx.txId);
                                        pendingTx.metadata.set('from', tx.from);
                                        pendingTx.metadata.set('blockTimestamp', String(tx.timestamp));
                                        pendingTx.metadata.set('network', 'TRC20');
                                        pendingTx.metadata.set('confirmations', String(tx.confirmations));
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
                                            reference: tx.txId,
                                            description: `${token.symbol} deposit from ${tx.from} (confirming)`,
                                            metadata: {
                                                from: tx.from,
                                                blockTimestamp: String(tx.timestamp),
                                                network: 'TRC20',
                                                onChainTxHash: tx.txId,
                                                confirmations: String(tx.confirmations),
                                                requiredConfirmations: String(CONFIRMATION_THRESHOLDS.TRON),
                                                walletId: String(wallet._id),
                                            }
                                        });
                                        console.log('📝 Created new deposit record with status: confirming');
                                    }
                                }
                            }
                        } catch (ankrErr) {
                            console.error(`[TRON] Ankr RPC failed: ${ankrErr.message}`);
                            rotateTronProvider();
                        }
                        hasMore = false;
                        break;
                    }

                    const fetchOptions = { headers: {} };
                    if (provider.name === 'TronGrid' && process.env.TRONGRID_API_KEY) {
                        fetchOptions.headers['TRON-PRO-API-KEY'] = process.env.TRONGRID_API_KEY;
                    }
                    if (provider.name === 'Tronscan') {
                        const key = process.env.TRONSCAN_API_KEY
                            || process.env.TRONGRID_API_KEY;
                        if (key) fetchOptions.headers['TRON-PRO-API-KEY'] = key;
                    }

                    const response = await fetchTronWithIPv4(url, fetchOptions);

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`[TRON] provider=${provider.name} HTTP=${response.status}: ${errorText}`);
                        rotateTronProvider();
                        await delay(tronBackoffDelay);
                        break;
                    }

                    // Strict 2s delay after every successful fetch to stay < 1 RPS
                    await delay(2000);

                    const data = await response.json();
                    const txs = provider.parse(data);

                    if (txs.length === 0) {
                        hasMore = false;
                        continue;
                    }

                    // Reset backoff on success
                    tronBackoffDelay = 2000;
                    console.log(`[TRON-RES] ✅ OK: Status=${response.status} Items=${txs.length}`);
                    trackApiCall(provider.name === 'Tronscan' ? 'tronscan' : 'trongrid');

                    for (const rawTx of txs) {
                        const tx = provider.extract(rawTx);

                        // Track highest timestamp
                        const txTime = parseInt(tx.timestamp, 10);
                        if (txTime > highestTimestamp) {
                            highestTimestamp = txTime;
                            foundNew = true;
                        }

                        // Confirmation filtering
                        if (tx.confirmations < TRON_MIN_CONFIRMATIONS) continue;

                        // Deduplication: Explicit check before processing
                        const existingTx = await Transaction.findOne({ reference: tx.txId });
                        if (existingTx) continue;

                        // New on-chain deposit detected
                        if (tx.to === wallet.address) {
                            const amount = tx.amount;

                            console.log('');
                            console.log('═══════════════════════════════════════════════');
                            console.log(`💰 New ${token.symbol} Deposit Detected! (via ${provider.name})`);
                            console.log(`   Amount: ${amount} ${token.symbol}`);
                            console.log(`   To: ${wallet.address}`);
                            console.log(`   From: ${tx.from}`);
                            console.log(`   TxHash: ${tx.txId}`);
                            console.log(`   User: ${wallet.user}`);
                            console.log(`   Status: CONFIRMING (need ${CONFIRMATION_THRESHOLDS.TRON} confirmations)`);
                            console.log('═══════════════════════════════════════════════');

                            // Create deposit record with 'confirming' status
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
                                pendingTx.metadata.set('onChainTxHash', tx.txId);
                                pendingTx.metadata.set('from', tx.from);
                                pendingTx.metadata.set('blockTimestamp', String(tx.timestamp));
                                pendingTx.metadata.set('network', 'TRC20');
                                pendingTx.metadata.set('confirmations', String(tx.confirmations));
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
                                    reference: tx.txId,
                                    description: `${token.symbol} deposit from ${tx.from} (confirming)`,
                                    metadata: {
                                        from: tx.from,
                                        blockTimestamp: String(tx.timestamp),
                                        network: 'TRC20',
                                        onChainTxHash: tx.txId,
                                        confirmations: String(tx.confirmations),
                                        requiredConfirmations: String(CONFIRMATION_THRESHOLDS.TRON),
                                        walletId: String(wallet._id),
                                    }
                                });
                                console.log('📝 Created new deposit record with status: confirming');
                            }
                        }
                    }

                    hasMore = provider.hasMore(data);
                    start += 50;

                } catch (fetchErr) {
                    console.error(`[TRON] Provider ${provider.name} failed:`, fetchErr.message);
                    rotateTronProvider();
                    await delay(tronBackoffDelay);
                    break;
                }
            } // end while

            if (foundNew) {
                const updatedTimestamp = new Date(highestTimestamp);
                // Update ALL wallet records for this address to keep timestamps in sync
                await Wallet.updateMany(
                    { address: wallet.address },
                    { $set: { lastCheckedTimestamp: updatedTimestamp } }
                );
            }
        } // end for token
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
        let blockData;
        try {
            const blockResponse = await axiosIPv4.get(
                `${TRON_GRID_API}/wallet/getnowblock`,
                { headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY } }
            );
            blockData = blockResponse.data;
        } catch (err) {
            console.error(`[TRON-CONF] ❌ FAILED: getnowblock failed: ${err.message}`);
            // Force rotation on next main loop if Grid is stuck
            rotateTronProvider();
            return;
        }
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
                let txInfo;
                try {
                    const txInfoResponse = await axiosIPv4.post(
                        `${TRON_GRID_API}/wallet/gettransactioninfobyid`,
                        { value: txHash },
                        {
                            headers: {
                                'Content-Type': 'application/json',
                                'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY
                            }
                        }
                    );
                    txInfo = txInfoResponse.data;
                } catch (err) {
                    console.error(`[TRON-CONF] ❌ FAILED: gettransactioninfobyid failed: ${err.message}`);
                    continue;
                }

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

                        const user = await User.findById(tx.user);
                        if (user && user.webhookUrl) {
                            await queueWebhook(user, 'deposit.confirmed', {
                                txHash: tx.reference,
                                amount: tx.amount,
                                currency: tx.currency,
                                network: 'TRC20'
                            });
                        }
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
                            await sendOperationalAlert('SWEEP_FAILED', {
                                network: 'TRC20',
                                currency: tx.currency,
                                amount: tx.amount,
                                wallet: updatedWallet.address,
                                error: sweepError.message
                            });
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
                // Rate limit delay between transaction checks
                await delay(2000);
            } catch (err) {
                console.error(`[TRON-CONF] Transaction verify failed: ${txHash}`, err.message);
            }
        }
    } catch (error) {
        console.error('Confirmation check error:', error.message);
    } finally {
        setTimeout(checkPendingConfirmations, 60000);
    }
};

/**
 * Sweep TRC20 tokens from user wallet → StableX hot wallet
 * Uses the user's encrypted private key to sign the transaction
 */
export const sweepToHotWallet = async (wallet, token, amount, depositTxHash) => {
    console.log(`[TRON-SWEEP] 🔄 Starting sweep of ${amount} ${token.symbol} from ${wallet.address}...`);

    // 1. Decrypt the user's private key
    const privateKey = decrypt(wallet.encryptedPrivateKey, wallet.iv, wallet.authTag);
    const cleanKey = privateKey.replace('0x', '');
    console.log(`[TRON-SWEEP] 🔑 Key decrypted. Building transfer...`);

    // 1.5 - Fund the wallet with TRX gas to pay for network fee
    if (TREASURY_PRIVATE_KEY && TREASURY_PRIVATE_KEY !== 'REPLACE_WITH_YOUR_MASTER_PRIVATE_KEY') {
        // Use dynamic gas estimation instead of static .env value
        const trxGasAmount = await estimateTronGas(wallet.address, HOT_WALLET, amount);
        console.log(`[TRON-SWEEP] ⛽ Gas estimate: ${trxGasAmount} TRX`);
        const gasFunded = await fundWalletWithTrx(wallet.address, trxGasAmount);
        if (gasFunded) {
            console.log(`[TRON-SWEEP] ⏳ Waiting 15s for gas TRX confirmation...`);
            await new Promise(r => setTimeout(r, 15000));
        } else {
            throw new Error('Failed to fund gas to user wallet.');
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

    const triggerRes = await axiosIPv4.post(
        triggerUrl,
        triggerBody,
        {
            headers: {
                'Content-Type': 'application/json',
                'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY
            }
        }
    );
    const triggerData = triggerRes.data;
    console.log(`[TRON-RES] 📝 TriggerSmartContract Status: ${triggerRes.status}`);

    if (!triggerData.result?.result) {
        throw new Error(`Trigger failed: ${JSON.stringify(triggerData.result)}`);
    }

    console.log(`[TRON-SWEEP] 🖊️ Signing transaction...`);

    // 3. Sign the transaction
    const signedTx = signTronTransaction(triggerData.transaction, cleanKey);

    // 4. Broadcast
    const broadcastRes = await axiosIPv4.post(
        `${TRON_GRID_API}/wallet/broadcasttransaction`,
        signedTx,
        {
            headers: {
                'Content-Type': 'application/json',
                'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY
            }
        }
    );

    const broadcastData = broadcastRes.data;
    console.log(`[TRON-RES] 🚀 Broadcast Status: ${broadcastRes.status} Result=${broadcastData.result}`);

    if (!broadcastData.result) {
        throw new Error(`Broadcast failed: ${broadcastData.message || JSON.stringify(broadcastData)}`);
    }

    const sweepTxHash = triggerData.transaction.txID;
    console.log(`[TRON-SWEEP] ✅ SUCCESS: Swept ${amount} ${token.symbol}! Hash: ${sweepTxHash}`);

    const user = await User.findById(wallet.user);
    if (user && user.webhookUrl) {
        await queueWebhook(user, 'sweep.completed', {
            sweepTxHash,
            depositTxHash,
        });
    }

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

        console.log(`[TRON-FETCH] 🌐 Treasury Funding: ${createUrl}`);
        const createRes = await axiosIPv4.post(
            createUrl,
            createBody,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY
                }
            }
        );

        const createData = createRes.data;
        console.log(`[TRON-RES] 📝 CreateTransaction Status: ${createRes.status}`);

        const txData = createData;

        // Error on tron side, not success
        if (txData.Error) {
            console.error(`[TREASURY] ❌ Failed to create TRX transfer: ${txData.Error}`);
            return false;
        }

        // 3. Sign Transaction
        const signedTx = signTronTransaction(txData, cleanTreasuryKey);

        // 4. Broadcast
        const broadcastResponse = await axiosIPv4.post(
            `${TRON_GRID_API}/wallet/broadcasttransaction`,
            signedTx,
            {
                headers: {
                    "Content-Type": "application/json",
                    "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY
                }
            }
        );

        const broadcastData = broadcastResponse.data;
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
