import mongoose from 'mongoose';

const stakingPositionSchema = mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    currency: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
        min: [10, 'Minimum stake is 10 units'],
    },
    apy: {
        type: Number,
        required: true,
    },
    startDate: {
        type: Date,
        default: Date.now,
    },
    endDate: {
        type: Date,
    },
    lastRewardDate: {
        type: Date,
        default: Date.now,
    },
    status: {
        type: String,
        enum: ['active', 'completed'],
        default: 'active',
    },
    totalEarned: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
});

stakingPositionSchema.index({ userId: 1, status: 1 });
stakingPositionSchema.index({ status: 1 });

const StakingPosition = mongoose.model('StakingPosition', stakingPositionSchema);
export default StakingPosition;
