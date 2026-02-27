import StakingPosition from '../models/stakingPositionModel.js';
import { creditUserWallet, debitUserWallet } from './walletService.js';

const STAKING_APY = Number(process.env.STAKING_APY) || 0.08; // 8% APY default
const MAX_TOTAL_STAKING = 100000; // 100k USDT total cap across all users

/**
 * Stake tokens — locks funds and creates a position
 */
export const stakeTokens = async (userId, currency, amount) => {
    const stakeAmount = Number(amount);
    if (stakeAmount < 10) throw new Error('Minimum stake is 10 units');

    // Check global staking cap
    const totalActiveStaked = await StakingPosition.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const currentTotal = totalActiveStaked[0]?.total || 0;
    if (currentTotal + stakeAmount > MAX_TOTAL_STAKING) {
        throw new Error(`Staking pool is full. Max capacity: ${MAX_TOTAL_STAKING}. Currently staked: ${currentTotal}`);
    }

    // Debit from user wallet
    const txRef = `stake_${Date.now()}`;
    const debitResult = await debitUserWallet(userId, currency, stakeAmount, txRef);
    if (!debitResult) throw new Error('Insufficient balance for staking');

    // Create staking position
    const position = await StakingPosition.create({
        userId,
        currency,
        amount: stakeAmount,
        apy: STAKING_APY,
        startDate: new Date(),
        lastRewardDate: new Date(),
        status: 'active',
        totalEarned: 0,
    });

    return position;
};

/**
 * Unstake tokens — returns principal to user
 */
export const unstakeTokens = async (userId, positionId) => {
    const position = await StakingPosition.findOne({
        _id: positionId,
        userId,
        status: 'active',
    });
    if (!position) throw new Error('Active staking position not found');

    // Return principal to user
    await creditUserWallet(
        userId,
        position.currency,
        position.amount,
        `unstake_${positionId}`,
        { type: 'unstake' }
    );

    // Mark position as completed
    await StakingPosition.findByIdAndUpdate(positionId, {
        status: 'completed',
        endDate: new Date(),
    });

    return { amount: position.amount, currency: position.currency, totalEarned: position.totalEarned };
};

/**
 * Distribute daily yield to all active stakers
 * Should be called once daily via cron job
 */
export const distributeYield = async () => {
    const activePositions = await StakingPosition.find({ status: 'active' });
    let totalDistributed = 0;
    let positionsProcessed = 0;

    for (const position of activePositions) {
        try {
            const dailyRate = position.apy / 365;
            const dailyYield = position.amount * dailyRate;

            // Credit yield to user wallet
            await creditUserWallet(
                position.userId,
                position.currency,
                dailyYield,
                `yield_${position._id}_${Date.now()}`,
                { type: 'staking_yield', positionId: position._id.toString() }
            );

            // Update position
            await StakingPosition.findByIdAndUpdate(position._id, {
                $inc: { totalEarned: dailyYield },
                lastRewardDate: new Date(),
            });

            totalDistributed += dailyYield;
            positionsProcessed++;
        } catch (err) {
            console.error(`[STAKING] Yield distribution failed for position ${position._id}:`, err.message);
        }
    }

    console.log(`[STAKING] Daily yield distributed: ${totalDistributed.toFixed(6)} across ${positionsProcessed} positions`);
    return { totalDistributed, positionsProcessed };
};

/**
 * Get all staking positions for a user
 */
export const getUserPositions = async (userId) => {
    return StakingPosition.find({ userId }).sort({ createdAt: -1 });
};
