import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
import { generateMnemonic } from '../utils/walletGenerator.js';
import { encrypt } from '../utils/encryption.js';

dotenv.config();

const migrateToHDWallets = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('🚀 Connected to MongoDB for migration...');

        const usersWithoutMnemonic = await User.find({
            $or: [
                { encryptedMnemonic: { $exists: false } },
                { encryptedMnemonic: null },
                { encryptedMnemonic: "" }
            ]
        });

        console.log(`🔍 Found ${usersWithoutMnemonic.length} users needing mnemonics.`);

        for (const user of usersWithoutMnemonic) {
            console.log(`⚙️  Migrating user: ${user.email}`);

            const mnemonic = generateMnemonic();
            const encryptedPhrase = encrypt(mnemonic);

            user.encryptedMnemonic = encryptedPhrase.encryptedData;
            user.mnemonicIv = encryptedPhrase.iv;
            user.mnemonicAuthTag = encryptedPhrase.authTag;
            user.walletDerivationIndex = 0; // Start at 0 for new wallets

            await user.save();
            console.log(`✅ User ${user.email} migrated successfully.`);
        }

        console.log('🏁 Migration complete.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
};

migrateToHDWallets();
