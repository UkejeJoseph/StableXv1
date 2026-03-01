import { ethers } from 'ethers';
import TronWeb from 'tronweb';
import { Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import crypto from 'crypto';
import Wallet from '../models/walletModel.js';

// ════════════════════════════════════════
// DECRYPT HOT WALLET PRIVATE KEY
// ════════════════════════════════════════
function decryptPrivateKey(encryptedKey, iv, authTag) {
    console.log('[BROADCAST] Decrypting hot wallet private key...');

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

    console.log('[BROADCAST] ✅ Private key decrypted');
    return decrypted.toString('hex');
}

// ════════════════════════════════════════
// ETH / ERC20 BROADCAST
// ════════════════════════════════════════
export async function broadcastETH(toAddress, amount, currency = 'ETH') {
    console.log('[BROADCAST-ETH] ══════════════════════════');
    console.log('[BROADCAST-ETH] To:', toAddress);
    console.log('[BROADCAST-ETH] Amount:', amount, currency);

    // Get hot wallet from DB or env
    const hotWallet = await Wallet.findOne({
        walletType: 'hot',
        network: 'ETH',
    });

    if (!hotWallet) {
        console.error('[BROADCAST-ETH] ❌ Hot wallet not found in DB');
        throw new Error('ETH hot wallet not found');
    }

    console.log('[BROADCAST-ETH] Hot wallet address:', hotWallet.address);

    // Decrypt private key
    const privateKey = decryptPrivateKey(
        hotWallet.encryptedPrivateKey,
        hotWallet.privateKeyIv,
        hotWallet.privateKeyAuthTag
    );

    // Connect to provider
    const rpcUrl = process.env.ETH_RPC_URL ||
        'https://rpc.ankr.com/eth' ||
        'https://cloudflare-eth.com' ||
        'https://ethereum.publicnode.com';

    console.log('[BROADCAST-ETH] RPC URL:', rpcUrl);

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(`0x${privateKey}`, provider);

    if (currency === 'ETH') {
        // Native ETH transfer
        console.log('[BROADCAST-ETH] Sending native ETH...');

        const amountWei = ethers.parseEther(amount.toString());
        console.log('[BROADCAST-ETH] Amount in wei:', amountWei.toString());

        const tx = await wallet.sendTransaction({
            to: toAddress,
            value: amountWei,
        });

        console.log('[BROADCAST-ETH] ✅ TX submitted:', tx.hash);
        console.log('[BROADCAST-ETH] Waiting for confirmation...');

        const receipt = await tx.wait(1);
        console.log('[BROADCAST-ETH] ✅ Confirmed in block:', receipt.blockNumber);

        return tx.hash;

    } else if (currency === 'USDT_ERC20') {
        // USDT ERC20 transfer
        console.log('[BROADCAST-ETH] Sending USDT ERC20...');

        const USDT_CONTRACT = process.env.USDT_ERC20_CONTRACT ||
            '0xdAC17F958D2ee523a2206206994597C13D831ec7';

        const usdtAbi = [
            'function transfer(address to, uint256 amount) returns (bool)',
            'function decimals() view returns (uint8)',
        ];

        const usdtContract = new ethers.Contract(USDT_CONTRACT, usdtAbi, wallet);
        const decimals = await usdtContract.decimals();
        const amountUnits = ethers.parseUnits(amount.toString(), decimals);

        console.log('[BROADCAST-ETH] USDT contract:', USDT_CONTRACT);
        console.log('[BROADCAST-ETH] Amount units:', amountUnits.toString());

        const tx = await usdtContract.transfer(toAddress, amountUnits);
        console.log('[BROADCAST-ETH] ✅ TX submitted:', tx.hash);

        const receipt = await tx.wait(1);
        console.log('[BROADCAST-ETH] ✅ Confirmed in block:', receipt.blockNumber);

        return tx.hash;
    }

    throw new Error('Unsupported ETH currency: ' + currency);
}

// ════════════════════════════════════════
// TRON / TRC20 BROADCAST
// ════════════════════════════════════════
export async function broadcastTRON(toAddress, amount, currency = 'TRX') {
    console.log('[BROADCAST-TRON] ══════════════════════════');
    console.log('[BROADCAST-TRON] To:', toAddress);
    console.log('[BROADCAST-TRON] Amount:', amount, currency);

    const hotWallet = await Wallet.findOne({
        walletType: 'hot',
        network: 'TRON',
    });

    if (!hotWallet) {
        console.error('[BROADCAST-TRON] ❌ Hot wallet not found');
        throw new Error('TRON hot wallet not found');
    }

    console.log('[BROADCAST-TRON] Hot wallet:', hotWallet.address);

    const privateKey = decryptPrivateKey(
        hotWallet.encryptedPrivateKey,
        hotWallet.privateKeyIv,
        hotWallet.privateKeyAuthTag
    );

    const tronWeb = new TronWeb({
        fullHost: process.env.TRON_RPC_URL || 'https://api.trongrid.io',
        privateKey,
    });

    console.log('[BROADCAST-TRON] TronWeb initialized');

    if (currency === 'TRX') {
        const amountSun = Math.round(amount * 1_000_000);
        console.log('[BROADCAST-TRON] Amount in SUN:', amountSun);

        const tx = await tronWeb.trx.sendTransaction(toAddress, amountSun);
        console.log('[BROADCAST-TRON] ✅ TX result:', JSON.stringify(tx));

        if (!tx.result) {
            throw new Error('TRON TX failed: ' + JSON.stringify(tx));
        }

        console.log('[BROADCAST-TRON] ✅ TX hash:', tx.txid);
        return tx.txid;

    } else if (currency === 'USDT_TRC20') {
        const USDT_TRC20_CONTRACT = process.env.USDT_TRC20_CONTRACT ||
            'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

        console.log('[BROADCAST-TRON] USDT TRC20 contract:', USDT_TRC20_CONTRACT);

        const contract = await tronWeb.contract().at(USDT_TRC20_CONTRACT);
        const amountUnits = Math.round(amount * 1_000_000); // USDT has 6 decimals

        console.log('[BROADCAST-TRON] Amount units:', amountUnits);

        const tx = await contract.transfer(toAddress, amountUnits).send({
            feeLimit: 100_000_000,
            callValue: 0,
        });

        console.log('[BROADCAST-TRON] ✅ USDT TX hash:', tx);
        return tx;
    }

    throw new Error('Unsupported TRON currency: ' + currency);
}

// ════════════════════════════════════════
// SOLANA BROADCAST
// ════════════════════════════════════════
export async function broadcastSOL(toAddress, amount, currency = 'SOL') {
    console.log('[BROADCAST-SOL] ══════════════════════════');
    console.log('[BROADCAST-SOL] To:', toAddress);
    console.log('[BROADCAST-SOL] Amount:', amount, currency);

    const hotWallet = await Wallet.findOne({
        walletType: 'hot',
        network: 'SOL',
    });

    if (!hotWallet) {
        console.error('[BROADCAST-SOL] ❌ Hot wallet not found');
        throw new Error('SOL hot wallet not found');
    }

    const privateKey = decryptPrivateKey(
        hotWallet.encryptedPrivateKey,
        hotWallet.privateKeyIv,
        hotWallet.privateKeyAuthTag
    );

    const connection = new Connection(
        process.env.SOL_RPC_URL || 'https://api.mainnet-beta.solana.com',
        'confirmed'
    );

    const keypair = Keypair.fromSecretKey(
        Buffer.from(privateKey, 'hex')
    );

    console.log('[BROADCAST-SOL] Hot wallet:', keypair.publicKey.toString());

    if (currency === 'SOL') {
        const lamports = Math.round(amount * LAMPORTS_PER_SOL);
        console.log('[BROADCAST-SOL] Lamports:', lamports);

        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: keypair.publicKey,
                toPubkey: new PublicKey(toAddress),
                lamports,
            })
        );

        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [keypair]
        );

        console.log('[BROADCAST-SOL] ✅ TX signature:', signature);
        return signature;
    }

    throw new Error('Unsupported SOL currency: ' + currency);
}

// ════════════════════════════════════════
// BTC BROADCAST
// ════════════════════════════════════════
export async function broadcastBTC(toAddress, amount) {
    console.log('[BROADCAST-BTC] ══════════════════════════');
    console.log('[BROADCAST-BTC] To:', toAddress);
    console.log('[BROADCAST-BTC] Amount:', amount, 'BTC');

    const hotWallet = await Wallet.findOne({
        walletType: 'hot',
        network: 'BTC',
    });

    if (!hotWallet) {
        console.error('[BROADCAST-BTC] ❌ Hot wallet not found');
        throw new Error('BTC hot wallet not found');
    }

    const privateKey = decryptPrivateKey(
        hotWallet.encryptedPrivateKey,
        hotWallet.privateKeyIv,
        hotWallet.privateKeyAuthTag
    );

    console.log('[BROADCAST-BTC] Hot wallet:', hotWallet.address);

    // Use bitcoinjs-lib for transaction building
    const bitcoin = await import('bitcoinjs-lib');
    const ECPair = await import('ecpair');
    const ecc = await import('tiny-secp256k1');

    const network = process.env.BTC_NETWORK === 'mainnet'
        ? bitcoin.networks.bitcoin
        : bitcoin.networks.testnet;

    console.log('[BROADCAST-BTC] Network:', process.env.BTC_NETWORK || 'testnet');

    const keyPair = ECPair.ECPairFactory(ecc.default || ecc).fromWIF(privateKey, network);

    // Fetch UTXOs from API
    const utxoUrl = process.env.BTC_NETWORK === 'mainnet'
        ? `https://blockstream.info/api/address/${hotWallet.address}/utxo`
        : `https://blockstream.info/testnet/api/address/${hotWallet.address}/utxo`;

    console.log('[BROADCAST-BTC] Fetching UTXOs from:', utxoUrl);

    const utxoRes = await fetch(utxoUrl);
    const utxos = await utxoRes.json();

    console.log('[BROADCAST-BTC] UTXOs found:', utxos.length);

    if (!utxos.length) {
        throw new Error('No UTXOs available for BTC hot wallet');
    }

    const psbt = new bitcoin.Psbt({ network });
    const amountSats = Math.round(amount * 100_000_000);
    const feeSats = Math.round(0.0001 * 100_000_000); // static fee
    const totalNeeded = amountSats + feeSats;

    console.log('[BROADCAST-BTC] Amount sats:', amountSats);
    console.log('[BROADCAST-BTC] Fee sats:', feeSats);
    console.log('[BROADCAST-BTC] Total needed:', totalNeeded);

    let inputTotal = 0;

    for (const utxo of utxos) {
        if (inputTotal >= totalNeeded) break;

        // Fetch raw tx for input
        const txUrl = process.env.BTC_NETWORK === 'mainnet'
            ? `https://blockstream.info/api/tx/${utxo.txid}/hex`
            : `https://blockstream.info/testnet/api/tx/${utxo.txid}/hex`;

        const txRes = await fetch(txUrl);
        const txHex = await txRes.text();

        psbt.addInput({
            hash: utxo.txid,
            index: utxo.vout,
            nonWitnessUtxo: Buffer.from(txHex, 'hex'),
        });

        inputTotal += utxo.value;
        console.log('[BROADCAST-BTC] Added input:', utxo.txid, 'value:', utxo.value);
    }

    if (inputTotal < totalNeeded) {
        throw new Error(`Insufficient BTC: have ${inputTotal} sats, need ${totalNeeded}`);
    }

    // Output to recipient
    psbt.addOutput({
        address: toAddress,
        value: amountSats,
    });

    // Change back to hot wallet
    const change = inputTotal - totalNeeded;
    if (change > 546) { // dust threshold
        psbt.addOutput({
            address: hotWallet.address,
            value: change,
        });
        console.log('[BROADCAST-BTC] Change output:', change, 'sats');
    }

    // Sign all inputs
    psbt.signAllInputs(keyPair);
    psbt.finalizeAllInputs();

    const txHex = psbt.extractTransaction().toHex();
    console.log('[BROADCAST-BTC] TX hex built, broadcasting...');

    // Broadcast
    const broadcastUrl = process.env.BTC_NETWORK === 'mainnet'
        ? 'https://blockstream.info/api/tx'
        : 'https://blockstream.info/testnet/api/tx';

    const broadcastRes = await fetch(broadcastUrl, {
        method: 'POST',
        body: txHex,
    });

    if (!broadcastRes.ok) {
        const err = await broadcastRes.text();
        console.error('[BROADCAST-BTC] ❌ Broadcast failed:', err);
        throw new Error('BTC broadcast failed: ' + err);
    }

    const txHash = await broadcastRes.text();
    console.log('[BROADCAST-BTC] ✅ TX hash:', txHash);
    return txHash;
}

// ════════════════════════════════════════
// MAIN ROUTER - called by withdrawal controller
// ════════════════════════════════════════
export async function broadcastFromHotWallet(
    network, toAddress, amount, currency
) {
    console.log('[BROADCAST] ══════════════════════════════');
    console.log('[BROADCAST] Network:', network);
    console.log('[BROADCAST] To:', toAddress);
    console.log('[BROADCAST] Amount:', amount);
    console.log('[BROADCAST] Currency:', currency);

    switch (network) {
        case 'ETH':
        case 'USDT_ERC20':
            return await broadcastETH(toAddress, amount, currency);
        case 'TRON':
        case 'USDT_TRC20':
            return await broadcastTRON(toAddress, amount, currency);
        case 'SOL':
            return await broadcastSOL(toAddress, amount, currency);
        case 'BTC':
            return await broadcastBTC(toAddress, amount);
        default:
            console.error('[BROADCAST] ❌ Unsupported network:', network);
            throw new Error('Unsupported network: ' + network);
    }
}
