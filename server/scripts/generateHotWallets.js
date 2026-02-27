/**
 * StableX Hot Wallet Generator
 * Generates 4 INDEPENDENT hot wallets and saves them to a JSON file.
 * 
 * USAGE:  node server/scripts/generateHotWallets.js
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as tinysecp from 'tiny-secp256k1';
import { BIP32Factory } from 'bip32';
import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';
import * as bip39 from 'bip39';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

bitcoin.initEccLib(tinysecp);
const bip32 = BIP32Factory(tinysecp);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const result = {};

// --- 1. BTC Hot Wallet ---
const btcMnemonic = bip39.generateMnemonic(256);
const btcSeed = bip39.mnemonicToSeedSync(btcMnemonic);
const btcRoot = bip32.fromSeed(btcSeed, bitcoin.networks.bitcoin);
const btcChild = btcRoot.derivePath("m/84'/0'/0'/0/0");
const { address: btcAddress } = bitcoin.payments.p2wpkh({
    pubkey: btcChild.publicKey,
    network: bitcoin.networks.bitcoin,
});

result.BTC = {
    address: btcAddress,
    privateKey: btcChild.toWIF(),
    mnemonic: btcMnemonic,
    network: 'Bitcoin Mainnet (Segwit/Bech32)',
};

// --- 2. ETH Hot Wallet ---
const ethWallet = ethers.Wallet.createRandom();

result.ETH = {
    address: ethWallet.address,
    privateKey: ethWallet.privateKey,
    mnemonic: ethWallet.mnemonic.phrase,
    network: 'Ethereum Mainnet (ERC20)',
};

// --- 3. TRON Hot Wallet (also USDT TRC20) ---
const TronWebModule = await import('tronweb');
const TronWeb = TronWebModule.TronWeb;

const tronPrivKeyBytes = crypto.randomBytes(32);
const tronPrivKey = tronPrivKeyBytes.toString('hex');

const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    privateKey: tronPrivKey
});
const tronAddress = tronWeb.address.fromPrivateKey(tronPrivKey);

result.TRON = {
    address: tronAddress,
    privateKey: tronPrivKey,
    network: 'TRON Mainnet (TRC20) - also serves USDT TRC20 and TRX',
};

// --- 4. SOL Hot Wallet ---
const solKeypair = Keypair.generate();
const solAddress = solKeypair.publicKey.toBase58();
const solPrivKey = Buffer.from(solKeypair.secretKey).toString('hex');

result.SOL = {
    address: solAddress,
    privateKey: solPrivKey,
    network: 'Solana Mainnet',
};

// --- Build .env lines ---
const envLines = [
    '# --- BTC HOT WALLET (Generated) ---',
    `STABLEX_HOT_WALLET_BTC=${result.BTC.address}`,
    `STABLEX_HOT_WALLET_BTC_PRIVATE_KEY=${result.BTC.privateKey}`,
    '',
    '# --- ETH HOT WALLET (Generated) ---',
    `STABLEX_HOT_WALLET_ETH=${result.ETH.address}`,
    `STABLEX_HOT_WALLET_ETH_PRIVATE_KEY=${result.ETH.privateKey}`,
    '',
    '# --- TRON / USDT TRC20 HOT WALLET (Generated) ---',
    `STABLEX_HOT_WALLET_TRC20=${result.TRON.address}`,
    `STABLEX_HOT_WALLET_TRC20_PRIVATE_KEY=${result.TRON.privateKey}`,
    `STABLEX_TREASURY_TRC20_PRIVATE_KEY=${result.TRON.privateKey}`,
    '',
    '# --- SOL HOT WALLET (Generated) ---',
    `STABLEX_HOT_WALLET_SOL=${result.SOL.address}`,
    `STABLEX_HOT_WALLET_SOL_PRIVATE_KEY=${result.SOL.privateKey}`,
].join('\n');

result.envBlock = envLines;

// Save to file
const outputPath = path.join(__dirname, 'HOT_WALLETS.json');
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');

// Also save env block separately
const envPath = path.join(__dirname, 'HOT_WALLETS_ENV.txt');
fs.writeFileSync(envPath, envLines, 'utf8');

console.log('Hot wallets generated successfully!');
console.log('Keys saved to: server/scripts/HOT_WALLETS.json');
console.log('Env block saved to: server/scripts/HOT_WALLETS_ENV.txt');
console.log('');
console.log('IMPORTANT: Import the private keys into Trust Wallet, then delete these files!');
