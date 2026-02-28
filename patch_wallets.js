import mongoose from 'mongoose';
import 'dotenv/config';

const patchWallets = async () => {
    console.log('🚀 Starting MongoDB wallet network field patch...');
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const result = await mongoose.connection.db.collection('wallets').updateMany(
            { $or: [{ network: null }, { network: "" }, { network: { $exists: false } }] },
            [{ $set: { network: "$currency" } }]
        );

        console.log(`✨ Patch complete: ${result.modifiedCount} documents modified.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Patch failed:', error.message);
        process.exit(1);
    }
};

patchWallets();
