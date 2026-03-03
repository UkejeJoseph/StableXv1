import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import User from './server/models/userModel.js';
import Wallet from './server/models/walletModel.js';

async function fundUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const user = await User.findOne({ email: 'jukeje07@gmail.com' });
        if (!user) {
            console.error('User not found!');
            process.exit(1);
        }

        const ngnWallet = await Wallet.findOne({ user: user._id, currency: 'NGN', walletType: 'user' });
        if (ngnWallet) {
            await Wallet.updateOne(
                { _id: ngnWallet._id },
                { $inc: { balance: 5000000 } }
            );
            console.log('Funded NGN: 5,000,000');
        } else {
            console.log('No NGN wallet found for user. Have they logged in yet to generate it?');
        }

        const usdtWallet = await Wallet.findOne({ user: user._id, currency: 'USDT', walletType: 'user' });
        if (usdtWallet) {
            await Wallet.updateOne(
                { _id: usdtWallet._id },
                { $inc: { balance: 40 } }
            );
            console.log('Funded USDT: 40');
        } else {
            console.log('No USDT wallet found for user. Have they logged in yet to generate it?');
        }

        console.log('Done!');
        process.exit(0);
    } catch (error) {
        console.error('Funding error:', error);
        process.exit(1);
    }
}

fundUser();
