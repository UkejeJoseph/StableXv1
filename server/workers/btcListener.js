import Wallet from '../models/walletModel.js';
import User from '../models/userModel.js';
import Transaction from '../models/transactionModel.js';
import { trackApiCall } from '../utils/apiTracker.js';
import { creditUserWallet } from '../services/walletService.js';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import { decrypt } from '../utils/encryption.js';
import SweepQueue from '../models/sweepQueueModel.js';
import { queueWebhook } from '../services/webhookService.js';
import { sendOperationalAlert } from '../utils/alerting.js';
import fetch from 'node-fetch';
import { sweepBTC } from '../services/btcSweepService.js';

const ECPair = ECPairFactory(ecc);

const BTC_MIN_CONFIRMATIONS = 2;

const BTC_PROVIDERS = [
    {
        name: "BlockCypher",
        buildTxUrl: (address) => {
            const token = process.env.BLOCKCYPHER_TOKEN;
            const base = `https://api.blockcypher.com/v1/btc/main/addrs/${address}/full`;
            return token ? `${base}?token=${token}` : base;
        },
        parseTransactions: (data) => data.txs || [],
        extract: (tx) => ({
            txid: tx.hash,
            confirmations: tx.confirmations || 0,
            block_height: tx.block_height || 0,
            vout: tx.outputs.map(o => ({
                scriptpubkey_address: o.addresses[0],
                value: o.value
            }))
        })
    },
    {
        name: "Blockstream",
        buildTxUrl: (address) => `https://blockstream.info/api/address/${address}/txs`,
        parseTransactions: (data) => data || [],
        extract: (tx) => ({
            txid: tx.txid,
            confirmations: tx.status.confirmed ? 20 : 0,
            block_height: tx.status.block_height || 0,
            vout: tx.vout.map(v => ({
                scriptpubkey_address: v.scriptpubkey_address,
                value: v.value
            }))
        })
    }
];

let currentBtcProviderIndex = 0;
let btcBackoffDelay = 2000;
const BTC_BACKOFF_CAP = 30000;

const getBtcProvider = () => BTC_PROVIDERS[currentBtcProviderIndex];

const rotateBtcProvider = () => {
    currentBtcProviderIndex = (currentBtcProviderIndex + 1) % BTC_PROVIDERS.length;
    btcBackoffDelay = Math.min(btcBackoffDelay * 2, BTC_BACKOFF_CAP);
    console.warn(`[BTC] 🔄 FALLBACK: Rotating provider to ${getBtcProvider().name}. Reason: API/Timeout. Backoff: ${btcBackoffDelay}ms`);
};

const fetchWithTimeout = async (url, options = {}, timeout = 30000) => {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), timeout)
        )
    ]);
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const POLL_INTERVAL = 60000; // 60 seconds
const ENABLE_SWEEP = process.env.ENABLE_AUTO_SWEEP === 'true';
const HOT_WALLET = process.env.STABLEX_HOT_WALLET_BTC;

export const startBtcListener = () => {
    console.log("🔗 [BTC] Listener Started: Polling multi-source for BTC deposits...");
    console.log(`🔄 [BTC] Auto-Sweep: ${ENABLE_SWEEP ? 'ENABLED' : 'DISABLED'} | Hot Wallet: ${HOT_WALLET}`);
    checkBtcDeposits();
    checkConfirmations();
};

const checkBtcDeposits = async () => {
    try {
        const wallets = await Wallet.find({
            currency: 'BTC',
            address: { $ne: 'FIAT_ACCOUNT' }
        });

        for (const wallet of wallets) {
            const provider = getBtcProvider();
            const url = provider.buildTxUrl(wallet.address);

            try {
                // Log URL for production debugging
                console.log(`[BTC-FETCH] 🌐 Requesting: ${url}`);
                const res = await fetchWithTimeout(url);
                if (!res.ok) {
                    const errText = await res.text();
                    console.error(`[BTC] provider=${provider.name} HTTP=${res.status}: ${errText}`);
                    rotateBtcProvider();
                    await delay(btcBackoffDelay);
                    continue;
                }
                // Rate limit delay between wallet checks
                await delay(2000);
                trackApiCall(provider.name === 'BlockCypher' ? 'blockcypher' : 'blockstream');

                const data = await res.json();
                const rawTransactions = provider.parseTransactions(data);
                console.log(`[BTC-RES] ✅ OK: Status=${res.status} Items=${rawTransactions.length}`);

                // Reset backoff on success
                btcBackoffDelay = 2000;

                let highestBlock = Number(wallet.lastCheckedBlock || 0);
                let foundNew = false;

                for (const rawTx of rawTransactions) {
                    const tx = provider.extract(rawTx);
                    const txid = tx.txid;

                    // Checkpointing: Skip older blocks
                    const txHeight = Number(tx.block_height || 0);
                    if (txHeight > 0 && txHeight <= Number(wallet.lastCheckedBlock || 0)) {
                        continue;
                    }

                    if (txHeight > highestBlock) {
                        highestBlock = txHeight;
                        foundNew = true;
                    }

                    // Deduplication check
                    const existing = await Transaction.findOne({ reference: txid });
                    if (existing) continue;

                    for (const vout of tx.vout) {
                        if (vout.scriptpubkey_address === wallet.address) {
                            const amount = vout.value / 100_000_000;
                            // Preserving original log format but adding provider
                            console.log(`💰 [BTC] Found ${amount} BTC deposit for ${wallet.address} (via ${provider.name})`);

                            await Transaction.create({
                                user: wallet.user,
                                type: 'deposit',
                                status: 'confirming',
                                amount,
                                currency: 'BTC',
                                reference: txid,
                                metadata: {
                                    network: 'BTC',
                                    onChainTxHash: txid,
                                    blockHeight: String(tx.block_height || 0),
                                    confirmations: String(tx.confirmations || 0),
                                    requiredConfirmations: String(BTC_MIN_CONFIRMATIONS),
                                    walletId: String(wallet._id)
                                }
                            });
                        }
                    }
                }

                if (foundNew) {
                    wallet.lastCheckedBlock = String(highestBlock);
                    await wallet.save();
                }

            } catch (err) {
                console.warn(`[BTC] Provider ${provider.name} failed:`, err.message);
                rotateBtcProvider();
                await delay(btcBackoffDelay);
            }
            await new Promise(r => setTimeout(r, 1000));
        }
    } catch (err) {
        console.error("[BTC] Global Poll Error:", err.message);
    } finally {
        setTimeout(checkBtcDeposits, POLL_INTERVAL);
    }
};

const checkConfirmations = async () => {
    try {
        const provider = getBtcProvider();
        let currentHeight;

        try {
            if (provider.name === "BlockCypher") {
                const res = await fetchWithTimeout(`https://api.blockcypher.com/v1/btc/main`);
                const data = await res.json();
                currentHeight = data.height;
            } else if (provider.name === "Blockstream") {
                const res = await fetchWithTimeout(`https://blockstream.info/api/blocks/tip/height`);
                const text = await res.text();
                currentHeight = parseInt(text);
            }
        } catch (e) {
            console.warn(`[BTC-CONF] ⚠️ FAILOVER: Failed to get height from ${provider.name}: ${e.message}. Rotating...`);
            rotateBtcProvider();
            return;
        }

        if (!currentHeight) return;

        const confirmingTxs = await Transaction.find({ status: 'confirming', currency: 'BTC' });

        for (const tx of confirmingTxs) {
            const txHeight = parseInt(tx.metadata.get('blockHeight'));
            if (txHeight === 0) continue;

            const confirmations = currentHeight - txHeight + 1;
            tx.metadata.set('confirmations', String(confirmations));
            await tx.save();

            if (confirmations >= BTC_MIN_CONFIRMATIONS) {
                console.log(`✅ [BTC] Tx ${tx.reference} confirmed (${confirmations}/${BTC_MIN_CONFIRMATIONS})`);

                try {
                    // CORRECT SERVICE PARAMETERS: (userId, currency, amount, reference, metadata)
                    const creditResult = await creditUserWallet(tx.user, 'BTC', tx.amount, tx.reference, {
                        confirmations,
                        network: 'BTC',
                        txid: tx.reference
                    }, 'crypto');

                    const updatedWallet = await Wallet.findById(tx.metadata.get('walletId'));

                    // Auto-sweep to hot wallet
                    if (ENABLE_SWEEP && HOT_WALLET && updatedWallet) {
                        console.log(`[BTC-SWEEP] 🔄 Initiating sweep from ${updatedWallet.address}...`);
                        try {
                            const txHash = await sweepBTC(updatedWallet.address, tx.user);
                            if (txHash) {
                                console.log('[BTC-LISTENER] ✅ BTC sweep complete. TX:', txHash);
                            } else {
                                console.warn('[BTC-LISTENER] ⚠️ Sweep skipped - insufficient UTXOs or fee coverage');
                            }
                        } catch (sweepError) {
                            console.error(`❌ BTC Sweep failed: ${sweepError.message}`);
                            console.error('[BTC-LISTENER] Will retry via sweepWorker');

                            await SweepQueue.create({
                                walletId: updatedWallet._id,
                                tokenSymbol: 'BTC',
                                amount: tx.amount,
                                depositTxHash: tx.reference,
                                network: 'BTC',
                                status: 'pending',
                                retryCount: 0,
                                nextRetryAt: new Date(Date.now() + 5 * 60 * 1000)
                            });

                            await sendOperationalAlert('BTC_SWEEP_FAILED', {
                                network: 'BTC',
                                amount: tx.amount,
                                wallet: updatedWallet.address,
                                error: sweepError.message
                            });
                        }
                    }

                    const user = await User.findById(tx.user);
                    if (user && user.webhookUrl) {
                        await queueWebhook(user, 'deposit.confirmed', {
                            txHash: tx.reference,
                            amount: tx.amount,
                            currency: 'BTC',
                            network: 'BTC'
                        });
                    }
                    await delay(2000); // Added delay here
                } catch (err) {
                    console.error(`[BTC] Credit failed for ${tx.reference}:`, err.message);
                }
            }
        }
    } catch (err) {
        console.error("[BTC] Confirmation Error:", err.message);
    } finally {
        setTimeout(checkConfirmations, POLL_INTERVAL * 2);
    }
};


