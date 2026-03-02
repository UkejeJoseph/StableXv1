import 'dotenv/config';
import mongoose from 'mongoose';
import Wallet from '../models/walletModel.js';
import User from '../models/userModel.js';

async function heal() {
    console.log('👷 [HEAL] Connecting to DB...');
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ [HEAL] Connected.');
    } catch (err) {
        console.error('❌ [HEAL] Connection failed:', err.message);
        process.exit(1);
    }

    const allWallets = await Wallet.find({});
    console.log(`📊 [HEAL] Analyzing ${allWallets.length} wallets...`);

    const userMap = new Map(); // userId -> { currency -> [wallets] }

    // Group wallets by user and currency
    for (const wallet of allWallets) {
        const uid = wallet.user.toString();
        const curr = wallet.currency?.toUpperCase() || wallet.network?.toUpperCase();

        if (!userMap.has(uid)) userMap.set(uid, {});
        if (!userMap.get(uid)[curr]) userMap.get(uid)[curr] = [];
        userMap.get(uid)[curr].push(wallet);
    }

    let fixedCount = 0;
    let mergedCount = 0;

    for (const [uid, currencies] of userMap.entries()) {
        for (const [curr, wallets] of Object.entries(currencies)) {

            // Determine the correct network name for this currency
            let correctNetwork = curr;
            if (curr === 'NGN') correctNetwork = 'INTERNAL';

            // 1. Fix network names and identify duplicates
            const primaryWallet = wallets.find(w => w.network === correctNetwork) || wallets[0];

            for (const w of wallets) {
                if (w.network !== correctNetwork) {
                    console.log(`🔧 [FIX] User ${uid} | ${curr}: ${w.network} -> ${correctNetwork}`);
                    w.network = correctNetwork;
                    await w.save({ validateBeforeSave: false });
                    fixedCount++;
                }
            }

            // 2. Merge duplicates if they exist after normalization
            if (wallets.length > 1) {
                console.log(`⚠️ [MERGE] User ${uid} | Found ${wallets.length} wallets for ${curr}. Consolidating...`);

                // Sort by balance descending to keep the one with most money as primary if possible
                wallets.sort((a, b) => b.balance - a.balance);
                const keep = wallets[0];
                const toDelete = wallets.slice(1);

                for (const trash of toDelete) {
                    if (trash.balance > 0) {
                        console.log(`💰 [MOVE] Adding ${trash.balance} to primary wallet ${keep._id}`);
                        keep.balance += trash.balance;
                        await keep.save({ validateBeforeSave: false });
                    }
                    await Wallet.findByIdAndDelete(trash._id);
                    mergedCount++;
                }
            }
        }
    }

    console.log(`\n✨ [HEAL] Done!`);
    console.log(`✅ Fixed Network Names: ${fixedCount}`);
    console.log(`✅ Merged Duplicates: ${mergedCount}`);

    process.exit(0);
}

heal().catch(console.error);
