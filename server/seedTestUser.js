/*
 * COMMENTED OUT FOR PRODUCTION DEPLOYMENT
 * Seed script: Create a test user directly in MongoDB (bypasses OTP)
 * Usage: node server/seedTestUser.js
 * To re-enable: remove the block comment wrappers at the top and bottom of this file.
 */

/*
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/userModel.js';
import Wallet from './models/walletModel.js';
import { generateMnemonic, deriveWallets } from './utils/walletGenerator.js';
import { encrypt } from './utils/encryption.js';
import jwt from 'jsonwebtoken';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

const seedTestUser = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ MongoDB connected');

        const email = 'testuser1@gmail.com';
        const password = 'Test1234!';

        // Check if user already exists
        const existing = await User.findOne({ email });
        if (existing) {
            console.log('⚠️  User already exists. Updating to verified status...');
            existing.isVerified = true;
            existing.kycStatus = 'verified';
            existing.role = 'merchant';
            await existing.save();

            const token = jwt.sign({ id: existing._id }, process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod', { expiresIn: '30d' });
            console.log('\n════════════════════════════════════════');
            console.log('✅ Test User Ready!');
            console.log(`   Email: ${email}`);
            console.log(`   Password: ${password}`);
            console.log(`   KYC: verified | Role: merchant`);
            console.log(`   Token: ${token}`);
            console.log('════════════════════════════════════════\n');

            await mongoose.disconnect();
            return;
        }

        // Create user
        const user = await User.create({
            email,
            password,
            username: 'testuser1',
            firstName: 'Test',
            lastName: 'User',
            phoneNumber: '+2348012345678',
            role: 'merchant',
            kycStatus: 'verified',
            isVerified: true,
        });

        console.log(`✅ User created: ${user._id}`);

        // Generate wallets
        try {
            const mnemonic = generateMnemonic();
            const maxIndexUser = await User.findOne({ walletDerivationIndex: { $gte: 0 } })
                .sort({ walletDerivationIndex: -1 })
                .select('walletDerivationIndex')
                .lean();
            const nextIndex = maxIndexUser ? maxIndexUser.walletDerivationIndex + 1 : 0;

            const walletsData = await deriveWallets(mnemonic, nextIndex);

            const encryptedPhrase = encrypt(mnemonic);
            user.encryptedMnemonic = encryptedPhrase.encryptedData;
            user.mnemonicIv = encryptedPhrase.iv;
            user.mnemonicAuthTag = encryptedPhrase.authTag;
            user.walletDerivationIndex = nextIndex;
            await user.save();

            const walletsToSave = walletsData.map(w => {
                const { encryptedData, iv, authTag } = encrypt(w.privateKey);
                return {
                    user: user._id,
                    currency: w.currency,
                    address: w.address,
                    encryptedPrivateKey: encryptedData,
                    iv,
                    authTag,
                    balance: 0,
                };
            });

            // Also create NGN fiat wallet with demo balance
            walletsToSave.push({
                user: user._id,
                currency: 'NGN',
                address: 'FIAT_ACCOUNT',
                encryptedPrivateKey: 'N/A',
                iv: 'N/A',
                authTag: 'N/A',
                balance: 250000, // ₦250,000 demo balance
            });

            await Wallet.insertMany(walletsToSave);
            console.log(`💳 ${walletsToSave.length} wallets created (including NGN with ₦250,000)`);
        } catch (walletErr) {
            console.error('Wallet generation failed:', walletErr.message);
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod', { expiresIn: '30d' });

        console.log('\n════════════════════════════════════════');
        console.log('✅ Test User Created Successfully!');
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);
        console.log(`   KYC: verified | Role: merchant`);
        console.log(`   Token: ${token}`);
        console.log('════════════════════════════════════════\n');

        await mongoose.disconnect();
    } catch (err) {
        console.error('❌ Seed failed:', err.message);
        process.exit(1);
    }
};

seedTestUser();
*/
