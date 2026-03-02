import 'dotenv/config';
import mongoose from 'mongoose';
import Wallet from '../models/walletModel.js';

async function heal() {
    console.log('👷 [HEAL] Connecting to DB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ [HEAL] Connected.');

    // 1. Find all NGN wallets where network is NOT 'INTERNAL'
    const sickWallets = await Wallet.find({
        currency: 'NGN',
        network: { $ne: 'INTERNAL' }
    });

    console.log(`🔍 [HEAL] Found ${sickWallets.length} NGN wallets with wrong network (not 'INTERNAL')`);

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
            await Wallet.updateOne(
                { _id: internalWallet._id },
                { $inc: { balance: wallet.balance } }
            );
            await wallet.deleteOne();
        } else {
            console.log(`🏷️ [HEAL] Renaming 'user' to 'INTERNAL'`);
            // Use updateOne to bypass schema validation for NGN internal wallets
            await Wallet.updateOne(
                { _id: wallet._id },
                { $set: { network: 'INTERNAL' } }
            );
        }
    }

    console.log('🎉 [HEAL] Migration complete.');
    process.exit(0);
}

heal().catch(err => {
    console.error('❌ [HEAL] Fatal error:', err);
    process.exit(1);
});
