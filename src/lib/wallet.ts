import { ethers } from "ethers";
import { Keypair } from "@solana/web3.js";
import { HDKey } from "@scure/bip32";
import * as bip39 from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { base58check } from "@scure/base";
import { sha256, sha512 } from "@noble/hashes/sha2.js";
import { ripemd160 } from "@noble/hashes/legacy.js";
import { hmac } from "@noble/hashes/hmac.js";
import { Buffer } from "buffer";

export type NetworkType =
  | "BTC"
  | "ETH"
  | "SOL"
  | "USDT_ERC20"
  | "USDT_TRC20"
  | "XRP"
  | "USDC_ERC20"
  | "WBTC"
  | "DAI"
  | "TRX"
  | "ETH_TRC20"
  | "SOL_TRC20";

export interface WalletData {
  address: string;
  privateKey: string;
  mnemonic: string;
  network: NetworkType;
}

export interface StoredWallet {
  address: string;
  network: NetworkType;
  currency?: string;
  createdAt: string;
}

const WALLETS_KEY = "user_wallets";
const ACTIVE_WALLET_KEY = "active_wallet";

const btcBase58check = base58check(sha256);

export function createBTCWallet(): WalletData {
  const mnemonic = bip39.generateMnemonic(wordlist);
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const hdKey = HDKey.fromMasterSeed(seed);
  const derived = hdKey.derive("m/44'/0'/0'/0/0");

  if (!derived.privateKey || !derived.publicKey) {
    throw new Error("Failed to derive BTC keys");
  }

  const address = generateBTCP2PKHAddress(derived.publicKey);
  const privateKeyHex = Buffer.from(derived.privateKey).toString("hex");

  return {
    address,
    privateKey: privateKeyHex,
    mnemonic,
    network: "BTC",
  };
}

function generateBTCP2PKHAddress(publicKey: Uint8Array): string {
  const sha256Hash = sha256(publicKey);
  const ripemd160Hash = ripemd160(sha256Hash);
  const versionedPayload = new Uint8Array(21);
  versionedPayload[0] = 0x00;
  versionedPayload.set(ripemd160Hash, 1);
  return btcBase58check.encode(versionedPayload);
}

export function createETHWallet(): WalletData {
  const mnemonic = bip39.generateMnemonic(wordlist);
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const hdKey = HDKey.fromMasterSeed(seed);
  const derived = hdKey.derive("m/44'/60'/0'/0/0");

  if (!derived.privateKey) {
    throw new Error("Failed to derive ETH keys");
  }

  const privateKeyHex = Buffer.from(derived.privateKey).toString("hex");
  const wallet = new ethers.Wallet("0x" + privateKeyHex);

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic,
    network: "ETH",
  };
}

export function createSOLWallet(): WalletData {
  const mnemonic = bip39.generateMnemonic(wordlist);
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const derivedSeed = deriveSOLSeed(seed, "m/44'/501'/0'/0'");
  const keypair = Keypair.fromSeed(derivedSeed);

  return {
    address: keypair.publicKey.toBase58(),
    privateKey: Buffer.from(keypair.secretKey).toString("hex"),
    mnemonic,
    network: "SOL",
  };
}

function deriveSOLSeed(seed: Uint8Array, path: string): Uint8Array {
  const pathParts = path.replace("m/", "").split("/");
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

  return key.slice(0, 32);
}

export function createUSDT_ERC20Wallet(): WalletData {
  const mnemonic = bip39.generateMnemonic(wordlist);
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const hdKey = HDKey.fromMasterSeed(seed);
  const derived = hdKey.derive("m/44'/60'/0'/0/0");

  if (!derived.privateKey) {
    throw new Error("Failed to derive ERC20 keys");
  }

  const privateKeyHex = Buffer.from(derived.privateKey).toString("hex");
  const wallet = new ethers.Wallet("0x" + privateKeyHex);

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic,
    network: "USDT_ERC20",
  };
}

export function createUSDT_TRC20Wallet(): WalletData {
  const mnemonic = bip39.generateMnemonic(wordlist);
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const hdKey = HDKey.fromMasterSeed(seed);
  const derived = hdKey.derive("m/44'/195'/0'/0/0");

  if (!derived.privateKey) {
    throw new Error("Failed to derive TRC20 keys");
  }

  const privateKeyHex = Buffer.from(derived.privateKey).toString("hex");
  const wallet = new ethers.Wallet("0x" + privateKeyHex);
  const tronAddress = ethAddressToTronAddress(wallet.address);

  return {
    address: tronAddress,
    privateKey: "0x" + privateKeyHex,
    mnemonic,
    network: "USDT_TRC20",
  };
}

export function createXRPWallet(): WalletData {
  const mnemonic = bip39.generateMnemonic(wordlist);
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const hdKey = HDKey.fromMasterSeed(seed);
  const derived = hdKey.derive("m/44'/144'/0'/0/0");

  if (!derived.privateKey || !derived.publicKey) {
    throw new Error("Failed to derive XRP keys");
  }

  const privateKeyHex = Buffer.from(derived.privateKey).toString("hex");
  const address = generateXRPAddress(derived.publicKey);

  return {
    address,
    privateKey: privateKeyHex,
    mnemonic,
    network: "XRP",
  };
}

function generateXRPAddress(publicKey: Uint8Array): string {
  const sha256Hash = sha256(publicKey);
  const ripemd160Hash = ripemd160(sha256Hash);
  const payload = new Uint8Array(21);
  payload[0] = 0x00;
  payload.set(ripemd160Hash, 1);
  const hash1 = sha256(payload);
  const hash2 = sha256(hash1);
  const checksum = hash2.slice(0, 4);
  const combined = new Uint8Array(25);
  combined.set(payload);
  combined.set(checksum, 21);
  return xrpBase58Encode(combined);
}

function xrpBase58Encode(data: Uint8Array): string {
  const ALPHABET = "rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz";
  let num = BigInt(0);
  for (const byte of data) {
    num = num * BigInt(256) + BigInt(byte);
  }
  let result = "";
  while (num > 0) {
    const remainder = num % BigInt(58);
    num = num / BigInt(58);
    result = ALPHABET[Number(remainder)] + result;
  }
  for (const byte of data) {
    if (byte === 0) {
      result = ALPHABET[0] + result;
    } else {
      break;
    }
  }
  return result;
}

function createERC20TokenWallet(network: NetworkType): WalletData {
  const mnemonic = bip39.generateMnemonic(wordlist);
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const hdKey = HDKey.fromMasterSeed(seed);
  const derived = hdKey.derive("m/44'/60'/0'/0/0");

  if (!derived.privateKey) {
    throw new Error(`Failed to derive ${network} keys`);
  }

  const privateKeyHex = Buffer.from(derived.privateKey).toString("hex");
  const wallet = new ethers.Wallet("0x" + privateKeyHex);

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic,
    network,
  };
}

export function createWallet(network: NetworkType): WalletData {
  switch (network) {
    case "BTC":
      return createBTCWallet();
    case "ETH":
      return createETHWallet();
    case "SOL":
      return createSOLWallet();
    case "USDT_ERC20":
      return createUSDT_ERC20Wallet();
    case "USDT_TRC20":
      return createUSDT_TRC20Wallet();
    case "XRP":
      return createXRPWallet();
    case "USDC_ERC20":
    case "WBTC":
    case "DAI":
      return createERC20TokenWallet(network);
    default:
      throw new Error(`Unsupported network: ${network}`);
  }
}

function ethAddressToTronAddress(ethAddress: string): string {
  const addressHex = ethAddress.slice(2).toLowerCase();
  const tronAddressHex = "41" + addressHex;
  const bytes = hexToBytes(tronAddressHex);
  return tronBase58CheckEncode(bytes);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function tronBase58CheckEncode(payload: Uint8Array): string {
  const hash1 = sha256(payload);
  const hash2 = sha256(hash1);
  const checksum = hash2.slice(0, 4);
  const combined = new Uint8Array(payload.length + 4);
  combined.set(payload);
  combined.set(checksum, payload.length);
  return base58Encode(combined);
}

function base58Encode(data: Uint8Array): string {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = BigInt(0);
  for (const byte of data) {
    num = num * BigInt(256) + BigInt(byte);
  }

  let result = "";
  while (num > 0) {
    const remainder = num % BigInt(58);
    num = num / BigInt(58);
    result = ALPHABET[Number(remainder)] + result;
  }

  for (const byte of data) {
    if (byte === 0) {
      result = "1" + result;
    } else {
      break;
    }
  }

  return result;
}

export function saveWalletReference(wallet: WalletData): void {
  const wallets = getStoredWallets();
  const storedWallet: StoredWallet = {
    address: wallet.address,
    network: wallet.network,
    createdAt: new Date().toISOString(),
  };

  const existingIndex = wallets.findIndex(
    (w) => w.address === wallet.address && w.network === wallet.network
  );

  if (existingIndex === -1) {
    wallets.push(storedWallet);
    localStorage.setItem(WALLETS_KEY, JSON.stringify(wallets));
  }
}

export function getStoredWallets(): StoredWallet[] {
  const stored = localStorage.getItem(WALLETS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function setActiveWallet(address: string, network: NetworkType): void {
  localStorage.setItem(ACTIVE_WALLET_KEY, JSON.stringify({ address, network }));
}

export function getActiveWallet(): { address: string; network: NetworkType } | null {
  const stored = localStorage.getItem(ACTIVE_WALLET_KEY);
  return stored ? JSON.parse(stored) : null;
}

export function removeWallet(address: string, network: NetworkType): void {
  const wallets = getStoredWallets().filter(
    (w) => !(w.address === address && w.network === network)
  );
  localStorage.setItem(WALLETS_KEY, JSON.stringify(wallets));

  const active = getActiveWallet();
  if (active && active.address === address && active.network === network) {
    localStorage.removeItem(ACTIVE_WALLET_KEY);
  }
}

export function importWalletFromMnemonic(mnemonic: string, network: NetworkType): WalletData {
  switch (network) {
    case "BTC": {
      const seed = bip39.mnemonicToSeedSync(mnemonic);
      const hdKey = HDKey.fromMasterSeed(seed);
      const derived = hdKey.derive("m/44'/0'/0'/0/0");
      if (!derived.privateKey || !derived.publicKey) {
        throw new Error("Failed to derive BTC keys");
      }
      const address = generateBTCP2PKHAddress(derived.publicKey);
      return { address, privateKey: Buffer.from(derived.privateKey).toString("hex"), mnemonic, network: "BTC" };
    }
    case "ETH":
    case "USDT_ERC20":
    case "USDC_ERC20":
    case "WBTC":
    case "DAI": {
      const seed = bip39.mnemonicToSeedSync(mnemonic);
      const hdKey = HDKey.fromMasterSeed(seed);
      const derived = hdKey.derive("m/44'/60'/0'/0/0");
      if (!derived.privateKey) {
        throw new Error("Failed to derive ETH/ERC20 keys");
      }
      const privateKeyHex = Buffer.from(derived.privateKey).toString("hex");
      const wallet = new ethers.Wallet("0x" + privateKeyHex);
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic,
        network,
      };
    }
    case "SOL": {
      const seed = bip39.mnemonicToSeedSync(mnemonic);
      const derivedSeed = deriveSOLSeed(seed, "m/44'/501'/0'/0'");
      const keypair = Keypair.fromSeed(derivedSeed);
      return {
        address: keypair.publicKey.toBase58(),
        privateKey: Buffer.from(keypair.secretKey).toString("hex"),
        mnemonic,
        network: "SOL",
      };
    }
    case "USDT_TRC20": {
      const seed = bip39.mnemonicToSeedSync(mnemonic);
      const hdKey = HDKey.fromMasterSeed(seed);
      const derived = hdKey.derive("m/44'/195'/0'/0/0");
      if (!derived.privateKey) {
        throw new Error("Failed to derive TRC20 keys");
      }
      const privateKeyHex = Buffer.from(derived.privateKey).toString("hex");
      const wallet = new ethers.Wallet("0x" + privateKeyHex);
      return {
        address: ethAddressToTronAddress(wallet.address),
        privateKey: "0x" + privateKeyHex,
        mnemonic,
        network: "USDT_TRC20",
      };
    }
    case "XRP": {
      const seed = bip39.mnemonicToSeedSync(mnemonic);
      const hdKey = HDKey.fromMasterSeed(seed);
      const derived = hdKey.derive("m/44'/144'/0'/0/0");
      if (!derived.privateKey || !derived.publicKey) {
        throw new Error("Failed to derive XRP keys");
      }
      const privateKeyHex = Buffer.from(derived.privateKey).toString("hex");
      const address = generateXRPAddress(derived.publicKey);
      return { address, privateKey: privateKeyHex, mnemonic, network: "XRP" };
    }
    default:
      throw new Error(`Unsupported network: ${network}`);
  }
}

export function importWalletFromPrivateKey(privateKey: string, network: NetworkType): WalletData {
  switch (network) {
    case "BTC": {
      const signingKey = new ethers.SigningKey("0x" + privateKey);
      const compressedPubKey = hexToBytes(signingKey.compressedPublicKey.slice(2));
      const address = generateBTCP2PKHAddress(compressedPubKey);
      return { address, privateKey, mnemonic: "", network: "BTC" };
    }
    case "ETH":
    case "USDT_ERC20":
    case "USDC_ERC20":
    case "WBTC":
    case "DAI": {
      const wallet = new ethers.Wallet(privateKey);
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: "",
        network,
      };
    }
    case "SOL": {
      const secretKey = hexToBytes(privateKey);
      const keypair = Keypair.fromSecretKey(secretKey);
      return {
        address: keypair.publicKey.toBase58(),
        privateKey,
        mnemonic: "",
        network: "SOL",
      };
    }
    case "USDT_TRC20": {
      const wallet = new ethers.Wallet(privateKey);
      return {
        address: ethAddressToTronAddress(wallet.address),
        privateKey: wallet.privateKey,
        mnemonic: "",
        network: "USDT_TRC20",
      };
    }
    case "XRP": {
      const signingKey = new ethers.SigningKey("0x" + privateKey);
      const compressedPubKey = hexToBytes(signingKey.compressedPublicKey.slice(2));
      const address = generateXRPAddress(compressedPubKey);
      return { address, privateKey, mnemonic: "", network: "XRP" };
    }
    default:
      throw new Error(`Unsupported network: ${network}`);
  }
}

export function getNetworkDisplayName(network: NetworkType): string {
  switch (network) {
    case "BTC":
      return "Bitcoin";
    case "ETH":
      return "Ethereum";
    case "SOL":
      return "Solana";
    case "USDT_ERC20":
      return "USDT (ERC20)";
    case "USDT_TRC20":
      return "USDT (TRC20)";
    case "XRP":
      return "XRP (Ripple)";
    case "USDC_ERC20":
      return "USDC (ERC20)";
    case "WBTC":
      return "Wrapped BTC (ERC20)";
    case "DAI":
      return "DAI (ERC20)";
    case "TRX":
      return "Tron (TRX)";
    case "ETH_TRC20":
      return "ETH (TRC20)";
    case "SOL_TRC20":
      return "SOL (TRC20)";
    default:
      return network;
  }
}
