import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';
import Wallet from '../models/walletModel.js';
import connectDB from '../config/db.js';

dotenv.config();

const updateDB = async () => {
    try {
        await connectDB();

        // 1. Update ukejejoseph1@gmail.com to admin
        const me = await User.findOne({ email: 'ukejejoseph1@gmail.com' });
        if (me) {
            me.role = 'admin';
            me.isVerified = true;
            await me.save();
            console.log('✅ Updated ukejejoseph1@gmail.com to admin');
        } else {
            console.log('❌ ukejejoseph1@gmail.com not found');
        }

        // 2. Fund treasury wallets
        const treasuryEmail = 'platform@stablex.internal';
        let treasuryUser = await User.findOne({ email: treasuryEmail });

        if (!treasuryUser) {
            console.log('🔄 Treasury user not found. Creating it...');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(Math.random().toString(36), salt);
            treasuryUser = await User.create({
                email: treasuryEmail,
                password: hashedPassword,
                username: 'stablex_treasury',
                role: 'admin',
                isVerified: true
            });
            console.log('✅ Created platform treasury user');
        }

        const currencies = ['USDT_TRC20', 'USDT_ERC20', 'ETH', 'BTC', 'SOL', 'NGN'];

        for (const currency of currencies) {
            let wallet = await Wallet.findOne({ user: treasuryUser._id, currency });
            if (wallet) {
                wallet.balance += 1000;
                await wallet.save();
                console.log(`✅ Added 1000 to existing treasury ${currency} wallet. New balance: ${wallet.balance}`);
            } else {
                await Wallet.create({
                    user: treasuryUser._id,
                    walletType: 'merchant',
                    network: currency.includes('_') ? currency.split('_')[1] : currency,
                    currency: currency,
                    balance: 1000,
                    address: `TREASURY_${currency}`,
                    encryptedPrivateKey: 'N/A',
                    privateKeyIv: 'N/A',
                    privateKeyAuthTag: 'N/A',
                    iv: 'N/A',
                    authTag: 'N/A'
                });
                console.log(`✅ Created treasury ${currency} wallet with 1000 balance`);
            }
        }

        console.log("🚀 DB Update Complete!");
        process.exit();
    } catch (error) {
        console.error("❌ Update failed:", error);
        process.exit(1);
    }
};

updateDB();
