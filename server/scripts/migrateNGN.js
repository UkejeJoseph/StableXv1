import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
import Wallet from '../models/walletModel.js';
import Transaction from '../models/transactionModel.js';

dotenv.config();

/**
 * MIGRATION SCRIPT: NGN Ledger Unification
 * Moves User.ngnBalance -> Wallet (currency: NGN)
 */
async function migrateNGNBalances() {
    console.log('\n🚀 [MIGRATE] Starting NGN balance migration...');

    try {
        const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!uri) throw new Error('MONGODB_URI is not defined in environment');
        await mongoose.connect(uri);
        console.log('✅ [MIGRATE] Connected to MongoDB');

        // 1. Find all users with a balance in the legacy field
        const usersToMigrate = await User.find({ ngnBalance: { $gt: 0 } });
        console.log(`📊 [MIGRATE] Found ${usersToMigrate.length} users with legacy balances.`);

        for (const user of usersToMigrate) {
            const amount = user.ngnBalance;
            const userId = user._id;

            console.log(`\n⏳ [MIGRATE] Processing User: ${user.email} (Balance: ₦${amount})`);

            const session = await mongoose.startSession();
            session.startTransaction();

            try {
                // 2. Atomic Credit to Wallet (Upsert if doesn't exist)
                const wallet = await Wallet.findOneAndUpdate(
                    { user: userId, currency: 'NGN' },
                    {
                        $inc: { balance: amount },
                        $setOnInsert: {
                            user: userId,
                            currency: 'NGN',
                            network: 'INTERNAL',
                            address: 'INTERNAL',
                            walletType: 'user',
                            encryptedPrivateKey: 'N/A',
                            iv: 'N/A',
                            authTag: 'N/A'
                        }
                    },
                    { upsert: true, new: true, session }
                );

                // 3. Create Migration Transaction Log
                await Transaction.create([{
                    user: userId,
                    type: 'deposit',
                    status: 'completed',
                    amount: amount,
                    currency: 'NGN',
                    provider: 'migration',
                    reference: `MIGRATE_${Date.now()}_${userId.toString().slice(-4)}`,
                    description: `Migration of legacy NGN balance (₦${amount}) to wallet model.`
                }], { session });

                // 4. Zero out the legacy balance
                await User.findByIdAndUpdate(userId, { $set: { ngnBalance: 0 } }, { session });

                await session.commitTransaction();
                console.log(`✅ [MIGRATE] Successfully migrated ₦${amount} for ${user.email}`);
            } catch (err) {
                await session.abortTransaction();
                console.error(`❌ [MIGRATE] Failed to migrate ${user.email}:`, err.message);
            } finally {
                session.endSession();
            }
        }

        console.log('\n🏁 [MIGRATE] Migration complete.');
        process.exit(0);
    } catch (error) {
        console.error('💥 [MIGRATE] Critical migration error:', error.message);
        process.exit(1);
    }
}

migrateNGNBalances();
