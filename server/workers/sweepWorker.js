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
            // Mark as processing atomically to prevent concurrency overlap across multiple workers
            const lockedSweep = await SweepQueue.findOneAndUpdate(
                { _id: sweep._id, status: { $in: ['pending', 'failed'] } },
                { $set: { status: 'processing' } },
                { new: true }
            );

            if (!lockedSweep) continue;

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
                lockedSweep.status = 'completed';
                lockedSweep.lastError = 'Success: ' + sweepTxHash;
                await lockedSweep.save();

                console.log(`[SWEEP WORKER] ✅ Sweep completed successfully on retry! Tx: ${sweepTxHash}`);

            } catch (err) {
                console.error(`[SWEEP WORKER] ❌ Sweep retry ${lockedSweep.retryCount + 1}/${MAX_RETRIES} failed: ${err.message}`);

                lockedSweep.retryCount += 1;

                if (lockedSweep.retryCount >= MAX_RETRIES) {
                    lockedSweep.status = 'failed';
                    console.error(`[SWEEP WORKER] 🚫 Sweep permanently failed after ${MAX_RETRIES} attempts. manual intervention required.`);
                } else {
                    lockedSweep.status = 'pending';
                    // Exponential backoff multiplier: 5m, 15m, 45m, 135m -> helps save energy checking dead wallets constantly
                    const backoffMins = 5 * Math.pow(3, lockedSweep.retryCount - 1);
                    lockedSweep.nextRetryAt = new Date(Date.now() + backoffMins * 60 * 1000);
                    console.log(`[SWEEP WORKER] ⏳ Queuing next retry for ${backoffMins} minutes from now.`);
                }

                lockedSweep.lastError = err.message;
                await lockedSweep.save();
            }
        }
    } catch (globalErr) {
        console.error(`[SWEEP WORKER] Global polling error: ${globalErr.message}`);
    }
};
