import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

const walletSchema = new mongoose.Schema({}, { strict: false });
const Wallet = mongoose.model('Wallet', walletSchema);

async function findNullWallet() {
    try {
        await mongoose.connect(MONGODB_URI);
        const wallet = await Wallet.findOne({ $or: [{ currency: null }, { currency: "" }] });
        console.log(JSON.stringify(wallet, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

findNullWallet();
