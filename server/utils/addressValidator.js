import { TronWeb } from 'tronweb';
import { ethers } from 'ethers';
import { PublicKey } from '@solana/web3.js';

// ─── TRON ───────────────────────────────────────
export const validateTronAddress = (address) => {
    if (!address) return {
        valid: false,
        error: 'Address is required'
    };

    // Must start with T
    if (!address.startsWith('T')) return {
        valid: false,
        error: 'TRON address must start with T'
    };

    // Must be exactly 34 characters
    if (address.length !== 34) return {
        valid: false,
        error: 'TRON address must be 34 characters'
    };

    // Use TronWeb checksum validation
    try {
        const isValid = TronWeb.isAddress(address);
        return isValid
            ? { valid: true }
            : { valid: false, error: 'Invalid TRON address checksum' };
    } catch (err) {
        return { valid: false, error: 'Invalid TRON address format' };
    }
};

// ─── ETHEREUM ────────────────────────────────────
export const validateEthAddress = (address) => {
    if (!address) return {
        valid: false,
        error: 'Address is required'
    };

    // Must start with 0x
    if (!address.startsWith('0x')) return {
        valid: false,
        error: 'ETH address must start with 0x'
    };

    // Must be 42 characters (0x + 40 hex)
    if (address.length !== 42) return {
        valid: false,
        error: 'ETH address must be 42 characters'
    };

    // Use ethers.js checksum validation
    try {
        ethers.getAddress(address); // throws if invalid
        return { valid: true };
    } catch (err) {
        return {
            valid: false,
            error: 'Invalid ETH address checksum. Check the address and try again.'
        };
    }
};

// ─── BITCOIN ─────────────────────────────────────
export const validateBtcAddress = (address) => {
    if (!address) return {
        valid: false,
        error: 'Address is required'
    };

    // Legacy addresses (P2PKH): start with 1, 25-34 chars
    const legacyRegex = /^1[a-km-zA-HJ-NP-Z1-9]{24,33}$/;

    // P2SH addresses: start with 3, 25-34 chars  
    const p2shRegex = /^3[a-km-zA-HJ-NP-Z1-9]{24,33}$/;

    // Bech32 SegWit: start with bc1q, 42 chars
    const bech32Regex = /^bc1q[a-z0-9]{38,59}$/;

    // Bech32m Taproot: start with bc1p
    const taprootRegex = /^bc1p[a-z0-9]{58}$/;

    if (
        legacyRegex.test(address) ||
        p2shRegex.test(address) ||
        bech32Regex.test(address) ||
        taprootRegex.test(address)
    ) {
        return { valid: true };
    }

    // Determine specific error
    if (address.startsWith('1') || address.startsWith('3')) {
        return {
            valid: false,
            error: 'Invalid Bitcoin address format or length'
        };
    }
    if (address.startsWith('bc1')) {
        return {
            valid: false,
            error: 'Invalid Bech32 Bitcoin address'
        };
    }

    return {
        valid: false,
        error: 'Invalid Bitcoin address. Must start with 1, 3, or bc1'
    };
};

// ─── SOLANA ──────────────────────────────────────
export const validateSolAddress = (address) => {
    if (!address) return {
        valid: false,
        error: 'Address is required'
    };

    // SOL addresses are base58, 32-44 chars
    if (address.length < 32 || address.length > 44) {
        return {
            valid: false,
            error: 'Solana address must be 32-44 characters'
        };
    }

    // Use PublicKey validation from @solana/web3.js
    try {
        new PublicKey(address);
        return { valid: true };
    } catch (err) {
        return {
            valid: false,
            error: 'Invalid Solana address format'
        };
    }
};

// ─── MASTER VALIDATOR ────────────────────────────
export const validateCryptoAddress = (address, currency) => {
    switch (currency) {
        case 'USDT_TRC20':
        case 'TRX':
            return validateTronAddress(address);

        case 'ETH':
        case 'USDT_ERC20':
            return validateEthAddress(address);

        case 'BTC':
            return validateBtcAddress(address);

        case 'SOL':
            return validateSolAddress(address);

        default:
            return {
                valid: false,
                error: `Unknown currency: ${currency}`
            };
    }
};
