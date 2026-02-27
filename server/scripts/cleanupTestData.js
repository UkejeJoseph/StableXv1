import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
import Wallet from '../models/walletModel.js';
import Transaction from '../models/transactionModel.js';
import CheckoutSession from '../models/checkoutSessionModel.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const SUPER_ADMIN = 'ukejejoseph1@gmail.com';

const cleanup = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        // 1. Find non-admin users
        const nonAdmins = await User.find({ email: { $ne: SUPER_ADMIN } });
        const nonAdminIds = nonAdmins.map(u => u._id);

        console.log(`Found ${nonAdmins.length} non-admin users to remove.`);

        if (nonAdminIds.length > 0) {
            // 2. Delete Wallets
            const walletResult = await Wallet.deleteMany({ user: { $in: nonAdminIds } });
            console.log(`Deleted ${walletResult.deletedCount} wallets.`);

            // 3. Delete Transactions related to these users
            const txResult = await Transaction.deleteMany({ user: { $in: nonAdminIds } });
            console.log(`Deleted ${txResult.deletedCount} user transactions.`);

            // 4. Delete Checkout Sessions
            const checkoutResult = await CheckoutSession.deleteMany({ merchantId: { $in: nonAdminIds } });
            console.log(`Deleted ${checkoutResult.deletedCount} checkout sessions.`);

            // 5. Delete Users
            const userResult = await User.deleteMany({ _id: { $in: nonAdminIds } });
            console.log(`Deleted ${userResult.deletedCount} users.`);
        }

        // 6. Delete orphan transactions/sessions (optional, but good for clean slate)
        const orphanTx = await Transaction.deleteMany({ user: null });
        console.log(`Deleted ${orphanTx.deletedCount} orphan/webhook transactions.`);

        await CheckoutSession.deleteMany({ status: { $ne: 'completed' } });
        console.log('Cleared pending/expired checkout sessions.');

        console.log('\n✅ Database cleanup complete. System reset to Super Admin only.');
        process.exit(0);
    } catch (error) {
        console.error('Cleanup failed:', error);
        process.exit(1);
    }
};

cleanup();
