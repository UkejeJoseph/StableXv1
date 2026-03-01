import crypto from 'crypto';
import Wallet from '../models/walletModel.js';
import Transaction from '../models/transactionModel.js';

function decryptPrivateKey(encryptedKey, iv, authTag) {
    console.log('[BTC-SWEEP] Decrypting private key...');

    const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
        Buffer.from(iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedKey, 'hex')),
        decipher.final(),
    ]);

    console.log('[BTC-SWEEP] ✅ Key decrypted');
    return decrypted.toString();
}

export async function sweepBTC(userWalletAddress, userId) {
    console.log('[BTC-SWEEP] ══════════════════════════════');
    console.log('[BTC-SWEEP] Starting sweep for address:', userWalletAddress);
    console.log('[BTC-SWEEP] User:', userId);

    try {
        // Get user sub-wallet from DB
        const userWallet = await Wallet.findOne({
            address: userWalletAddress,
            network: 'BTC',
            walletType: 'user',
        });

        if (!userWallet) {
            console.error('[BTC-SWEEP] ❌ User wallet not found:', userWalletAddress);
            throw new Error('User BTC wallet not found');
        }

        // Get hot wallet
        const hotWallet = await Wallet.findOne({
            walletType: 'hot',
            network: 'BTC',
        });

        if (!hotWallet) {
            console.error('[BTC-SWEEP] ❌ Hot wallet not found');
            throw new Error('BTC hot wallet not found');
        }

        console.log('[BTC-SWEEP] Hot wallet address:', hotWallet.address);

        // Fetch UTXOs for user sub-wallet
        const isMainnet = process.env.BTC_NETWORK === 'mainnet';
        const baseUrl = isMainnet
            ? 'https://blockstream.info/api'
            : 'https://blockstream.info/testnet/api';

        console.log('[BTC-SWEEP] Fetching UTXOs for:', userWalletAddress);

        const utxoRes = await fetch(
            `${baseUrl}/address/${userWalletAddress}/utxo`
        );
        const utxos = await utxoRes.json();

        console.log('[BTC-SWEEP] UTXOs found:', utxos.length);

        if (!utxos.length) {
            console.warn('[BTC-SWEEP] ⚠️ No UTXOs to sweep');
            return null;
        }

        // Calculate total available
        const totalSats = utxos.reduce((sum, u) => sum + u.value, 0);
        const feeSats = 10000; // 0.0001 BTC static fee
        const sweepSats = totalSats - feeSats;

        console.log('[BTC-SWEEP] Total sats:', totalSats);
        console.log('[BTC-SWEEP] Fee sats:', feeSats);
        console.log('[BTC-SWEEP] Sweep sats:', sweepSats);

        if (sweepSats <= 0) {
            console.warn('[BTC-SWEEP] ⚠️ Insufficient funds to cover sweep fee');
            console.warn('[BTC-SWEEP] Total:', totalSats, 'Fee:', feeSats);
            return null;
        }

        // Decrypt user wallet private key
        const privateKeyWIF = decryptPrivateKey(
            userWallet.encryptedPrivateKey,
            userWallet.privateKeyIv,
            userWallet.privateKeyAuthTag
        );

        // Build PSBT
        const bitcoin = await import('bitcoinjs-lib');
        const ECPair = await import('ecpair');
        const ecc = await import('tiny-secp256k1');

        const network = isMainnet
            ? bitcoin.networks.bitcoin
            : bitcoin.networks.testnet;

        const keyPair = ECPair.ECPairFactory(ecc.default || ecc).fromWIF(privateKeyWIF, network);
        const psbt = new bitcoin.Psbt({ network });

        console.log('[BTC-SWEEP] Building PSBT with', utxos.length, 'inputs...');

        // Add all UTXOs as inputs
        for (const utxo of utxos) {
            const txRes = await fetch(`${baseUrl}/tx/${utxo.txid}/hex`);
            const txHex = await txRes.text();

            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                nonWitnessUtxo: Buffer.from(txHex, 'hex'),
            });

            console.log('[BTC-SWEEP] Added input:', utxo.txid, 'value:', utxo.value);
        }

        // Single output to hot wallet (sweep all minus fee)
        psbt.addOutput({
            address: hotWallet.address,
            value: sweepSats,
        });

        console.log('[BTC-SWEEP] Output to hot wallet:', sweepSats, 'sats');

        // Sign all inputs
        psbt.signAllInputs(keyPair);
        psbt.finalizeAllInputs();

        const txHex = psbt.extractTransaction().toHex();
        console.log('[BTC-SWEEP] ✅ PSBT built and signed');

        // Broadcast
        console.log('[BTC-SWEEP] Broadcasting sweep TX...');

        const broadcastRes = await fetch(`${baseUrl}/tx`, {
            method: 'POST',
            body: txHex,
        });

        if (!broadcastRes.ok) {
            const errText = await broadcastRes.text();
            console.error('[BTC-SWEEP] ❌ Broadcast failed:', errText);
            throw new Error('BTC sweep broadcast failed: ' + errText);
        }

        const txHash = await broadcastRes.text();
        console.log('[BTC-SWEEP] ✅ Sweep TX broadcast:', txHash);

        // Record sweep in DB
        await Transaction.create({
            userId,
            reference: `STX-SWEEP-BTC-${Date.now()}-${userId}`,
            type: 'sweep',
            currency: 'BTC',
            amount: sweepSats / 100_000_000,
            status: 'completed',
            provider: 'crypto',
            metadata: {
                txHash,
                fromAddress: userWalletAddress,
                toAddress: hotWallet.address,
                totalSats,
                feeSats,
                sweepSats,
                network: isMainnet ? 'mainnet' : 'testnet',
            },
        });

        console.log('[BTC-SWEEP] ✅ Sweep recorded in DB');
        console.log('[BTC-SWEEP] ══════════════════════════════');

        return txHash;

    } catch (err) {
        console.error('[BTC-SWEEP] ❌ Sweep failed:', err.message);
        console.error('[BTC-SWEEP] Stack:', err.stack);
        throw err;
    }
}
