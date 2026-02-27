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

const ECPair = ECPairFactory(ecc);
const BTC_API = "https://blockstream.info/api";
const POLL_INTERVAL = 60000; // 60 seconds
const CONFIRMATION_THRESHOLD = 3;
const ENABLE_SWEEP = process.env.ENABLE_AUTO_SWEEP === 'true';
const HOT_WALLET = process.env.STABLEX_HOT_WALLET_BTC;

export const startBtcListener = () => {
    console.log("🔗 [BTC] Listener Started: Polling Blockstream for BTC deposits...");
    console.log(`🔄 [BTC] Auto-Sweep: ${ENABLE_SWEEP ? 'ENABLED' : 'DISABLED'} | Hot Wallet: ${HOT_WALLET}`);
    setInterval(checkBtcDeposits, POLL_INTERVAL);
    setInterval(checkConfirmations, POLL_INTERVAL * 2);
};

const checkBtcDeposits = async () => {
    try {
        const wallets = await Wallet.find({ currency: 'BTC' });
        for (const wallet of wallets) {
            const url = `${BTC_API}/address/${wallet.address}/txs`;
            const response = await fetch(url);
            if (!response.ok) continue;

            const transactions = await response.json();
            for (const tx of transactions) {
                const txid = tx.txid;
                const existing = await Transaction.findOne({ reference: txid });
                if (existing) continue;

                // Check outputs for our address
                for (const vout of tx.vout) {
                    if (vout.scriptpubkey_address === wallet.address) {
                        const amount = vout.value / 100_000_000;
                        console.log(`💰 [BTC] Found ${amount} BTC deposit for ${wallet.address}`);

                        await Transaction.create({
                            user: wallet.user,
                            type: 'deposit',
                            status: tx.status.confirmed ? 'confirming' : 'confirming', // always confirming initially
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
        }
    } catch (err) {
        console.error("[BTC] Poll Error:", err.message);
    }
};

const checkConfirmations = async () => {
    try {
        const currentHeightResponse = await fetch(`${BTC_API}/blocks/tip/height`);
        const currentHeight = parseInt(await currentHeightResponse.text());

        const confirmingTxs = await Transaction.find({ status: 'confirming', currency: 'BTC' });

        for (const tx of confirmingTxs) {
            const txHeight = parseInt(tx.metadata.get('blockHeight'));
            if (txHeight === 0) {
                // Try to find block height if it was unconfirmed when detected
                const txStatusRes = await fetch(`${BTC_API}/tx/${tx.reference}/status`);
                const status = await txStatusRes.json();
                if (status.confirmed) {
                    tx.metadata.set('blockHeight', String(status.block_height));
                    await tx.save();
                    continue;
                }
                continue;
            }

            const confirmations = currentHeight - txHeight + 1;
            tx.metadata.set('confirmations', String(confirmations));
            await tx.save();

            if (confirmations >= CONFIRMATION_THRESHOLD) {
                console.log(`✅ [BTC] Tx ${tx.reference} confirmed (${confirmations}/${CONFIRMATION_THRESHOLD})`);
                try {
                    const creditResult = await creditUserWallet(
                        tx.user,
                        'BTC',
                        tx.amount,
                        tx.reference,
                        { confirmedAt: new Date().toISOString(), blockHeight: txHeight }
                    );

                    const user = await User.findById(tx.user);
                    if (user && user.webhookUrl) {
                        await queueWebhook(user, 'deposit.confirmed', {
                            txHash: tx.reference,
                            amount: tx.amount,
                            currency: 'BTC',
                            network: 'BTC'
                        });
                    }

                    if (ENABLE_SWEEP && HOT_WALLET && creditResult.wallet) {
                        await sweepToHotWallet(creditResult.wallet, tx.amount, tx.reference);
                    }
                } catch (err) {
                    console.error(`[BTC] Credit/Sweep failed for ${tx.reference}:`, err.message);
                }
            }
        }
    } catch (err) {
        console.error("[BTC] Confirmation Error:", err.message);
    }
};

export const sweepToHotWallet = async (wallet, amount, depositTxHash) => {
    try {
        console.log(`🔄 [BTC] Sweeping ${amount} BTC from ${wallet.address}...`);
        const privateKey = decrypt(wallet.encryptedPrivateKey, wallet.iv, wallet.authTag);
        const keyPair = ECPair.fromWIF(privateKey, bitcoin.networks.bitcoin);

        // Fetch UTXOs
        const utxoRes = await fetch(`${BTC_API}/address/${wallet.address}/utxo`);
        const utxos = await utxoRes.json();
        if (!utxos || utxos.length === 0) throw new Error("No UTXOs found");

        const psbt = new bitcoin.Psbt({ network: bitcoin.networks.bitcoin });
        let totalInput = 0;

        for (const utxo of utxos) {
            const txHexRes = await fetch(`${BTC_API}/tx/${utxo.txid}/hex`);
            const txHex = await txHexRes.text();

            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                nonWitnessUtxo: Buffer.from(txHex, 'hex'),
            });
            totalInput += utxo.value;
        }

        // Fetch recommended fee rate (sats/vB)
        let feeRate = 10; // Fallback
        try {
            const feeRes = await fetch(`${BTC_API}/fee-estimates`);
            const estimates = await feeRes.json();
            feeRate = estimates["3"] || 10; // Use estimate for 3 blocks
        } catch (e) {
            console.warn(`[BTC] Fee estimation failed, using fallback 10 sats/vB`);
        }

        const txSize = (utxos.length * 148) + 34 + 10; // rough estimate
        const fee = Math.ceil(txSize * feeRate);
        const sweepAmount = totalInput - fee;
        if (sweepAmount <= 546) throw new Error("Balance too low to sweep (dust)");

        psbt.addOutput({ address: HOT_WALLET, value: BigInt(sweepAmount) });

        for (let i = 0; i < utxos.length; i++) {
            psbt.signInput(i, keyPair);
        }
        psbt.finalizeAllInputs();
        const txHex = psbt.extractTransaction().toHex();

        const broadcastRes = await fetch(`${BTC_API}/tx`, { method: 'POST', body: txHex });
        if (!broadcastRes.ok) throw new Error(await broadcastRes.text());

        const sweepTxHash = await broadcastRes.text();
        console.log(`🚀 [BTC] Sweep broadcasted: ${sweepTxHash}`);

        const user = await User.findById(wallet.user);
        if (user && user.webhookUrl) {
            await queueWebhook(user, 'sweep.completed', {
                sweepTxHash,
                depositTxHash,
                amount: sweepAmount / 100_000_000,
                currency: 'BTC',
                network: 'BTC'
            });
        }

        await Transaction.create({
            user: wallet.user,
            type: 'sweep',
            status: 'completed',
            amount: sweepAmount / 100_000_000,
            currency: 'BTC',
            reference: sweepTxHash,
            description: `Auto-sweep BTC to hot wallet`,
            metadata: { sweepTxHash, depositTxHash, network: 'BTC' }
        });
    } catch (err) {
        console.error(`❌ [BTC] Sweep Error:`, err.message);
        await sendOperationalAlert('SWEEP_FAILED', {
            network: 'BTC',
            currency: 'BTC',
            amount,
            wallet: wallet.address,
            error: err.message
        });
        await SweepQueue.create({
            walletId: wallet._id,
            tokenSymbol: 'BTC',
            amount,
            depositTxHash,
            status: 'pending',
            lastError: err.message
        });
    }
};
