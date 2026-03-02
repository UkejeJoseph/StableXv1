import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/userModel.js';
import { creditUserWallet } from '../services/walletService.js';

async function fundTreasury() {
    console.log('👷 [TREASURY] Connecting to DB...');
    await mongoose.connect(process.env.MONGODB_URI);

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
        { currency: 'USDT_ERC20', amount: 1000 }
    ];

    console.log(`🏦 [TREASURY] Funding assets for ${treasuryEmail}...`);

    for (const asset of assets) {
        try {
            await creditUserWallet(
                treasuryUser._id,
                asset.currency,
                asset.amount,
                `INITIAL_LIQUIDITY_${Date.now()}`,
                { reason: 'Test Liquidity' },
                'internal'
            );
            console.log(`✅ [TREASURY] Credited ${asset.amount} ${asset.currency}`);
        } catch (err) {
            console.error(`❌ [TREASURY] Failed to credit ${asset.currency}:`, err.message);
        }
    }

    console.log('🎉 [TREASURY] Funding complete.');
    process.exit(0);
}

fundTreasury().catch(console.error);
