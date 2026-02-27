import mongoose from 'mongoose';

const webhookQueueSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    url: {
        type: String,
        required: true,
    },
    eventType: {
        type: String,
        required: true, // e.g., 'deposit.confirmed', 'withdrawal.completed'
    },
    payload: {
        type: Object,
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
    lastResponse: {
        type: String,
    },
    signature: {
        type: String,
    }
}, {
    timestamps: true,
});

webhookQueueSchema.index({ status: 1, nextRetryAt: 1 });

const WebhookQueue = mongoose.model('WebhookQueue', webhookQueueSchema);
export default WebhookQueue;
