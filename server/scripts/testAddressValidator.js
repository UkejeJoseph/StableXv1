import { validateCryptoAddress } from '../utils/addressValidator.js';

const tests = [
    // TRON - valid
    {
        addr: 'TU3dtEoqJjewYvosYsLBp4UakZaNUcxwEF',
        currency: 'USDT_TRC20', expected: true
    },
    // TRON - invalid (too short)
    {
        addr: 'TU3dtEoq',
        currency: 'USDT_TRC20', expected: false
    },
    // TRON - invalid (wrong prefix)
    {
        addr: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        currency: 'USDT_TRC20', expected: false
    },

    // ETH - valid
    {
        addr: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        currency: 'ETH', expected: true
    },
    // ETH - invalid (missing 0x)
    {
        addr: 'dAC17F958D2ee523a2206206994597C13D831ec7',
        currency: 'ETH', expected: false
    },
    // ETH - invalid (too short)
    {
        addr: '0xdAC17F',
        currency: 'ETH', expected: false
    },

    // BTC - valid legacy
    {
        addr: '1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf',
        currency: 'BTC', expected: true
    },
    // BTC - valid bech32
    {
        addr: 'bc1qttpdp7ppspwx4zyq9fenrxvp783we4w0xm7g55',
        currency: 'BTC', expected: true
    },
    // BTC - invalid
    {
        addr: 'INVALID_BTC_ADDRESS',
        currency: 'BTC', expected: false
    },

    // SOL - valid
    {
        addr: 'CgLHQEioek9vWXA5byRqhFh5pLQq7XzYzpv68wQ1mHbm',
        currency: 'SOL', expected: true
    },
    // SOL - invalid
    {
        addr: 'notavalidsolanaaddress',
        currency: 'SOL', expected: false
    },
];

let passed = 0;
let failed = 0;

tests.forEach(({ addr, currency, expected }) => {
    const result = validateCryptoAddress(addr, currency);
    const actual = result.valid;
    const status = actual === expected ? '✅' : '❌';
    if (actual === expected) passed++;
    else failed++;
    console.log(
        `${status} ${currency} | ${addr.slice(0, 12)}... | ` +
        `Expected: ${expected} | Got: ${actual}` +
        (result.error ? ` | ${result.error}` : '')
    );
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
