import 'dotenv/config';
import connectDB from '../config/db.js';
import User from '../models/userModel.js';
import Wallet from '../models/walletModel.js';
import { encrypt } from '../utils/encryption.js';

const createPlatformWallet = async () => {
    await connectDB();

    // Check if platform user already exists
    const existing = await User.findOne({ email: 'platform@stablex.internal' });
    if (existing) {
        console.log('⚠️  Platform wallet already exists!');
        console.log(`PLATFORM_FEE_WALLET_ID=${existing._id}`);
        process.exit(0);
    }

    // Create platform admin user
    const platformUser = await User.create({
        email: 'platform@stablex.internal',
        username: 'stablex_platform',
        password: 'PLATFORM_INTERNAL_DO_NOT_LOGIN_' + Date.now(), // Random password, never used
        role: 'admin',
        isVerified: true,
    });

    console.log('✅ Platform user created:', platformUser._id);

    // Create wallets for each supported currency
    const currencies = ['USDT_TRC20', 'TRX', 'ETH', 'USDT_ERC20', 'BTC', 'SOL', 'NGN'];
    const dummyEncrypted = encrypt('PLATFORM_INTERNAL_WALLET');

    for (const currency of currencies) {
        await Wallet.create({
            user: platformUser._id,
            walletType: 'treasury',
            currency,
            network: currency,
            balance: 0,
            address: `PLATFORM_FEE_${currency}`,
            encryptedPrivateKey: dummyEncrypted.encryptedData,
            privateKeyIv: dummyEncrypted.iv,
            privateKeyAuthTag: dummyEncrypted.authTag,
        });
        console.log(`  💰 Created ${currency} fee wallet`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Copy this to your .env file:');
    console.log(`PLATFORM_FEE_WALLET_ID=${platformUser._id}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    process.exit(0);
};

createPlatformWallet().catch(err => {
    console.error('❌ Failed to create platform wallet:', err);
    process.exit(1);
});
