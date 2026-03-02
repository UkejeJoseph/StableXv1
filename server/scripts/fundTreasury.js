import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/userModel.js';
import Wallet from '../models/walletModel.js';
import { creditUserWallet } from '../services/walletService.js';

async function fundTreasury() {
    console.log('👷 [TREASURY] Connecting to DB...');
    try {
        await mongoose.connect(process.env.MONGODB_URI);
    } catch (err) {
        console.error('❌ [TREASURY] Connection failed:', err.message);
        process.exit(1);
    }

    const treasuryEmail = 'platform@stablex.internal';
    const treasuryUser = await User.findOne({ email: treasuryEmail });

    if (!treasuryUser) {
        console.error('❌ Treasury user not found. Ensure you have run seed scripts.');
        process.exit(1);
    }

    const assets = [
        { currency: 'USDT_TRC20', amount: 1000 },
        { currency: 'BTC', amount: 1 },
        { currency: 'ETH', amount: 10 },
        { currency: 'SOL', amount: 100 },
        { currency: 'USDT_ERC20', amount: 1000 },
        { currency: 'NGN', amount: 500000 }
    ];

    console.log(`\n🏦 [TREASURY] Checking current balances for ${treasuryEmail}...`);

    for (const asset of assets) {
        const w = await Wallet.findOne({ user: treasuryUser._id, currency: asset.currency });
        console.log(`📊 [BEFORE] ${asset.currency}: ${w ? w.balance : 0}`);
    }

    console.log(`\n💸 [TREASURY] Funding assets...`);

    for (const asset of assets) {
        try {
            await creditUserWallet(
                treasuryUser._id,
                asset.currency,
                asset.amount,
                `LIQUIDITY_ADD_${Date.now()}`,
                { reason: 'Admin Liquidity Injection' },
                'internal'
            );

            const w = await Wallet.findOne({ user: treasuryUser._id, currency: asset.currency });
            console.log(`✅ [AFTER] ${asset.currency}: ${w ? w.balance : 0} (Added ${asset.amount})`);
        } catch (err) {
            console.error(`❌ [TREASURY] Failed to credit ${asset.currency}:`, err.message);
        }
    }

    console.log('\n🎉 [TREASURY] Funding complete.\n');
    process.exit(0);
}

fundTreasury().catch(console.error);
