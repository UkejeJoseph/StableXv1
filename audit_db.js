
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Wallet from './server/models/walletModel.js';
import Transaction from './server/models/transactionModel.js';

dotenv.config();

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('--- WALLET SAMPLE ---');
    const wallet = await Wallet.findOne({ currency: { $in: ['USDT_TRC20', 'TRC20'] } });
    if (wallet) {
        const masked = { ...wallet._doc };
        masked.encryptedPrivateKey = masked.encryptedPrivateKey.substring(0, 10) + '...';
        console.log(JSON.stringify(masked, null, 2));
    } else {
        console.log('No TRON wallet found.');
    }

    console.log('--- TRANSACTION INDEXES ---');
    const indexes = await Transaction.collection.indexes();
    console.log(JSON.stringify(indexes, null, 2));

    await mongoose.disconnect();
}

run().catch(console.error);
