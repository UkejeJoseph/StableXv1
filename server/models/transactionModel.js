import mongoose from 'mongoose';

const transactionSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    type: {
        type: String, // deposit, withdrawal, transfer, swap
        required: true,
    },
    status: {
        type: String, // pending, completed, failed
        enum: ['pending', 'confirming', 'completed', 'failed', 'cancelled'],
        required: true,
        default: 'pending',
    },
    amount: {
        type: Number,
        required: true,
        min: [0.000001, 'Transaction amount must be greater than zero']
    },
    profit: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        required: true,
    },
    reference: {
        type: String,
        required: true,
    },
    description: {
        type: String,
    },
    metadata: {
        type: Map,
        of: String, // Store extra info like blockchain tx hash, bank details
    }
}, {
    timestamps: true,
});

transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ reference: 1 });
transactionSchema.index({ type: 1, status: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
