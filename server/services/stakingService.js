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

    let position;
    // We import mongoose locally or use it from the model for the session
    const mongoose = await import('mongoose');
    const session = await mongoose.startSession();
    console.log('[STAKING-STAKE] Session started');

    try {
        await session.withTransaction(async () => {
            console.log('[STAKING-STAKE] Step 1: Debiting user wallet...');
            const txRef = `stake_${Date.now()}`;
            const network = currency === 'NGN' ? 'INTERNAL' : currency;

            const debitResult = await debitUserWallet(
                userId,
                currency,
                network,
                stakeAmount,
                txRef,
                { type: 'staking', action: 'stake' },
                session
            );
            if (!debitResult) throw new Error('Insufficient balance for staking');
            console.log('[STAKING-STAKE] ✅ Wallet debited');

            console.log('[STAKING-STAKE] Step 2: Creating staking position...');
            const positions = await StakingPosition.create(
                [{
                    userId,
                    currency,
                    network,
                    amount: stakeAmount,
                    apy: STAKING_APY,
                    status: 'active',
                    reference: txRef,
                    startDate: new Date(),
                    lastRewardDate: new Date(),
                    totalEarned: 0,
                }],
                { session }
            );
            position = positions[0];
            console.log('[STAKING-STAKE] ✅ Position created');
        });

        console.log('[STAKING-STAKE] ✅ STAKE ATOMIC - COMMITTED');

    } catch (err) {
        console.error('[STAKING-STAKE] ❌ STAKE FAILED - ROLLED BACK:', err.message);
        throw err;
    } finally {
        session.endSession();
        console.log('[STAKING-STAKE] Session ended');
    }

    return position;
};

/**
 * Unstake tokens — returns principal to user (ATOMIC)
 */
export const unstakeTokens = async (userId, positionId) => {
    console.log(`[STAKING] ══════════════════════════════`);
    console.log(`[STAKING] Unstake request | User: ${userId} | Position: ${positionId}`);

    // We import mongoose locally or use it from the model
    const session = await StakingPosition.startSession();

    try {
        let resultData = null;
        await session.withTransaction(async () => {
            const position = await StakingPosition.findOne({
                _id: positionId,
                userId,
                status: 'active',
            }).session(session);

            if (!position) throw new Error('Active staking position not found');
            console.log(`[STAKING] Position found. Principal: ${position.amount}`);

            // 1. Return principal to user
            console.log(`[STAKING] Step 1: Credit principal back to user...`);
            console.log('[STAKING-FIX] Found broken creditUserWallet calls');
            console.log('[STAKING-FIX] Fixing argument order...');

            const network = position.currency === 'NGN' ? 'INTERNAL' : position.currency;
            await creditUserWallet(
                userId,               // 1. userId
                position.currency,    // 2. currency
                network,              // 3. network
                position.amount,      // 4. amount
                `unstake_${positionId}`, // 5. reference
                { type: 'unstake' },  // 6. meta
                session               // 7. session (optional)
            );

            console.log('[STAKING-UNSTAKE] ✅ creditUserWallet args fixed');
            console.log('[STAKING-UNSTAKE] userId:', userId);
            console.log('[STAKING-UNSTAKE] currency:', position.currency);
            console.log('[STAKING-UNSTAKE] network:', network);
            console.log('[STAKING-UNSTAKE] amount:', position.amount);
            console.log('[STAKING-UNSTAKE] reference:', `unstake_${positionId}`);

            // 2. Mark position as completed
            console.log(`[STAKING] Step 2: Update position to completed...`);
            await StakingPosition.findByIdAndUpdate(
                positionId,
                { status: 'completed', endDate: new Date() },
                { session }
            );

            resultData = { amount: position.amount, currency: position.currency, totalEarned: position.totalEarned };
        });

        console.log(`[STAKING] ✅ UNSTAKE ATOMIC - COMMITTED`);
        console.log(`[STAKING] ══════════════════════════════`);
        return resultData;
    } catch (err) {
        console.error(`[STAKING] ❌ UNSTAKE FAILED - ROLLED BACK:`, err.message);
        throw err;
    } finally {
        session.endSession();
    }
};

/**
 * Distribute daily yield to all active stakers (ATOMIC PER POSITION)
 * Should be called once daily via cron job
 */
export const distributeYield = async () => {
    const activePositions = await StakingPosition.find({ status: 'active' });
    let totalDistributed = 0;
    let positionsProcessed = 0;

    for (const position of activePositions) {
        const session = await StakingPosition.startSession();
        try {
            await session.withTransaction(async () => {
                const dailyRate = position.apy / 365;
                const dailyYield = position.amount * dailyRate;

                // 1. Credit yield to user wallet
                console.log('[STAKING-FIX] Found broken creditUserWallet calls');
                console.log('[STAKING-FIX] Fixing argument order...');

                const network = position.currency === 'NGN' ? 'INTERNAL' : position.currency;
                const reference = `yield_${position._id}_${Date.now()}`;
                await creditUserWallet(
                    position.userId,      // 1. userId
                    position.currency,    // 2. currency
                    network,              // 3. network
                    dailyYield,           // 4. amount
                    reference,            // 5. reference
                    { type: 'staking_yield', positionId: position._id.toString() }, // 6. meta
                    session               // 7. session (optional)
                );

                console.log('[STAKING-YIELD] ✅ creditUserWallet args fixed');
                console.log('[STAKING-YIELD] userId:', position.userId);
                console.log('[STAKING-YIELD] currency:', position.currency);
                console.log('[STAKING-YIELD] network:', network);
                console.log('[STAKING-YIELD] amount:', dailyYield);
                console.log('[STAKING-YIELD] reference:', reference);

                // 2. Update position
                await StakingPosition.findByIdAndUpdate(
                    position._id,
                    {
                        $inc: { totalEarned: dailyYield },
                        lastRewardDate: new Date(),
                    },
                    { session }
                );

                totalDistributed += dailyYield;
                positionsProcessed++;
            });
        } catch (err) {
            console.error(`[STAKING-YIELD] ❌ Yield distribution failed for position ${position._id}:`, err.message);
        } finally {
            session.endSession();
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
