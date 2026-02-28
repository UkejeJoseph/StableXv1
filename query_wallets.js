import 'dotenv/config';
import mongoose from 'mongoose';
import Wallet from './server/models/walletModel.js';

const runQuery = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const wallets = await Wallet.find({
            $or: [
                { network: null },
                { network: "" },
                { network: { $exists: false } }
            ]
        })
            .limit(3)
            .select('user currency balance createdAt walletType')
            .lean();

        console.log(JSON.stringify(wallets, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

runQuery();
