// ──────────────────────────────────────────────────────────────
// SOL Blockchain Listener
// Polls Solana RPC for incoming SOL deposits to user wallets
// Credits internal DB balance on detection
// ──────────────────────────────────────────────────────────────
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import Wallet from '../models/walletModel.js';
import Transaction from '../models/transactionModel.js';
import { creditUserWallet } from '../services/walletService.js';

const SOL_RPC = "https://api.mainnet-beta.solana.com";
const POLL_INTERVAL = 120000; // 120 seconds (longer to avoid rate limits on free RPC)
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 3;

let connection;

const getConnection = () => {
    if (!connection) {
        connection = new Connection(SOL_RPC, {
            commitment: 'confirmed',
            disableRetryOnRateLimit: true, // Don't auto-retry on 429
        });
    }
    return connection;
};

export const startSolListener = () => {
    console.log("🔗 [SOL] Listener Started: Polling Solana RPC for SOL deposits (every 120s, with adaptive backoff)...");
    setTimeout(() => {
        checkSolDeposits().then(() => schedulePoll());
    }, 20000); // Stagger start
};

// Helper: sleep for ms
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Dynamic backoff: start at 120s, double on 429 up to 600s (10 min), recover on success
let currentPollInterval = POLL_INTERVAL;
const MAX_POLL_INTERVAL = 600000; // 10 minutes
let pollTimer = null;

const schedulePoll = () => {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = setTimeout(async () => {
        await checkSolDeposits();
        schedulePoll();
    }, currentPollInterval);
};

const checkSolDeposits = async () => {
    // Skip polling if too many consecutive errors (rate limited)
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        // Exponential backoff: double the interval
        currentPollInterval = Math.min(currentPollInterval * 2, MAX_POLL_INTERVAL);
        console.log(`[SOL] ⏸️  Rate limited (${consecutiveErrors} errors). Backing off to ${Math.round(currentPollInterval / 1000)}s`);
        consecutiveErrors = Math.max(0, consecutiveErrors - 1); // Slowly recover
        return;
    }

    try {
        const wallets = await Wallet.find({ currency: 'SOL' });

        if (wallets.length === 0) return;

        const solConnection = getConnection();

        // Process wallets sequentially with a delay between each
        // to respect Solana free RPC rate limits
        for (let i = 0; i < wallets.length; i++) {
            await checkSolWallet(wallets[i], solConnection);
            // Wait 2 seconds between each wallet to spread out RPC calls
            if (i < wallets.length - 1) {
                await sleep(2000);
            }
        }
        consecutiveErrors = 0; // Reset on full success
        // Gradually recover the poll interval back to baseline
        if (currentPollInterval > POLL_INTERVAL) {
            currentPollInterval = Math.max(POLL_INTERVAL, Math.floor(currentPollInterval * 0.75));
            console.log(`[SOL] ✅ Poll succeeded. Interval recovering to ${Math.round(currentPollInterval / 1000)}s`);
        }
    } catch (error) {
        consecutiveErrors++;
        if (!error.message?.includes('429')) {
            console.error("[SOL] Poll Error:", error.message);
        }
    }
};

const checkSolWallet = async (wallet, solConnection) => {
    try {
        let pubkey;
        try {
            pubkey = new PublicKey(wallet.address);
        } catch {
            // Invalid SOL address — skip
            return;
        }

        // TODO [Priority 1]: Use { until: wallet.lastCheckedBlock } instead of { limit: 5 } to prevent missed SOL deposits. Update wallet.lastCheckedBlock with top signature.
        const signatures = await solConnection.getSignaturesForAddress(pubkey, { limit: 5 });

        if (!signatures || signatures.length === 0) return;

        for (const sigInfo of signatures) {
            // Only confirmed, non-error transactions
            if (sigInfo.err) continue;

            const txSignature = sigInfo.signature;

            // Idempotency check
            const existingTx = await Transaction.findOne({ reference: txSignature });
            if (existingTx) continue;

            // Fetch full transaction details
            const txDetails = await solConnection.getTransaction(txSignature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
            });

            if (!txDetails || !txDetails.meta) continue;

            // Find SOL amount received by our wallet
            const accountKeys = txDetails.transaction.message.staticAccountKeys || txDetails.transaction.message.accountKeys;
            const walletIndex = accountKeys.findIndex(key => key.toBase58() === wallet.address);

            if (walletIndex === -1) continue;

            const preBalance = txDetails.meta.preBalances[walletIndex];
            const postBalance = txDetails.meta.postBalances[walletIndex];
            const balanceDiff = (postBalance - preBalance) / LAMPORTS_PER_SOL;

            // Only incoming (positive) transfers above dust
            if (balanceDiff <= 0.001) continue;

            console.log('');
            console.log('═══════════════════════════════════════════════');
            console.log(`💰 [SOL] New SOL Deposit Detected!`);
            console.log(`   Amount: ${balanceDiff} SOL`);
            console.log(`   Address: ${wallet.address}`);
            console.log(`   TxSignature: ${txSignature}`);
            console.log(`   User: ${wallet.user}`);
            console.log('═══════════════════════════════════════════════');

            // Check for pending deposit
            const pendingTx = await Transaction.findOne({
                user: wallet.user,
                currency: 'SOL',
                status: 'pending',
                type: 'deposit',
            });

            let txMetadata = {
                onChainTxHash: txSignature,
                slot: sigInfo.slot?.toString(),
                network: 'SOL',
                confirmedAt: new Date().toISOString()
            };

            if (pendingTx && pendingTx.metadata) {
                txMetadata = { ...Object.fromEntries(pendingTx.metadata), ...txMetadata };
            }

            try {
                await creditUserWallet(
                    wallet.user,
                    'SOL',
                    balanceDiff,
                    pendingTx ? pendingTx.reference : txSignature,
                    txMetadata
                );
                console.log(`[SOL] ✅ Credited ${balanceDiff} SOL to User ${wallet.user}. Balance updated atomically.`);
            } catch (err) {
                console.error(`[SOL] Atomic credit error for ${txSignature}:`, err.message);
            }
        }
    } catch (error) {
        if (error.message?.includes('429')) {
            // Re-throw 429s to abort the for-loop and trigger backoff
            consecutiveErrors++;
            throw error;
        }
        console.error(`[SOL] Error checking wallet ${wallet.address}:`, error.message);
    }
};
