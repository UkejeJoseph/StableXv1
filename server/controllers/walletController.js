import Wallet from '../models/walletModel.js';
import { encrypt } from '../utils/encryption.js';
import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';
import { HDKey } from '@scure/bip32';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { base58check } from '@scure/base';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { ripemd160 } from '@noble/hashes/legacy.js';
import { hmac } from '@noble/hashes/hmac.js';
import { Buffer } from 'buffer';

const btcBase58check = base58check(sha256);

// --- Backend Generator Functions ---
function createBTCWallet() {
    const mnemonic = bip39.generateMnemonic(wordlist);
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const hdKey = HDKey.fromMasterSeed(seed);
    const derived = hdKey.derive("m/44'/0'/0'/0/0");

    const address = generateBTCP2PKHAddress(derived.publicKey);
    const privateKey = Buffer.from(derived.privateKey).toString("hex");
    return { address, privateKey, mnemonic };
}

function generateBTCP2PKHAddress(publicKey) {
    const sha256Hash = sha256(publicKey);
    const ripemd160Hash = ripemd160(sha256Hash);
    const versionedPayload = new Uint8Array(21);
    versionedPayload[0] = 0x00;
    versionedPayload.set(ripemd160Hash, 1);
    return btcBase58check.encode(versionedPayload);
}

function createETHWallet() {
    const mnemonic = bip39.generateMnemonic(wordlist);
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const hdKey = HDKey.fromMasterSeed(seed);
    const derived = hdKey.derive("m/44'/60'/0'/0/0");

    const privateKeyHex = Buffer.from(derived.privateKey).toString("hex");
    const wallet = new ethers.Wallet("0x" + privateKeyHex);
    return { address: wallet.address, privateKey: wallet.privateKey, mnemonic };
}

function createSOLWallet() {
    const mnemonic = bip39.generateMnemonic(wordlist);
    const seed = bip39.mnemonicToSeedSync(mnemonic);

    const pathParts = "m/44'/501'/0'/0'".replace("m/", "").split("/");
    let key = hmac(sha512, new TextEncoder().encode("ed25519 seed"), seed);

    for (const part of pathParts) {
        const isHardened = part.endsWith("'");
        const index = parseInt(part.replace("'", ""), 10) + (isHardened ? 0x80000000 : 0);
        const data = new Uint8Array(37);
        data[0] = 0x00;
        data.set(key.slice(0, 32), 1);
        const indexBytes = new Uint8Array(4);
        indexBytes[0] = (index >>> 24) & 0xff;
        indexBytes[1] = (index >>> 16) & 0xff;
        indexBytes[2] = (index >>> 8) & 0xff;
        indexBytes[3] = index & 0xff;
        data.set(indexBytes, 33);
        key = hmac(sha512, key.slice(32), data);
    }
    const derivedSeed = key.slice(0, 32);

    const keypair = Keypair.fromSeed(derivedSeed);
    return {
        address: keypair.publicKey.toBase58(),
        privateKey: Buffer.from(keypair.secretKey).toString("hex"),
        mnemonic
    };
}

function ethAddressToTronAddress(ethAddress) {
    const addressHex = ethAddress.slice(2).toLowerCase();
    const tronAddressHex = "41" + addressHex;
    const bytes = new Uint8Array(tronAddressHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(tronAddressHex.substr(i * 2, 2), 16);
    }

    const hash1 = sha256(bytes);
    const hash2 = sha256(hash1);
    const checksum = hash2.slice(0, 4);
    const combined = new Uint8Array(bytes.length + 4);
    combined.set(bytes);
    combined.set(checksum, bytes.length);

    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let num = BigInt(0);
    for (const byte of combined) {
        num = num * BigInt(256) + BigInt(byte);
    }
    let result = "";
    while (num > 0) {
        const remainder = num % BigInt(58);
        num = num / BigInt(58);
        result = ALPHABET[Number(remainder)] + result;
    }
    for (const byte of combined) {
        if (byte === 0) result = "1" + result;
        else break;
    }
    return result;
}

function createUSDT_TRC20Wallet() {
    const mnemonic = bip39.generateMnemonic(wordlist);
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const hdKey = HDKey.fromMasterSeed(seed);
    const derived = hdKey.derive("m/44'/195'/0'/0/0");

    const privateKeyHex = Buffer.from(derived.privateKey).toString("hex");
    const wallet = new ethers.Wallet("0x" + privateKeyHex);
    const tronAddress = ethAddressToTronAddress(wallet.address);

    return { address: tronAddress, privateKey: "0x" + privateKeyHex, mnemonic };
}

// XRP and generic ERC20 generators follow similar patterns, omitted for brevity but they route to ETH for ERC20s.

export const generateWallet = async (req, res) => {
    try {
        const { network } = req.body;
        if (!network) {
            return res.status(400).json({ message: 'Network is required' });
        }

        // Check if user already has a wallet for this network
        const existingWallet = await Wallet.findOne({ user: req.user._id, network });
        if (existingWallet) {
            return res.status(400).json({ message: `You already have a ${network} wallet generated.` });
        }

        let walletData;
        switch (network) {
            case 'BTC':
                walletData = createBTCWallet();
                break;
            case 'ETH':
            case 'USDT_ERC20':
            case 'USDC_ERC20':
            case 'WBTC':
            case 'DAI':
                walletData = createETHWallet();
                break;
            case 'SOL':
                walletData = createSOLWallet();
                break;
            case 'TRX':
            case 'USDT_TRC20':
                walletData = createUSDT_TRC20Wallet();
                break;
            default:
                // Default to ETH gen for unknown ERC20s or throw
                walletData = createETHWallet();
        }

        // Encrypt private key and mnemonic with our AES-256-GCM utility
        const encryptedPrivKey = encrypt(walletData.privateKey);
        const encryptedMnem = encrypt(walletData.mnemonic);

        const newWallet = await Wallet.create({
            user: req.user._id,
            walletType: req.user.role === 'merchant' ? 'merchant' : 'user',
            network,
            address: walletData.address,
            encryptedPrivateKey: encryptedPrivKey.encryptedData,
            privateKeyIv: encryptedPrivKey.iv,
            privateKeyAuthTag: encryptedPrivKey.authTag,
            encryptedMnemonic: encryptedMnem.encryptedData,
            mnemonicIv: encryptedMnem.iv,
            mnemonicAuthTag: encryptedMnem.authTag,
        });

        res.status(201).json({
            message: 'Wallet generated successfully',
            _id: newWallet._id,
            address: newWallet.address,
            network: newWallet.network,
        });
    } catch (error) {
        console.error('Wallet generation error:', error);
        res.status(500).json({ message: 'Failed to generate wallet' });
    }
};
export const importWallet = async (req, res) => {
    try {
        const { network, importMethod, importValue } = req.body;
        if (!network || !importMethod || !importValue) {
            return res.status(400).json({ message: 'Network, method, and value are required' });
        }

        const existingWallet = await Wallet.findOne({ user: req.user._id, network });
        if (existingWallet) {
            return res.status(400).json({ message: `You already have a ${network} wallet.` });
        }

        let walletData = { address: '', privateKey: '', mnemonic: '' };

        try {
            if (importMethod === 'mnemonic') {
                const mnemonic = importValue.trim();
                const seed = bip39.mnemonicToSeedSync(mnemonic);
                const hdKey = HDKey.fromMasterSeed(seed);

                if (network === 'BTC') {
                    const derived = hdKey.derive("m/44'/0'/0'/0/0");
                    walletData.privateKey = Buffer.from(derived.privateKey).toString("hex");
                    walletData.address = generateBTCP2PKHAddress(derived.publicKey);
                    walletData.mnemonic = mnemonic;
                } else if (network === 'SOL') {
                    const pathParts = "m/44'/501'/0'/0'".replace("m/", "").split("/");
                    let key = hmac(sha512, new TextEncoder().encode("ed25519 seed"), seed);
                    for (const part of pathParts) {
                        const isHardened = part.endsWith("'");
                        const index = parseInt(part.replace("'", ""), 10) + (isHardened ? 0x80000000 : 0);
                        const data = new Uint8Array(37);
                        data[0] = 0x00;
                        data.set(key.slice(0, 32), 1);
                        const indexBytes = new Uint8Array(4);
                        indexBytes[0] = (index >>> 24) & 0xff;
                        indexBytes[1] = (index >>> 16) & 0xff;
                        indexBytes[2] = (index >>> 8) & 0xff;
                        indexBytes[3] = index & 0xff;
                        data.set(indexBytes, 33);
                        key = hmac(sha512, key.slice(32), data);
                    }
                    const derivedSeed = key.slice(0, 32);
                    const keypair = Keypair.fromSeed(derivedSeed);
                    walletData.address = keypair.publicKey.toBase58();
                    walletData.privateKey = Buffer.from(keypair.secretKey).toString("hex");
                    walletData.mnemonic = mnemonic;
                } else if (network === 'TRX' || network === 'USDT_TRC20') {
                    const derived = hdKey.derive("m/44'/195'/0'/0/0");
                    const pkHex = Buffer.from(derived.privateKey).toString("hex");
                    const wallet = new ethers.Wallet("0x" + pkHex);
                    walletData.address = ethAddressToTronAddress(wallet.address);
                    walletData.privateKey = "0x" + pkHex;
                    walletData.mnemonic = mnemonic;
                } else {
                    const derived = hdKey.derive("m/44'/60'/0'/0/0");
                    const pkHex = Buffer.from(derived.privateKey).toString("hex");
                    const wallet = new ethers.Wallet("0x" + pkHex);
                    walletData.address = wallet.address;
                    walletData.privateKey = wallet.privateKey;
                    walletData.mnemonic = mnemonic;
                }
            } else if (importMethod === 'privateKey') {
                const privateKey = importValue.trim();

                if (network === 'BTC') {
                    const signingKey = new ethers.SigningKey("0x" + privateKey);
                    const compressedPubKey = Buffer.from(signingKey.compressedPublicKey.slice(2), 'hex');
                    walletData.address = generateBTCP2PKHAddress(compressedPubKey);
                    walletData.privateKey = privateKey;
                } else if (network === 'SOL') {
                    // Solana exact expected behavior on pk import
                    throw new Error("Solana private key import not fully supported in this demo without bs58 parsing.");
                } else if (network === 'TRX' || network === 'USDT_TRC20') {
                    const wallet = new ethers.Wallet(privateKey);
                    walletData.address = ethAddressToTronAddress(wallet.address);
                    walletData.privateKey = wallet.privateKey;
                } else {
                    const wallet = new ethers.Wallet(privateKey);
                    walletData.address = wallet.address;
                    walletData.privateKey = wallet.privateKey;
                }
            }
        } catch (err) {
            return res.status(400).json({ message: 'Invalid ' + importMethod });
        }

        const encryptedPrivKey = encrypt(walletData.privateKey);
        const encryptedMnem = encrypt(walletData.mnemonic || 'none');

        const newWallet = await Wallet.create({
            user: req.user._id,
            walletType: req.user.role === 'merchant' ? 'merchant' : 'user',
            network,
            address: walletData.address,
            encryptedPrivateKey: encryptedPrivKey.encryptedData,
            privateKeyIv: encryptedPrivKey.iv,
            privateKeyAuthTag: encryptedPrivKey.authTag,
            encryptedMnemonic: encryptedMnem.encryptedData,
            mnemonicIv: encryptedMnem.iv,
            mnemonicAuthTag: encryptedMnem.authTag,
        });

        res.status(201).json({
            message: 'Wallet imported successfully',
            _id: newWallet._id,
            address: newWallet.address,
            network: newWallet.network,
        });
    } catch (error) {
        console.error('Wallet import error:', error);
        res.status(500).json({ message: 'Failed to import wallet' });
    }
};

export const getUserWallets = async (req, res) => {
    try {
        let wallets = await Wallet.find({ user: req.user._id }).select('-encryptedPrivateKey -privateKeyIv -privateKeyAuthTag -encryptedMnemonic -mnemonicIv -mnemonicAuthTag -__v -user');

        const mandatoryCurrencies = ['NGN', 'BTC', 'ETH', 'SOL', 'USDT_TRC20', 'USDT_ERC20'];
        const existingCurrencies = wallets.map(w => w.currency);
        const missingCurrencies = mandatoryCurrencies.filter(c => !existingCurrencies.includes(c));

        if (missingCurrencies.length > 0) {
            console.log(`[WALLETS] 🛠️ Backfilling ${missingCurrencies.length} missing wallets for user ${req.user._id}...`);
            const user = await User.findById(req.user._id);
            if (user && user.encryptedMnemonic) {
                // We have a mnemonic, use it to derive missing ones
                try {
                    const { decrypt } = await import('../utils/encryption.js');
                    const mnemonic = decrypt({
                        encryptedData: user.encryptedMnemonic,
                        iv: user.mnemonicIv,
                        authTag: user.mnemonicAuthTag
                    });

                    const { deriveWallets } = await import('../utils/walletGenerator.js');
                    const allDerived = await deriveWallets(mnemonic, user.walletDerivationIndex || 0);

                    const toInsert = allDerived
                        .filter(w => missingCurrencies.includes(w.currency))
                        .map(w => {
                            const { encrypt } = require('../utils/encryption.js');
                            const { encryptedData, iv, authTag } = encrypt(w.privateKey);
                            return {
                                user: user._id,
                                walletType: user.role === 'merchant' ? 'merchant' : 'user',
                                currency: w.currency,
                                address: w.address,
                                encryptedPrivateKey: encryptedData,
                                iv,
                                authTag
                            };
                        });

                    if (toInsert.length > 0) {
                        await Wallet.insertMany(toInsert);
                        // Re-fetch wallets after insertion
                        wallets = await Wallet.find({ user: req.user._id }).select('-encryptedPrivateKey -privateKeyIv -privateKeyAuthTag -encryptedMnemonic -mnemonicIv -mnemonicAuthTag -__v -user');
                    }
                } catch (deriveError) {
                    console.error('[WALLETS] ❌ Failed to derive missing wallets:', deriveError);
                }
            } else if (user) {
                // No mnemonic yet? This shouldn't happen for new users but might for old ones
                console.log(`[WALLETS] 🔑 Generating new mnemonic for legacy user ${user._id}`);
                const { generateMnemonic, deriveWallets } = await import('../utils/walletGenerator.js');
                const mnemonic = generateMnemonic();
                const { encrypt } = await import('../utils/encryption.js');
                const encryptedPhrase = encrypt(mnemonic);

                user.encryptedMnemonic = encryptedPhrase.encryptedData;
                user.mnemonicIv = encryptedPhrase.iv;
                user.mnemonicAuthTag = encryptedPhrase.authTag;
                await user.save();

                const allDerived = await deriveWallets(mnemonic, 0);
                const toInsert = allDerived.map(w => {
                    const { encryptedData, iv, authTag } = encrypt(w.privateKey);
                    return {
                        user: user._id,
                        walletType: user.role === 'merchant' ? 'merchant' : 'user',
                        currency: w.currency,
                        address: w.address,
                        encryptedPrivateKey: encryptedData,
                        iv,
                        authTag
                    };
                });
                await Wallet.insertMany(toInsert);
                wallets = await Wallet.find({ user: req.user._id }).select('-encryptedPrivateKey -privateKeyIv -privateKeyAuthTag -encryptedMnemonic -mnemonicIv -mnemonicAuthTag -__v -user');
            }
        }

        res.status(200).json({ wallets });
    } catch (error) {
        console.error('[WALLETS] ❌ Error in getUserWallets:', error);
        res.status(500).json({ message: 'Failed to fetch wallets' });
    }
};

export const connectWallet = async (req, res) => {
    try {
        const { address, network } = req.body;
        if (!address || !network) {
            return res.status(400).json({ message: 'Address and network are required' });
        }

        const existingWallet = await Wallet.findOne({ user: req.user._id, network });
        if (existingWallet) {
            return res.status(400).json({ message: `You already have a ${network} wallet.` });
        }

        // Encrypt dummy data since this is a Web3 connected wallet that we don't have custody of
        const encryptedPrivKey = encrypt('EXTERNAL_WEB3_WALLET');
        const encryptedMnem = encrypt('EXTERNAL_WEB3_WALLET');

        const newWallet = await Wallet.create({
            user: req.user._id,
            walletType: req.user.role === 'merchant' ? 'merchant' : 'user',
            network,
            address,
            encryptedPrivateKey: encryptedPrivKey.encryptedData,
            privateKeyIv: encryptedPrivKey.iv,
            privateKeyAuthTag: encryptedPrivKey.authTag,
            encryptedMnemonic: encryptedMnem.encryptedData,
            mnemonicIv: encryptedMnem.iv,
            mnemonicAuthTag: encryptedMnem.authTag,
        });

        res.status(201).json({
            message: 'Web3 Wallet connected successfully',
            _id: newWallet._id,
            address: newWallet.address,
            network: newWallet.network,
        });
    } catch (error) {
        console.error('Wallet connect error:', error);
        res.status(500).json({ message: 'Failed to connect wallet' });
    }
};
