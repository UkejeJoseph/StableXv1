import * as bip39 from 'bip39';

import * as bitcoin from 'bitcoinjs-lib';
import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';
import * as tinysecp from 'tiny-secp256k1';
import { BIP32Factory } from 'bip32';

const bip32algo = BIP32Factory(tinysecp);

// Helper to generate a new mnemonic
export const generateMnemonic = () => {
    return bip39.generateMnemonic();
};

// Helper to derive wallets from mnemonic using a per-user derivation index
export const deriveWallets = async (mnemonic, derivationIndex = 0) => {
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const root = bip32algo.fromSeed(seed);

    const wallets = [];

    // 1. Bitcoin (Segwit P2WPKH) - Path m/84'/0'/0'/0/{index}
    const btcPath = `m/84'/0'/0'/0/${derivationIndex}`;
    const btcChild = root.derivePath(btcPath);
    const { address: btcAddress } = bitcoin.payments.p2wpkh({
        pubkey: btcChild.publicKey,
        network: bitcoin.networks.bitcoin,
    });
    wallets.push({
        currency: 'BTC',
        address: btcAddress,
        privateKey: btcChild.toWIF(),
    });

    // 2. Ethereum (ERC20 uses same address) - Path m/44'/60'/0'/0/{index}
    const ethPath = `m/44'/60'/0'/0/${derivationIndex}`;
    const ethSeed = await bip39.mnemonicToSeed(mnemonic);
    const ethRoot = bip32algo.fromSeed(ethSeed);
    const ethChild = ethRoot.derivePath(ethPath);
    const ethPrivKey = '0x' + ethChild.privateKey.toString('hex');
    const ethWallet = new (await import('ethers')).ethers.Wallet(ethPrivKey);
    wallets.push({
        currency: 'ETH',
        address: ethWallet.address,
        privateKey: ethWallet.privateKey,
    });
    // USDT ERC20 (same address as ETH)
    wallets.push({
        currency: 'USDT_ERC20',
        address: ethWallet.address,
        privateKey: ethWallet.privateKey,
    });

    // 3. Solana - Path m/44'/501'/{index}'/0'
    const { derivePath } = await import('ed25519-hd-key');
    const solDerivationPath = `m/44'/501'/${derivationIndex}'/0'`;
    const derivedSeed = derivePath(solDerivationPath, seed.toString('hex')).key;
    const solKeypair = Keypair.fromSeed(derivedSeed);
    wallets.push({
        currency: 'SOL',
        address: solKeypair.publicKey.toBase58(),
        privateKey: Buffer.from(solKeypair.secretKey).toString('hex'),
    });

    // 4. TRON (USDT TRC20, TRX, etc.) - Derived from ETH key at same index
    const TronWebModule = await import('tronweb');
    const TronWeb = TronWebModule.TronWeb;
    const tronWeb = new TronWeb({
        fullHost: 'https://api.trongrid.io',
        privateKey: ethWallet.privateKey.replace('0x', '')
    });

    const tronAddress = tronWeb.address.fromPrivateKey(ethWallet.privateKey.replace('0x', ''));

    wallets.push({
        currency: 'TRX',
        address: tronAddress,
        privateKey: ethWallet.privateKey,
    });
    wallets.push({
        currency: 'USDT_TRC20',
        address: tronAddress,
        privateKey: ethWallet.privateKey,
    });
    wallets.push({
        currency: 'ETH_TRC20',
        address: tronAddress,
        privateKey: ethWallet.privateKey,
    });
    wallets.push({
        currency: 'SOL_TRC20',
        address: tronAddress,
        privateKey: ethWallet.privateKey,
    });

    // 5. Fiat (Nigerian Naira - NGN)
    wallets.push({
        currency: 'NGN',
        address: "INTERNAL_NGN",
        privateKey: "N/A"
    });

    return wallets;
};
