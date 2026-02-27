import mongoose from 'mongoose';

const sweepQueueSchema = mongoose.Schema({
    walletId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Wallet',
    },
    tokenSymbol: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    depositTxHash: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
    },
    retryCount: {
        type: Number,
        default: 0,
    },
    nextRetryAt: {
        type: Date,
        default: Date.now,
    },
    lastError: {
        type: String,
    }
}, {
    timestamps: true,
});

// Index to quickly find pending sweeps
sweepQueueSchema.index({ status: 1, nextRetryAt: 1 });

const SweepQueue = mongoose.model('SweepQueue', sweepQueueSchema);
export default SweepQueue;
