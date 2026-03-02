import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/userModel.js';
import Wallet from '../models/walletModel.js';

async function inspect() {
    await mongoose.connect(process.env.MONGODB_URI);
    const treasury = await User.findOne({ email: 'platform@stablex.internal' });
    if (!treasury) { console.log('Treasury not found'); process.exit(1); }

    const wallets = await Wallet.find({ user: treasury._id }).lean();
    console.log('--- TREASURY WALLETS ---');
    wallets.forEach(w => {
        console.log(`Currency: ${w.currency} | Network: ${w.network} | Balance: ${w.balance} | Type: ${w.walletType}`);
    });

    process.exit(0);
}
inspect();
