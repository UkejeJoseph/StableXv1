import express from 'express';
import User from '../../models/userModel.js';
import Transaction from '../../models/transactionModel.js';
import korapayService from '../../services/korapayService.js';
import { creditUserWallet } from '../../services/walletService.js';

const router = express.Router();

// ════════════════════════════════════════
// MAIN WEBHOOK ENDPOINT
// POST /webhook/korapay
// ════════════════════════════════════════

router.post(
    '/korapay',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
        console.log('[KORAPAY-WEBHOOK] ══════════════════════════════════════');
        console.log('[KORAPAY-WEBHOOK] 📨 New webhook received at:', new Date().toISOString());

        // 🔴 RULE 1: Respond 200 IMMEDIATELY
        res.status(200).json({ received: true });
        console.log('[KORAPAY-WEBHOOK] ✅ 200 response sent immediately');

        try {
            const rawBody = req.body;
            let payload;

            try {
                payload = JSON.parse(rawBody.toString());
            } catch (parseErr) {
                console.error('[KORAPAY-WEBHOOK] ❌ Failed to parse body:', parseErr.message);
                return;
            }

            const { event, data } = payload;
            if (!event || !data) {
                console.warn('[KORAPAY-WEBHOOK] ⚠️ Missing event or data - ignoring');
                return;
            }

            console.log(`[KORAPAY-WEBHOOK] Event: ${event}, Ref: ${data.reference}`);

            // ✅ FIX: Korapay signature is based ONLY on the 'data' object
            const signature = req.headers['x-korapay-signature'];
            const isValid = korapayService.verifyWebhookSignature(data, signature);

            if (!isValid) {
                console.error('[KORAPAY-WEBHOOK] ❌ SIGNATURE MISMATCH');
                return;
            }

            console.log('[KORAPAY-WEBHOOK] ✅ Signature verified');

            // Route to correct handler
            switch (event) {
                case 'charge.success':
                    await handleChargeSuccess(data);
                    break;
                case 'charge.failed':
                    await handleChargeFailed(data);
                    break;
                case 'transfer.success':
                    await handleTransferSuccess(data);
                    break;
                case 'transfer.failed':
                    await handleTransferFailed(data);
                    break;
                case 'refund.success':
                    await handleRefundSuccess(data);
                    break;
                case 'refund.failed':
                    await handleRefundFailed(data);
                    break;
                default:
                    console.warn('[KORAPAY-WEBHOOK] ⚠️ Unhandled event type:', event);
            }
        } catch (err) {
            console.error('[KORAPAY-WEBHOOK] ❌ FATAL ERROR:', err.message);
        }
    }
);

async function handleChargeSuccess(data) {
    const { reference, amount, currency } = data;
    console.log('[KORAPAY-DEPOSIT] Processing charge.success');

    // 🔴 RULE 3: Idempotency (FIX 10)
    // ✅ FIX 10: Only block if already SUCCESS
    const existing = await Transaction.findOne({
        reference,
        provider: 'korapay',
        status: 'success'
    });

    if (existing) {
        console.warn('[KORAPAY-DEPOSIT] ⚠️ DUPLICATE - already processed ref:', reference);
        return;
    }

    // 🔴 RULE 4: Requery KoraPay to confirm
    console.log('[KORAPAY-DEPOSIT] Requerying KoraPay for ref:', reference);
    let verifyData;
    try {
        verifyData = await korapayService.queryCharge(reference);
    } catch (err) {
        console.error('[KORAPAY-DEPOSIT] ❌ Requery failed:', err.message);
        return;
    }

    if (!verifyData || verifyData.status !== 'success') {
        console.error('[KORAPAY-DEPOSIT] ❌ Requery did not confirm success');
        return;
    }

    const confirmedAmount = verifyData.amount;
    let userId = null;

    // Case 1: VBA payment
    if (data.virtual_bank_account_details) {
        const vbaRef = data.virtual_bank_account_details?.virtual_bank_account?.account_reference;
        if (vbaRef?.startsWith('VBA-')) {
            userId = vbaRef.replace('VBA-', '');
        } else {
            const user = await User.findOne({ 'vba.account_reference': vbaRef });
            userId = user?._id;
        }
    } else {
        // Case 2: Checkout or dynamic bank transfer
        const pendingTxn = await Transaction.findOne({
            reference,
            provider: 'korapay',
            status: 'pending',
        });
        userId = pendingTxn?.userId || pendingTxn?.user;
    }

    if (!userId) {
        console.error('[KORAPAY-DEPOSIT] ❌ Could not find userId for reference:', reference);
        return;
    }

    // ─── Credit NGN wallet via unified service ───
    await creditUserWallet(
        userId,
        'NGN',
        'user', // Explicitly provide type to satisfy polymorphic signature
        Number(confirmedAmount), // Cast string string from JSON to number
        reference,
        { ...data, method: 'webhook_charge_success', provider: 'korapay' }
    );

    console.log(`[KORAPAY-DEPOSIT] ✅ Processed charge.success for ref: ${reference}`);
}

async function handleChargeFailed(data) {
    const { reference } = data;
    await Transaction.findOneAndUpdate(
        { reference, provider: 'korapay' },
        { status: 'failed', updatedAt: new Date() }
    );
    console.log('[KORAPAY-CHARGE-FAILED] ✅ Marked failed in DB');
}

async function handleTransferSuccess(data) {
    const { reference } = data;
    await Transaction.findOneAndUpdate(
        { reference, provider: 'korapay', type: 'ngn_withdrawal' },
        { status: 'success', updatedAt: new Date() }
    );
    console.log('[KORAPAY-PAYOUT-SUCCESS] ✅ Withdrawal marked complete');
}

async function handleTransferFailed(data) {
    const { reference } = data;
    console.log('[KORAPAY-PAYOUT-FAILED] Requerying payout status...');

    // 🔴 RULE 5: Requery before refunding
    let verifyData;
    try {
        const res = await fetch(`https://api.korapay.com/merchant/api/v1/payouts/${reference}`, {
            headers: { Authorization: `Bearer ${process.env.KORAPAY_SECRET_KEY}` },
        });
        verifyData = await res.json();
    } catch (err) {
        console.error('[KORAPAY-PAYOUT-FAILED] ❌ Requery failed:', err.message);
        return;
    }

    if (verifyData?.data?.status !== 'failed') {
        console.warn('[KORAPAY-PAYOUT-FAILED] ⚠️ Not confirmed failed, skipping refund');
        return;
    }

    const txn = await Transaction.findOne({
        reference,
        provider: 'korapay',
        status: { $in: ['pending', 'processing'] }
    });

    if (!txn) return;

    // ✅ Refund user atomically via unified walletService
    await creditUserWallet(
        txn.userId || txn.user,
        'NGN',
        'user',
        Number(txn.amount),
        `refund_${reference}`,
        { type: 'withdrawal_refund', originalRef: reference, reason: 'KoraPay Transfer Failed', provider: 'korapay' }
    );

    await Transaction.findByIdAndUpdate(txn._id, { status: 'failed', refunded: true });

    console.log('[KORAPAY-PAYOUT-FAILED] ✅ Refunded user and marked failed');
}

async function handleRefundSuccess(data) {
    const { reference, payment_reference, amount } = data;
    await Transaction.findOneAndUpdate(
        { reference: payment_reference, provider: 'korapay' },
        { refundStatus: 'success', metadata: { ...data, refundRef: reference } }
    );
}

async function handleRefundFailed(data) {
    const { payment_reference } = data;
    await Transaction.findOneAndUpdate(
        { reference: payment_reference, provider: 'korapay' },
        { refundStatus: 'failed' }
    );
}

export default router;
