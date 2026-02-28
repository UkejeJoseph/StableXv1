import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';
import Wallet from '../models/walletModel.js';
import connectDB from '../config/db.js';

dotenv.config();

const seedAdmin = async () => {
    try {
        await connectDB();

        const adminEmail = "admin@stablex.com";
        const existingAdmin = await User.findOne({ email: adminEmail });

        if (existingAdmin) {
            console.log("✅ Admin already exists.");
            process.exit();
        }

        // 1. Create Admin User
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("admin123", salt);

        const admin = await User.create({
            email: adminEmail,
            password: hashedPassword,
            role: 'admin',
            isVerified: true
        });

        console.log("👤 Admin User Created.");

        // 2. Create Treasury Wallets with 0 balance (Production: real balances come from on-chain sweeps)
        const wallets = [
            {
                user: admin._id,
                network: 'NGN',
                currency: 'NGN',
                balance: 0,
                address: 'TREASURY_NGN',
                encryptedPrivateKey: 'N/A',
                iv: 'N/A',
                authTag: 'N/A'
            },
            {
                user: admin._id,
                network: 'USDT',
                currency: 'USDT',
                balance: 0,
                address: 'TREASURY_USDT',
                encryptedPrivateKey: 'N/A',
                iv: 'N/A',
                authTag: 'N/A'
            }
        ];

        // 3. Create Internal Platform Treasury User for Task 10
        const platformEmail = 'platform@stablex.internal';
        let platformUser = await User.findOne({ email: platformEmail });
        if (!platformUser) {
            platformUser = await User.create({
                email: platformEmail,
                password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), salt),
                username: 'stablex_treasury',
                role: 'admin',
                isVerified: true
            });
            console.log("🏦 Platform Treasury User Created.");
        }

        await Wallet.insertMany(wallets);
        console.log("💰 Treasury Wallets Initialized.");

        console.log("🚀 Database is now READY for Live Testing!");
        process.exit();
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
};

seedAdmin();
