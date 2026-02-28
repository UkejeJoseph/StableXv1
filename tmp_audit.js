import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

const walletSchema = new mongoose.Schema({}, { strict: false });
const Wallet = mongoose.model('Wallet', walletSchema);

const sweepQueueSchema = new mongoose.Schema({}, { strict: false });
const SweepQueue = mongoose.model('SweepQueue', sweepQueueSchema);

async function runAudit() {
    try {
        await mongoose.connect(MONGODB_URI);

        const totalWallets = await Wallet.countDocuments({
            walletType: { $in: ['user', 'merchant'] }
        });

        const breakdown = await Wallet.aggregate([
            { $match: { walletType: { $in: ['user', 'merchant'] } } },
            { $group: { _id: '$currency', count: { $sum: 1 } } }
        ]);

        const totalSweeps = await SweepQueue.countDocuments();
        const pendingSweeps = await SweepQueue.countDocuments({ status: 'pending' });
        const processingSweeps = await SweepQueue.countDocuments({ status: 'processing' });
        const completedSweeps = await SweepQueue.countDocuments({ status: 'completed' });
        const failedSweeps = await SweepQueue.countDocuments({ status: 'failed' });

        console.log('--- AUDIT RESULTS ---');
        console.log(`Total Target Wallets: ${totalWallets}`);
        console.log('Breakdown by Currency:');
        breakdown.forEach(item => {
            console.log(`  ${item._id}: ${item.count}`);
        });
        console.log(`Total SweepQueue Items: ${totalSweeps}`);
        console.log(`  Pending: ${pendingSweeps}`);
        console.log(`  Processing: ${processingSweeps}`);
        console.log(`  Completed: ${completedSweeps}`);
        console.log(`  Failed: ${failedSweeps}`);
        console.log('---------------------');

    } catch (err) {
        console.error('Audit failed:', err);
    } finally {
        await mongoose.disconnect();
    }
}

runAudit();
