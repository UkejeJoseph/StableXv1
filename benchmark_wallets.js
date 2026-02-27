
import dotenv from 'dotenv';
import { generateMnemonic, deriveWallets } from './server/utils/walletGenerator.js';

dotenv.config();

async function benchmark() {
    console.log('Generating mnemonic...');
    const mnemonic = generateMnemonic();

    console.log('Deriving wallets (BTC, ETH, SOL, TRON, NGN)...');
    const start = Date.now();
    try {
        const wallets = await deriveWallets(mnemonic, 0);
        const end = Date.now();
        console.log(`Done! Derived ${wallets.length} wallets in ${end - start}ms`);
        console.log('Currencies:', wallets.map(w => w.currency).join(', '));
    } catch (err) {
        console.error('Benchmark error:', err);
    }
}

benchmark();
