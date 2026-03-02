import 'dotenv/config';
import mongoose from 'mongoose';
import Wallet from '../models/walletModel.js';
import User from '../models/userModel.js';

async function debug() {
    await mongoose.connect(process.env.MONGODB_URI);

    // Find a user who recently had issues (or just list NGN wallets)
    const ngnWallets = await Wallet.find({ currency: 'NGN' }).lean();
    console.log('--- ALL NGN WALLETS ---');
    for (const w of ngnWallets) {
        const user = await User.findById(w.user);
        console.log(`User: ${user?.username || w.user} (${w.user}) | Network: ${w.network} | Balance: ${w.balance}`);
    }

    process.exit(0);
}

debug();
