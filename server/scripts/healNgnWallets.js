import 'dotenv/config';
import mongoose from 'mongoose';
import Wallet from '../models/walletModel.js';

async function heal() {
    console.log('👷 [HEAL] Connecting to DB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ [HEAL] Connected.');

    // 1. Find all NGN wallets with network 'user'
    const sickWallets = await Wallet.find({
        currency: 'NGN',
        network: 'user'
    });

    console.log(`🔍 [HEAL] Found ${sickWallets.length} NGN wallets with wrong network 'user'`);

    for (const wallet of sickWallets) {
        console.log(`🩹 [HEAL] Merging NGN balance for user ${wallet.user}: ${wallet.balance}`);

        // Find if an INTERNAL one already exists
        const internalWallet = await Wallet.findOne({
            user: wallet.user,
            currency: 'NGN',
            network: 'INTERNAL'
        });

        if (internalWallet) {
            console.log(`➕ [HEAL] Adding ${wallet.balance} to existing INTERNAL wallet`);
            internalWallet.balance += wallet.balance;
            await internalWallet.save();
            await wallet.deleteOne();
        } else {
            console.log(`🏷️ [HEAL] Renaming 'user' to 'INTERNAL'`);
            wallet.network = 'INTERNAL';
            await wallet.save();
        }
    }

    console.log('🎉 [HEAL] Migration complete.');
    process.exit(0);
}

heal().catch(err => {
    console.error('❌ [HEAL] Fatal error:', err);
    process.exit(1);
});
