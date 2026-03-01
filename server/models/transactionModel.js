import mongoose from 'mongoose';

const transactionSchema = mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        reference: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        provider: {
            type: String,
            required: true,
            enum: ['korapay', 'interswitch', 'internal', 'crypto', 'paystack'],
            index: true,
        },
        type: {
            type: String,
            required: true,
            enum: [
                'ngn_deposit',
                'ngn_withdrawal',
                'crypto_deposit',
                'crypto_withdrawal',
                'swap',
                'p2p',
                'staking',
            ],
        },
        amount: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            required: true,
            default: 'NGN',
        },
        status: {
            type: String,
            required: true,
            enum: ['pending', 'success', 'failed', 'processing'],
            default: 'pending',
            index: true,
        },
        refunded: {
            type: Boolean,
            default: false,
        },
        refundStatus: {
            type: String,
            enum: ['none', 'pending', 'success', 'failed'],
            default: 'none',
        },
        refundRef: String,
        refundAmount: Number,
        refundCompletedAt: Date,
        completedAt: Date,
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true }
);

// Add compound index for idempotency queries
transactionSchema.index({ reference: 1, provider: 1 }, { unique: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
