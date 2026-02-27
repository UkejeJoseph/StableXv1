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

const SOL_RPC = process.env.SOL_RPC_URL || "https://api.mainnet-beta.solana.com";
const POLL_INTERVAL = 60000;
const HOT_WALLET = process.env.STABLEX_HOT_WALLET_SOL;
const ENABLE_SWEEP = process.env.ENABLE_AUTO_SWEEP === 'true';

let connection;
const getConnection = () => {
    if (!connection) connection = new Connection(SOL_RPC, { commitment: 'confirmed' });
    return connection;
};

export const startSolListener = () => {
    console.log(`🔗 [SOL] Listener Started: Polling ${SOL_RPC} for SOL deposits...`);
    console.log(`🔄 [SOL] Auto-Sweep: ${ENABLE_SWEEP ? 'ENABLED' : 'DISABLED'} | Hot Wallet: ${HOT_WALLET}`);
    setInterval(pollSignatures, POLL_INTERVAL);
    setInterval(checkConfirmations, POLL_INTERVAL);
};

const pollSignatures = async () => {
    try {
        const solConnection = getConnection();
        const wallets = await Wallet.find({ currency: 'SOL' });

        for (const wallet of wallets) {
            const pubkey = new PublicKey(wallet.address);
            const signatures = await solConnection.getSignaturesForAddress(pubkey, { limit: 5 });

            for (const sigInfo of signatures) {
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
                // Not a deposit or too small
                tx.status = 'failed';
                tx.description = 'Ignored: Negative or dust amount';
                await tx.save();
                continue;
            }

            console.log(`✅ [SOL] Tx ${tx.reference} confirmed. Amount: ${amount} SOL`);
            tx.amount = amount;
            await tx.save();

            try {
                const creditResult = await creditUserWallet(
                    tx.user,
                    'SOL',
                    amount,
                    tx.reference,
                    { confirmedAt: new Date().toISOString(), slot: tx.metadata.get('slot') }
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
                console.error(`[SOL] Credit/Sweep failed for ${tx.reference}:`, err.message);
            }
        }
    } catch (err) {
        console.error("[SOL] Confirmation Error:", err.message);
    }
};

export const sweepToHotWallet = async (wallet, amount, depositTxHash) => {
    try {
        console.log(`🔄 [SOL] Sweeping ${amount} SOL from ${wallet.address}...`);
        const solConnection = getConnection();
        const privateKey = decrypt(wallet.encryptedPrivateKey, wallet.iv, wallet.authTag);

        let signer;
        if (privateKey.includes('[')) {
            signer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(privateKey)));
        } else {
            signer = Keypair.fromSecretKey(bs58.decode(privateKey));
        }

        const balance = await solConnection.getBalance(signer.publicKey);
        const fee = 5000; // Expected fee in lamports
        const sweepAmount = balance - fee;

        if (sweepAmount <= 0) throw new Error("Balance too low to cover fee");

        const transaction = new SolTransaction().add(
            SystemProgram.transfer({
                fromPubkey: signer.publicKey,
                toPubkey: new PublicKey(HOT_WALLET),
                lamports: sweepAmount,
            })
        );

        const signature = await solConnection.sendTransaction(transaction, [signer]);
        console.log(`🚀 [SOL] Sweep broadcasted: ${signature}`);

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
