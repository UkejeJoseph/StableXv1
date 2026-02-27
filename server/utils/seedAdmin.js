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

        // 2. Create Treasury Wallets with "Infinite" Demo Liquidity
        const wallets = [
            {
                user: admin._id,
                currency: 'NGN',
                balance: 100000000, // 100 Million NGN Liquidity
                address: 'TREASURY_NGN',
                encryptedPrivateKey: 'N/A',
                iv: 'N/A',
                authTag: 'N/A'
            },
            {
                user: admin._id,
                currency: 'USDT',
                balance: 50000, // 50,000 USDT Liquidity
                address: 'TREASURY_USDT',
                encryptedPrivateKey: 'N/A',
                iv: 'N/A',
                authTag: 'N/A'
            }
        ];

        await Wallet.insertMany(wallets);
        console.log("💰 Treasury Wallets Seeded with Liquidity.");

        console.log("🚀 Database is now READY for Live Testing!");
        process.exit();
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
};

seedAdmin();
