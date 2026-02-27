import SweepQueue from '../models/sweepQueueModel.js';
import Wallet from '../models/walletModel.js';
import { sweepToHotWallet, TRC20_TOKENS } from './blockchainListener.js';

const POLL_INTERVAL = 60000; // 1 minute
const MAX_RETRIES = 5;

export const startSweepWorker = () => {
    console.log("🧹 [SWEEP WORKER] Started: Polling sweep queue for failed TRON auto-sweeps...");
    // Initial delay then poll every minute
    setTimeout(processSweepQueue, 15000);
    setInterval(processSweepQueue, POLL_INTERVAL);
};

const processSweepQueue = async () => {
    try {
        const now = new Date();

        // Find all sweeps that are pending/processing and ready to retry
        const pendingSweeps = await SweepQueue.find({
            status: { $in: ['pending', 'processing'] },
            nextRetryAt: { $lte: now },
            retryCount: { $lt: MAX_RETRIES }
        });

        if (pendingSweeps.length === 0) return;

        console.log(`\n🧹 [SWEEP WORKER] Found ${pendingSweeps.length} pending sweeps to retry...`);

        for (const sweep of pendingSweeps) {
            // Mark as processing to prevent concurrency overlap
            sweep.status = 'processing';
            await sweep.save();

            try {
                const wallet = await Wallet.findById(sweep.walletId);

                if (!wallet) {
                    throw new Error('Wallet not found in database for sweep');
                }

                const token = TRC20_TOKENS.find(t => t.symbol === sweep.tokenSymbol);

                if (!token) {
                    throw new Error(`Token configuration not found for ${sweep.tokenSymbol}`);
                }

                console.log(`[SWEEP WORKER] Retrying sweep for ${sweep.amount} ${token.symbol} from ${wallet.address} (Attempt ${sweep.retryCount + 1}/${MAX_RETRIES})`);

                // Execute sweep
                const sweepTxHash = await sweepToHotWallet(wallet, token, sweep.amount, sweep.depositTxHash);

                // Success
                sweep.status = 'completed';
                sweep.lastError = 'Success: ' + sweepTxHash;
                await sweep.save();

                console.log(`[SWEEP WORKER] ✅ Sweep completed successfully on retry! Tx: ${sweepTxHash}`);

            } catch (err) {
                console.error(`[SWEEP WORKER] ❌ Sweep retry ${sweep.retryCount + 1}/${MAX_RETRIES} failed: ${err.message}`);

                sweep.retryCount += 1;

                if (sweep.retryCount >= MAX_RETRIES) {
                    sweep.status = 'failed';
                    console.error(`[SWEEP WORKER] 🚫 Sweep permanently failed after ${MAX_RETRIES} attempts. manual intervention required.`);
                } else {
                    sweep.status = 'pending';
                    // Exponential backoff multiplier: 5m, 15m, 45m, 135m -> helps save energy checking dead wallets constantly
                    const backoffMins = 5 * Math.pow(3, sweep.retryCount - 1);
                    sweep.nextRetryAt = new Date(Date.now() + backoffMins * 60 * 1000);
                    console.log(`[SWEEP WORKER] ⏳ Queuing next retry for ${backoffMins} minutes from now.`);
                }

                sweep.lastError = err.message;
                await sweep.save();
            }
        }
    } catch (globalErr) {
        console.error(`[SWEEP WORKER] Global polling error: ${globalErr.message}`);
    }
};
