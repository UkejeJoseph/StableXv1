// ──────────────────────────────────────────────────────────────
// Webhook Controller
// Receives Interswitch payment notifications for all channels
// ──────────────────────────────────────────────────────────────
import { getTransactionStatus, validateForWalletCredit } from '../services/transactionService.js';
import Transaction from '../models/transactionModel.js';
import Wallet from '../models/walletModel.js';
import { creditUserWallet } from '../services/walletService.js';

/**
 * POST /api/interswitch/webhook
 *
 * This endpoint receives payment notifications from Interswitch.
 * Flow:
 *   1. Log the incoming payload
 *   2. Verify the transaction via requery
 *   3. Check for duplicate processing (idempotency via unique reference)
 *   4. Credit wallet ONLY on verified SUCCESS
 *   5. Create transaction ledger record
 */
export async function handleWebhook(req, res) {
    const startTime = Date.now();
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  [WEBHOOK] 🔔 PAYMENT NOTIFICATION RECEIVED ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('[WEBHOOK] Timestamp:', new Date().toISOString());
    console.log('[WEBHOOK] Headers:', JSON.stringify({
        'content-type': req.headers['content-type'],
        'x-interswitch-signature': req.headers['x-interswitch-signature'] || 'N/A',
    }));
    console.log('[WEBHOOK] Body:', JSON.stringify(req.body, null, 2));

    try {
        const {
            transactionRef,
            amount,
            responseCode,
            paymentReference,
            merchantReference,
        } = req.body;

        // Normalize: Interswitch may send different field names
        const txRef = transactionRef || merchantReference || req.body.txn_ref;
        const txAmount = amount || req.body.Amount;

        console.log('[WEBHOOK] Parsed fields:');
        console.log('[WEBHOOK]   transactionRef:', txRef);
        console.log('[WEBHOOK]   amount:', txAmount);
        console.log('[WEBHOOK]   responseCode:', responseCode);
        console.log('[WEBHOOK]   paymentReference:', paymentReference);

        if (!txRef) {
            console.log('[WEBHOOK] ❌ No transactionRef in webhook payload. Ignoring.');
            return res.status(400).json({ message: 'Missing transactionRef' });
        }

        // ── Step 1: Idempotency Check ────────────────────────
        console.log('[WEBHOOK] 🔍 Step 1: Checking for duplicate processing...');

        const existingTx = await Transaction.findOne({ reference: txRef });

        if (existingTx && (existingTx.status === 'completed' || existingTx.status === 'credited')) {
            console.log('[WEBHOOK] ⚠️ Step 1: Transaction already processed! Status:', existingTx.status);
            console.log('[WEBHOOK] Skipping to prevent double-credit.');
            return res.status(200).json({
                message: 'Transaction already processed (idempotent)',
                transactionRef: txRef,
                status: existingTx.status,
            });
        }

        console.log('[WEBHOOK] ✅ Step 1: Not a duplicate. Proceeding...');

        // ── Step 2: Requery Transaction Status ───────────────
        console.log('[WEBHOOK] ⏳ Step 2: Requerying transaction status from Interswitch...');

        let statusResult;
        try {
            statusResult = await getTransactionStatus(txRef, txAmount);
            console.log('[WEBHOOK] ✅ Step 2 Complete. Requery result:');
            console.log('[WEBHOOK]   responseCode:', statusResult.data.responseCode);
            console.log('[WEBHOOK]   success:', statusResult.success);
            console.log('[WEBHOOK]   amount:', statusResult.data.amount);
        } catch (requeryError) {
            console.error('[WEBHOOK] ❌ Step 2 FAILED: Could not requery transaction:', requeryError.message);
            // Save as pending for manual reconciliation
            if (!existingTx) {
                await Transaction.create({
                    user: null, // We don't know the user from webhook alone
                    type: 'deposit',
                    status: 'pending_requery',
                    amount: Number(txAmount) / 100, // Convert kobo to NGN
                    currency: 'NGN',
                    reference: txRef,
                    description: `Webhook received but requery failed: ${requeryError.message}`,
                    metadata: { paymentReference, error: requeryError.message },
                });
            }
            return res.status(200).json({ message: 'Received, requery failed', error: requeryError.message });
        }

        // ── Step 3: Validate & Credit ────────────────────────
        if (statusResult.success) {
            console.log('[WEBHOOK] ✅ Step 3: Transaction SUCCESSFUL (responseCode: 00)');

            const amountInNgn = Number(statusResult.data.amount || txAmount) / 100;
            console.log('[WEBHOOK] 💰 Amount to credit (NGN):', amountInNgn);

            // Find the pending transaction if it exists (created by frontend before checkout)
            if (existingTx) {
                console.log('[WEBHOOK] Found existing pending transaction for user:', existingTx.user);

                // Credit wallet using centralized service
                await creditUserWallet(
                    existingTx.user,
                    'NGN',
                    'user',
                    Number(amountInNgn),
                    txRef,
                    {
                        paymentReference: paymentReference || '',
                        iswResponseCode: statusResult.data.responseCode,
                        creditedAt: new Date().toISOString(),
                        source: 'Webhook',
                        provider: 'interswitch'
                    }
                );

                console.log('[WEBHOOK] ✅ Wallet credited and transaction updated via walletService');

            } else {
                // No existing transaction — create one (webhook arrived before frontend saved)
                console.log('[WEBHOOK] No existing transaction found. Creating new record...');
                await Transaction.create({
                    user: null, // Unknown user from webhook alone
                    type: 'deposit',
                    status: 'completed_unmatched',
                    amount: amountInNgn,
                    currency: 'NGN',
                    reference: txRef,
                    description: `Interswitch webhook deposit (no matching user transaction)`,
                    metadata: {
                        paymentReference: paymentReference || '',
                        iswResponseCode: statusResult.data.responseCode,
                        note: 'Arrived via webhook without a matching frontend transaction. Needs manual matching.',
                    },
                });
                console.log('[WEBHOOK] ⚠️ Created unmatched transaction record for manual review');
            }
        } else {
            console.log('[WEBHOOK] ❌ Step 3: Transaction NOT successful. ResponseCode:', statusResult.data.responseCode);
            console.log('[WEBHOOK] ⏭️ Skipping wallet credit.');

            // Update existing transaction if found
            if (existingTx) {
                existingTx.status = 'failed';
                existingTx.description = `Payment failed: ${statusResult.data.responseCode} - ${statusResult.data.message || ''}`;
                await existingTx.save();
            }
        }

        const elapsed = Date.now() - startTime;
        console.log(`[WEBHOOK] 🏁 Webhook processing complete in ${elapsed}ms`);
        console.log('');

        // Always return 200 to Interswitch
        res.status(200).json({
            message: 'Webhook received and processed',
            transactionRef: txRef,
            status: statusResult.success ? 'CREDITED' : 'NOT_CREDITED',
            responseCode: statusResult.data.responseCode,
        });

    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`[WEBHOOK] 💥 UNHANDLED EXCEPTION after ${elapsed}ms:`, error.message);
        console.error('[WEBHOOK] Stack:', error.stack);
        // Always return 200 to prevent Interswitch from retrying
        res.status(200).json({ message: 'Webhook received, processing error', error: error.message });
    }
}
