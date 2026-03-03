import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import User from './models/userModel.js';
import Wallet from './models/walletModel.js';
import Transaction from './models/transactionModel.js';

async function seedDemoData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        await User.deleteOne({ email: 'demo@stablex.com' });

        const demoUser = new User({
            firstName: 'Adeola',
            lastName: 'Oluwaseun',
            email: 'demo@stablex.com',
            password: 'Password123!',
            phone: '+2348012345678',
            role: 'user',
            isEmailVerified: true,
            kycLevel: 2,
            kycStatus: 'verified'
        });
        await demoUser.save();
        console.log('Created User:', demoUser.email);

        const ngnWallet = new Wallet({
            user: demoUser._id,
            currency: 'NGN',
            balance: 1500000,
            address: '0123456789',
            network: 'BANK',
            walletType: 'user',
            encryptedPrivateKey: 'dummy_pk'
        });
        await ngnWallet.save();

        const usdtWallet = new Wallet({
            user: demoUser._id,
            currency: 'USDT',
            balance: 500,
            address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
            network: 'TRC20',
            walletType: 'user',
            encryptedPrivateKey: 'dummy_pk'
        });
        await usdtWallet.save();
        console.log('Funded Wallets (NGN and USDT)');

        const pastDate1 = new Date(); pastDate1.setDate(pastDate1.getDate() - 2);
        const pastDate2 = new Date(); pastDate2.setDate(pastDate2.getDate() - 1);

        await Transaction.create([
            {
                userId: demoUser._id,
                type: 'ngn_deposit',
                provider: 'korapay',
                amount: 2000000,
                currency: 'NGN',
                status: 'success',
                reference: 'DEP-1234567890',
                createdAt: pastDate1
            },
            {
                userId: demoUser._id,
                type: 'swap',
                provider: 'internal',
                amount: 500000,
                currency: 'NGN',
                status: 'success',
                reference: 'SWP-9876543210',
                createdAt: pastDate2
            }
        ]);
        console.log('Created realistic transaction history');

        console.log('--- SEED COMPLETE ---');
        console.log('Login Email: demo@stablex.com');
        console.log('Login Password: Password123!');
        process.exit(0);

    } catch (error) {
        console.error('Seeding error:', error);
        process.exit(1);
    }
}

seedDemoData();
