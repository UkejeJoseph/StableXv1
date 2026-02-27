import mongoose from 'mongoose';

const checkoutSessionSchema = mongoose.Schema({
    merchantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    amount: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        required: true,
    },
    customerEmail: {
        type: String,
    },
    customerName: {
        type: String,
    },
    description: {
        type: String,
    },
    reference: {
        type: String,
        required: true,
    },
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'expired'],
        default: 'pending',
    },
    successUrl: {
        type: String,
    },
    cancelUrl: {
        type: String,
    },
    paymentMethod: {
        type: String, // e.g. "StableX", "Interswitch", "Crypto"
    },
    expiresAt: {
        type: Date,
        required: true,
    },
    platformFee: {
        type: Number,
        default: 0,
    },
    merchantReceives: {
        type: Number,
        default: 0,
    },
    feePercentage: {
        type: Number,
        default: 0.015,
    }
}, {
    timestamps: true,
});

// Ensure a merchant cannot have duplicate transaction references
checkoutSessionSchema.index({ merchantId: 1, reference: 1 }, { unique: true });

const CheckoutSession = mongoose.model('CheckoutSession', checkoutSessionSchema);
export default CheckoutSession;
