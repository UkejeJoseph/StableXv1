
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { creditUserWallet } from './server/services/walletService.js';
import User from './server/models/userModel.js';
import Transaction from './server/models/transactionModel.js';

dotenv.config();

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);

    // 1. Find a test user
    const user = await User.findOne({ email: 'ukejejoseph1@gmail.com' });
    if (!user) {
        console.log('Test user not found.');
        process.exit(1);
    }

    console.log('--- BEFORE STATE ---');
    const balanceBefore = await mongoose.connection.db.collection('wallets').findOne({ user: user._id, currency: 'USDT_TRC20' });
    console.log('Balance:', balanceBefore?.balance || 0);

    const txHash = 'DRY_RUN_' + Date.now();

    // 2. Simulate injection
    console.log('\n--- SIMULATING CREDIT ---');
    await creditUserWallet(user._id, 'USDT_TRC20', 1.0, txHash, { network: 'TRC20' });

    console.log('\n--- AFTER STATE ---');
    const balanceAfter = await mongoose.connection.db.collection('wallets').findOne({ user: user._id, currency: 'USDT_TRC20' });
    console.log('Balance:', balanceAfter?.balance || 0);

    const txRecord = await Transaction.findOne({ reference: txHash });
    console.log('Transaction Record Created:', !!txRecord);

    // 3. Test Idempotency
    console.log('\n--- TESTING IDEMPOTENCY (Same TxHash) ---');
    try {
        await creditUserWallet(user._id, 'USDT_TRC20', 1.0, txHash, { network: 'TRC20' });
        console.log('FAIL: Credited again!');
    } catch (e) {
        console.log('SUCCESS: Blocked duplicate credit -', e.message);
    }

    await mongoose.disconnect();
}

run().catch(console.error);
