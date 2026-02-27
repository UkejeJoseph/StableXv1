
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './server/models/userModel.js';
import Wallet from './server/models/walletModel.js';

dotenv.config();

const EMAIL = 'tolafalux@gmail.com';

async function checkAndCleanup() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const user = await User.findOne({ email: EMAIL });
        if (user) {
            console.log(`Found user: ${user._id} | Verified: ${user.isVerified} | CreatedAt: ${user.createdAt}`);

            // Delete associated wallets
            const walletResult = await Wallet.deleteMany({ user: user._id });
            console.log(`Deleted ${walletResult.deletedCount} wallets`);

            // Delete user
            await User.deleteOne({ _id: user._id });
            console.log(`Deleted user: ${EMAIL}`);
        } else {
            console.log(`User ${EMAIL} not found in DB.`);
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

checkAndCleanup();
