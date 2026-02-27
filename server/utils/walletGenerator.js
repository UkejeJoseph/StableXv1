import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';
import * as tinysecp from 'tiny-secp256k1';
import { BIP32Factory } from 'bip32';
import { derivePath } from 'ed25519-hd-key';

const bip32algo = BIP32Factory(tinysecp);

// ──────────────────────────────────────────────────────────────
// HD Wallet Generator (BIP44)
// ──────────────────────────────────────────────────────────────

/**
 * Generate a new master BIP39 mnemonic (24 words for high security)
 */
export const generateMnemonic = () => {
    return bip39.generateMnemonic(256); // 256 bits = 24 words
};

/**
 * Derive a single wallet for a specific network and index
 * @param {string} mnemonic - The master mnemonic
 * @param {string} network - BTC, ETH, SOL, TRON
 * @param {number} index - Derivation index
 */
export const deriveWallet = async (mnemonic, network, index = 0) => {
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const root = bip32algo.fromSeed(seed);

    switch (network) {
        case 'BTC': {
            const path = `m/44'/0'/0'/0/${index}`;
            const child = root.derivePath(path);
            const { address } = bitcoin.payments.p2pkh({
                pubkey: child.publicKey,
                network: bitcoin.networks.bitcoin,
            });
            return {
                currency: 'BTC',
                address,
                privateKey: child.toWIF()
            };
        }

        case 'ETH':
        case 'USDT_ERC20': {
            const path = `m/44'/60'/0'/0/${index}`;
            const child = root.derivePath(path);
            const privateKey = '0x' + Buffer.from(child.privateKey).toString('hex');
            const wallet = new ethers.Wallet(privateKey);
            return {
                currency: network,
                address: wallet.address,
                privateKey: wallet.privateKey
            };
        }

        case 'SOL': {
            const path = `m/44'/501'/${index}'/0'`; // all levels must be hardened for ed25519
            const derivedSeed = derivePath(path, seed.toString('hex')).key;
            const keypair = Keypair.fromSeed(derivedSeed);
            return {
                currency: 'SOL',
                address: keypair.publicKey.toBase58(),
                privateKey: Buffer.from(keypair.secretKey).toString('hex')
            };
        }

        case 'TRON':
        case 'USDT_TRC20': {
            const path = `m/44'/195'/0'/0/${index}`;
            const child = root.derivePath(path);
            const privateKey = Buffer.from(child.privateKey).toString('hex');

            // Derive TRON address from private key
            const { TronWeb } = await import('tronweb');
            const tronWeb = new TronWeb({ fullHost: 'https://api.trongrid.io' });
            const address = tronWeb.address.fromPrivateKey(privateKey);

            return {
                currency: network,
                address,
                privateKey: '0x' + privateKey
            };
        }

        default:
            throw new Error(`Unsupported network: ${network}`);
    }
};

/**
 * Derive all standard wallets at once (used during registration)
 */
export const deriveWallets = async (mnemonic, index = 0) => {
    const networks = ['BTC', 'ETH', 'SOL', 'USDT_TRC20'];
    const results = await Promise.all(networks.map(n => deriveWallet(mnemonic, n, index)));

    // Add USDT_ERC20 (same as ETH)
    const eth = results.find(r => r.currency === 'ETH');
    results.push({ ...eth, currency: 'USDT_ERC20' });

    // Add Fiat
    results.push({
        currency: 'NGN',
        address: "INTERNAL_NGN",
        privateKey: "N/A"
    });

    return results;
};

/**
 * Re-derives a private key on demand without storing it
 */
export const regeneratePrivateKey = async (userId, network) => {
    const User = (await import('../models/userModel.js')).default;
    const { decrypt } = await import('./encryption.js');

    const user = await User.findById(userId);
    if (!user || !user.encryptedMnemonic) {
        throw new Error('User mnemonic not found');
    }

    const mnemonic = decrypt(user.encryptedMnemonic, user.mnemonicIv, user.mnemonicAuthTag);
    const walletData = await deriveWallet(mnemonic, network, user.walletDerivationIndex || 0);

    return walletData.privateKey;
};
