import Wallet from '../models/walletModel.js';
import User from '../models/userModel.js';
import Transaction from '../models/transactionModel.js';
import { creditUserWallet } from '../services/walletService.js';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import { decrypt } from '../utils/encryption.js';
import SweepQueue from '../models/sweepQueueModel.js';
import { queueWebhook } from '../services/webhookService.js';
import { sendOperationalAlert } from '../utils/alerting.js';
import fetch from 'node-fetch';

const ECPair = ECPairFactory(ecc);

const BTC_API_ENDPOINTS = [
    'https://blockchain.info',
    'https://blockstream.info/api',
    'https://mempool.space/api',
];

let currentBtcApiIndex = 0;

const rotateBtcApi = () => {
    currentBtcApiIndex = (currentBtcApiIndex + 1) % BTC_API_ENDPOINTS.length;
    console.warn(`[BTC] Rotating to API: ${BTC_API_ENDPOINTS[currentBtcApiIndex]}`);
};

const getBtcApi = () => BTC_API_ENDPOINTS[currentBtcApiIndex];

const POLL_INTERVAL = 60000; // 60 seconds
const CONFIRMATION_THRESHOLD = 3;
const ENABLE_SWEEP = process.env.ENABLE_AUTO_SWEEP === 'true';
const HOT_WALLET = process.env.STABLEX_HOT_WALLET_BTC;

export const startBtcListener = () => {
    console.log("🔗 [BTC] Listener Started: Polling multi-source for BTC deposits...");
    console.log(`🔄 [BTC] Auto-Sweep: ${ENABLE_SWEEP ? 'ENABLED' : 'DISABLED'} | Hot Wallet: ${HOT_WALLET}`);
    setInterval(checkBtcDeposits, POLL_INTERVAL);
    setInterval(checkConfirmations, POLL_INTERVAL * 2);
};

const checkBtcDeposits = async () => {
    try {
        const wallets = await Wallet.find({
            currency: 'BTC',
            address: { $ne: 'FIAT_ACCOUNT' }
        });
        for (const wallet of wallets) {
            try {
                const apiBase = getBtcApi();
                let transactions = [];

                if (apiBase.includes('blockchain.info')) {
                    const res = await fetch(`${apiBase}/rawaddr/${wallet.address}`);
                    if (!res.ok) { rotateBtcApi(); continue; }
                    const data = await res.json();
                    transactions = (data.txs || []).map(tx => ({
                        txid: tx.hash,
                        vout: tx.out.map(o => ({
                            scriptpubkey_address: o.addr,
                            value: o.value
                        })),
                        status: { confirmed: !!tx.block_height, block_height: tx.block_height || 0 }
                    }));
                } else {
                    const res = await fetch(`${apiBase}/address/${wallet.address}/txs`);
                    if (!res.ok) { rotateBtcApi(); continue; }
                    transactions = await res.json();
                }

                for (const tx of transactions) {
                    const txid = tx.txid;
                    const existing = await Transaction.findOne({ reference: txid });
                    if (existing) continue;

                    for (const vout of tx.vout) {
                        if (vout.scriptpubkey_address === wallet.address) {
                            const amount = vout.value / 100_000_000;
                            console.log(`💰 [BTC] Found ${amount} BTC deposit for ${wallet.address}`);

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
                                    blockHeight: String(tx.status.block_height || 0),
                                    confirmations: '0',
                                    requiredConfirmations: String(CONFIRMATION_THRESHOLD),
                                    walletId: String(wallet._id)
                                }
                            });
                        }
                    }
                }
            } catch (err) {
                console.warn(`[BTC] API Error (${getBtcApi()}):`, err.message);
                rotateBtcApi();
            }
            await new Promise(r => setTimeout(r, 1000));
        }
    } catch (err) {
        console.error("[BTC] Global Poll Error:", err.message);
    }
};

const checkConfirmations = async () => {
    try {
        const apiBase = getBtcApi();
        let currentHeight;

        try {
            if (apiBase.includes('blockchain.info')) {
                const res = await fetch(`${apiBase}/q/getblockcount`);
                currentHeight = parseInt(await res.text());
            } else {
                const res = await fetch(`${apiBase}/blocks/tip/height`);
                currentHeight = parseInt(await res.text());
            }
        } catch (e) {
            rotateBtcApi();
            return;
        }

        const confirmingTxs = await Transaction.find({ status: 'confirming', currency: 'BTC' });

        for (const tx of confirmingTxs) {
            const txHeight = parseInt(tx.metadata.get('blockHeight'));
            if (txHeight === 0) {
                try {
                    if (apiBase.includes('blockchain.info')) {
                        const res = await fetch(`${apiBase}/rawtx/${tx.reference}`);
                        const data = await res.json();
                        if (data.block_height) {
                            tx.metadata.set('blockHeight', String(data.block_height));
                            await tx.save();
                        }
                    } else {
                        const res = await fetch(`${apiBase}/tx/${tx.reference}/status`);
                        const status = await res.json();
                        if (status.confirmed) {
                            tx.metadata.set('blockHeight', String(status.block_height));
                            await tx.save();
                        }
                    }
                } catch (e) { }
                continue;
            }

            const confirmations = currentHeight - txHeight + 1;
            tx.metadata.set('confirmations', String(confirmations));
            await tx.save();

            if (confirmations >= CONFIRMATION_THRESHOLD) {
                console.log(`✅ [BTC] Tx ${tx.reference} confirmed (${confirmations}/${CONFIRMATION_THRESHOLD})`);
                tx.status = 'completed';
                await tx.save();
                await creditUserWallet(tx.user, tx.amount, 'BTC');
            }
        }
    } catch (err) {
        console.error("[BTC] Confirmation Error:", err.message);
    }
};
