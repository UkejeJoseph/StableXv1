import Transaction from '../models/transactionModel.js';
import { getTransactionStatus } from '../services/transactionService.js';
import { creditUserWallet } from '../services/walletService.js';

/**
 * INTERSWITCH REQUERY WORKER
 * Periodically syncs 'processing' transactions with Interswitch API.
 * Ensures users aren't left in limbo after 5xx errors or network drops.
 */

const REQUERY_INTERVAL = 5 * 60 * 1000; // 5 minutes
const STALE_THRESHOLD = 10 * 60 * 1000; // 10 minutes

export const startInterswitchRequeryWorker = () => {
    console.log('\n🔄 [WORKER:ISW-SYNC] Started: Monitoring stale Interswitch transactions...');

    // Initial run then repeat
    setTimeout(syncProcessingTransactions, 30000);
    setInterval(syncProcessingTransactions, REQUERY_INTERVAL);
};

const syncProcessingTransactions = async () => {
    console.log(`\n[WORKER:ISW-SYNC] 🔍 Polling for 'processing' Interswitch transactions older than 10 mins...`);

    try {
        const thresholdDate = new Date(Date.now() - STALE_THRESHOLD);

        const staleTxns = await Transaction.find({
            provider: 'interswitch',
            status: 'processing',
            createdAt: { $lte: thresholdDate }
        });

        if (staleTxns.length === 0) {
            console.log('[WORKER:ISW-SYNC] ✨ No stale transactions found.');
            return;
        }

        console.log(`[WORKER:ISW-SYNC] ⚠️ Found ${staleTxns.length} transactions needing sync.`);

        for (const txn of staleTxns) {
            try {
                console.log(`[WORKER:ISW-SYNC] 🔄 Syncing Ref: ${txn.reference}...`);

                // 1. Requery Interswitch API
                // Amount must be in kobo for ISW status check
                const amountInKobo = Math.round(txn.amount * 100);
                const result = await getTransactionStatus(txn.reference, amountInKobo);

                console.log(`[WORKER:ISW-SYNC] ISW Response for ${txn.reference}: Code=${result.data?.responseCode}, Success=${result.success}`);

                if (result.success && result.data?.responseCode === '00') {
                    // ✅ Transaction actually succeeded at the bank
                    console.log(`[WORKER:ISW-SYNC] ✅ Ref: ${txn.reference} confirmed SUCCESS. Finalizing...`);
                    txn.status = 'completed';
                    txn.metadata = { ...txn.metadata, syncedAt: new Date() };
                    await txn.save();
                }
                else if (result.data?.responseCode === '90' || result.data?.responseCode === '09') {
                    // ⏳ Transaction still pending at bank
                    console.log(`[WORKER:ISW-SYNC] ⏳ Ref: ${txn.reference} is still pending at provider. Keeping as 'processing'.`);
                }
                else {
                    // ❌ Transaction failed at bank - REFUND USER
                    console.log(`[WORKER:ISW-SYNC] ❌ Ref: ${txn.reference} confirmed FAILURE. Initiating atomic refund...`);

                    await creditUserWallet(
                        txn.userId || txn.user,
                        txn.currency,
                        txn.amount,
                        `refund_${txn.reference}`,
                        {
                            type: 'withdrawal_refund',
                            originalRef: txn.reference,
                            reason: `ISW Sync Failed: ${result.data?.responseDescription || 'Unknown Error'}`
                        },
                        'interswitch'
                    );

                    txn.status = 'failed';
                    txn.description = `Sync Failed: ${result.data?.responseDescription || 'Transfer failed'}`;
                    await txn.save();
                }
            } catch (txnErr) {
                console.error(`[WORKER:ISW-SYNC] ❌ Error processing transaction ${txn.reference}:`, txnErr.message);
            }
        }
    } catch (err) {
        console.error('[WORKER:ISW-SYNC] 💥 Global Sync Error:', err.message);
    }
};
