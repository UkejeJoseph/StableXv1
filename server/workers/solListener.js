import { Connection, PublicKey, LAMPORTS_PER_SOL, Keypair, SystemProgram, Transaction as SolTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import Wallet from '../models/walletModel.js';
import User from '../models/userModel.js';
import Transaction from '../models/transactionModel.js';
import { creditUserWallet } from '../services/walletService.js';
import { decrypt } from '../utils/encryption.js';
import SweepQueue from '../models/sweepQueueModel.js';
import { queueWebhook } from '../services/webhookService.js';
import { sendOperationalAlert } from '../utils/alerting.js';
import { trackApiCall } from '../utils/apiTracker.js';

const SOL_RPC_FALLBACKS = [
    process.env.SOL_RPC_URL,
    "https://solana-rpc.publicnode.com",
    "https://api.mainnet-beta.solana.com",
].filter(Boolean);

let currentRpcIndex = 0;
const POLL_INTERVAL = 15000; // 15 seconds
const HOT_WALLET = process.env.STABLEX_HOT_WALLET_SOL;
const ENABLE_SWEEP = process.env.ENABLE_AUTO_SWEEP === 'true';

let connection;
const getConnection = (forceRotate = false) => {
    if (forceRotate) {
        currentRpcIndex = (currentRpcIndex + 1) % SOL_RPC_FALLBACKS.length;
        connection = null;
        console.warn(`[SOL] 🔄 FALLBACK: Rotating to RPC: ${SOL_RPC_FALLBACKS[currentRpcIndex]}. Reason: RPC Error/Manual trigger.`);
    }
    if (!connection) {
        connection = new Connection(SOL_RPC_FALLBACKS[currentRpcIndex], { commitment: 'confirmed' });
    }
    return connection;
};

export const startSolListener = () => {
    console.log(`🔗 [SOL] Listener Started: Polling ${SOL_RPC_FALLBACKS[currentRpcIndex]} for SOL deposits...`);
    console.log(`🔄 [SOL] Auto-Sweep: ${ENABLE_SWEEP ? 'ENABLED' : 'DISABLED'} | Hot Wallet: ${HOT_WALLET}`);

    // Switch to recursive polling for better stability
    checkSignaturesRecursive();
    setInterval(checkConfirmations, POLL_INTERVAL);
};

const checkSignaturesRecursive = async () => {
    await pollSignatures();
    setTimeout(checkSignaturesRecursive, POLL_INTERVAL);
};

const pollSignatures = async () => {
    try {
        const wallets = await Wallet.find({
            currency: 'SOL',
            address: { $ne: 'FIAT_ACCOUNT' }
        });

        // Deduplicate wallets by address to prevent double-scanning
        const uniqueWallets = [];
        const seenAddresses = new Set();
        for (const w of wallets) {
            if (!seenAddresses.has(w.address)) {
                seenAddresses.add(w.address);
                uniqueWallets.push(w);
            }
        }

        for (const wallet of uniqueWallets) {
            let success = false;
            let attempts = 0;

            while (!success && attempts < SOL_RPC_FALLBACKS.length) {
                try {
                    const solConnection = getConnection();
                    const pubkey = new PublicKey(wallet.address);
                    console.log(`[SOL-FETCH] 🌐 Fetching Signatures for: ${wallet.address}`);
                    const sigs = await solConnection.getSignaturesForAddress(pubkey, { limit: 25 });
                    console.log(`[SOL-RES] ✅ OK: Fetched ${sigs.length} signatures for ${wallet.address}`);
                    trackApiCall('helius');
                    success = true;

                    for (const sigInfo of sigs) {
                        if (sigInfo.err) continue;
                        const existing = await Transaction.findOne({ reference: sigInfo.signature });
                        if (existing) continue;

                        console.log(`💰 [SOL] Found potential deposit: ${sigInfo.signature} for ${wallet.address}`);

                        await Transaction.create({
                            user: wallet.user,
                            type: 'deposit',
                            status: 'confirming',
                            amount: 0, // Will be filled on confirmation
                            currency: 'SOL',
                            reference: sigInfo.signature,
                            metadata: {
                                network: 'SOL',
                                onChainTxHash: sigInfo.signature,
                                slot: String(sigInfo.slot),
                                confirmations: '0',
                                requiredConfirmations: '1',
                                walletId: String(wallet._id)
                            }
                        });
                    }
                } catch (err) {
                    if (err.message?.includes('429') || err.message?.includes('Too Many Requests') || err.message?.includes('fetch failed')) {
                        console.warn(`[SOL] ⚠️ RPC LIMIT: ${err.message} on ${SOL_RPC_FALLBACKS[currentRpcIndex]}. Rotating...`);
                        getConnection(true); // Force rotate
                        attempts++;
                        await new Promise(r => setTimeout(r, 5000)); // Wait before retry
                    } else {
                        throw err;
                    }
                }
            }
            // Sequential delay to avoid RPC rate limits
            await new Promise(r => setTimeout(r, 500));
        }
    } catch (err) {
        console.error("[SOL] Signature Poll Error:", err.message);
    }
};

const checkConfirmations = async () => {
    try {
        const solConnection = getConnection();
        const confirmingTxs = await Transaction.find({ status: 'confirming', currency: 'SOL' });

        for (const tx of confirmingTxs) {
            try {
                const txDetails = await solConnection.getTransaction(tx.reference, {
                    commitment: 'confirmed',
                    maxSupportedTransactionVersion: 0,
                });

                if (!txDetails || !txDetails.meta) continue;

                const wallet = await Wallet.findById(tx.metadata.get('walletId'));
                if (!wallet) continue;

                const accountKeys = txDetails.transaction.message.staticAccountKeys || txDetails.transaction.message.accountKeys;
                const walletIndex = accountKeys.findIndex(key => key.toBase58() === wallet.address);
                if (walletIndex === -1) continue;

                const preBalance = txDetails.meta.preBalances[walletIndex];
                const postBalance = txDetails.meta.postBalances[walletIndex];
                const amount = (postBalance - preBalance) / LAMPORTS_PER_SOL;

                if (amount <= 0.001) {
                    tx.status = 'failed';
                    tx.description = 'Ignored: Negative or dust amount';
                    await tx.save();
                    continue;
                }

                console.log(`✅ [SOL] Tx ${tx.reference} confirmed. Amount: ${amount} SOL`);
                tx.amount = amount;
                tx.status = 'completed'; // Mark as completed here
                await tx.save();

                // Note: SOL listener uses signatures so it doesn't have a 'lastCheckedBlock' 
                // but if it did, we would sync it here across all wallet records for the address.

                const creditResult = await creditUserWallet(
                    tx.user,
                    'SOL',
                    amount,
                    tx.reference,
                    { confirmedAt: new Date().toISOString(), slot: tx.metadata.get('slot') },
                    'crypto'
                );

                const user = await User.findById(tx.user);
                if (user && user.webhookUrl) {
                    await queueWebhook(user, 'deposit.confirmed', {
                        txHash: tx.reference,
                        amount,
                        currency: 'SOL',
                        network: 'SOL'
                    });
                }

                if (ENABLE_SWEEP && HOT_WALLET && creditResult.wallet) {
                    await sweepToHotWallet(creditResult.wallet, amount, tx.reference);
                }
            } catch (err) {
                if (err.message?.includes('429') || err.message?.includes('Too Many Requests') || err.message?.includes('fetch failed')) {
                    console.warn(`[SOL-CONF] ⚠️ RPC LIMIT: ${err.message} during confirmation check. Rotating...`);
                    getConnection(true);
                } else {
                    console.error(`[SOL-CONF] ❌ ERROR: ${err.message} for tx ${tx.reference}`);
                }
            }
        }
    } catch (err) {
        console.error("[SOL] Confirmation Error:", err.message);
    }
};

export const sweepToHotWallet = async (wallet, amount, depositTxHash) => {
    try {
        console.log(`[SOL-SWEEP] 🔄 Sweeping ${amount} SOL from ${wallet.address}...`);
        const solConnection = getConnection();
        const privateKey = decrypt(wallet.encryptedPrivateKey, wallet.iv, wallet.authTag);

        let signer;
        if (privateKey.includes('[')) {
            signer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(privateKey)));
        } else {
            signer = Keypair.fromSecretKey(bs58.decode(privateKey));
        }

        const balance = await solConnection.getBalance(signer.publicKey);
        const fee = 5000; // Transaction fee in lamports
        const RENT_EXEMPTION = 890880; // Minimum lamports to keep account alive
        const sweepAmount = balance - fee - RENT_EXEMPTION;

        if (sweepAmount <= 0) {
            throw new Error(
                `Balance too low to sweep safely. ` +
                `Balance: ${balance}, ` +
                `Required minimum: ${fee + RENT_EXEMPTION} lamports`
            );
        }

        const transaction = new SolTransaction().add(
            SystemProgram.transfer({
                fromPubkey: signer.publicKey,
                toPubkey: new PublicKey(HOT_WALLET),
                lamports: sweepAmount,
            })
        );

        const signature = await solConnection.sendTransaction(transaction, [signer]);
        console.log(`[SOL-SWEEP] 🚀 SUCCESS: Broadcasted sweep ${signature}`);

        const user = await User.findById(wallet.user);
        if (user && user.webhookUrl) {
            await queueWebhook(user, 'sweep.completed', {
                sweepTxHash: signature,
                depositTxHash,
                amount: sweepAmount / LAMPORTS_PER_SOL,
                currency: 'SOL',
                network: 'SOL'
            });
        }

        await Transaction.create({
            user: wallet.user,
            type: 'sweep',
            status: 'completed',
            amount: sweepAmount / LAMPORTS_PER_SOL,
            currency: 'SOL',
            reference: signature,
            description: `Auto-sweep SOL to hot wallet`,
            metadata: { sweepTxHash: signature, depositTxHash, network: 'SOL' }
        });
    } catch (err) {
        if (err.message?.includes('429') || err.message?.includes('Too Many Requests')) {
            console.warn(`[SOL-SWEEP] ⚠️ RPC LIMIT during sweep. Rotating...`);
            getConnection(true);
        }
        console.error(`❌ [SOL] Sweep Error:`, err.message);
        await sendOperationalAlert('SWEEP_FAILED', {
            network: 'SOL',
            currency: 'SOL',
            amount,
            wallet: wallet.address,
            error: err.message
        });
        await SweepQueue.create({
            walletId: wallet._id,
            tokenSymbol: 'SOL',
            amount,
            depositTxHash,
            status: 'pending',
            lastError: err.message
        });
    }
};
