import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

const walletSchema = new mongoose.Schema({}, { strict: false });
const Wallet = mongoose.model('Wallet', walletSchema);

async function runAggregation() {
    try {
        await mongoose.connect(MONGODB_URI);
        const results = await Wallet.aggregate([
            {
                $match: {
                    walletType: { $in: ['user', 'merchant'] },
                    address: { $ne: 'FIAT_ACCOUNT' }
                }
            },
            {
                $group: {
                    _id: '$currency',
                    count: { $sum: 1 }
                }
            }
        ]);
        console.log('--- WALLET COUNTS PER NETWORK ---');
        console.log(JSON.stringify(results, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

runAggregation();
