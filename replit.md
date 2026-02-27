# StableX - Crypto Wallet App

## Overview
A mobile-first fintech platform for managing cryptocurrency wallets across 9 blockchain networks (BTC, ETH, SOL, XRP, USDT ERC20, USDT TRC20, USDC ERC20, WBTC, DAI). Features local wallet creation with BIP44 derivation, live balance fetching, currency conversion (Naira to USDT to crypto), QR code payments, withdrawal to Nigerian bank accounts, Naira/USD deposits via Interswitch Inline Checkout, and a custodial wallet option (StableX Secure). Designed for millions of users with dark/light mode theming and bottom navigation.

## Project Architecture
- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components (Dark/Light mode with green accents)
- **Payment Gateways**: Korapay & Interswitch (API keys to be added)
- **State Management**: TanStack React Query
- **Routing**: React Router DOM
- **Blockchain**: ethers.js, @scure/bip32, @noble/hashes for wallet generation
- **QR Code**: qrcode + html5-qrcode for generation and scanning
- **Live Data**: Free public APIs for balance checking (no API keys required)

## Directory Structure
```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── BottomNav.tsx    # Bottom navigation (Home, Convert, QR, Withdraw, Account)
│   ├── Header.tsx       # App header with StableX branding
│   ├── BalanceDisplay.tsx
│   ├── QuickActions.tsx
│   └── ServicesList.tsx
├── lib/
│   ├── utils.ts         # Utility functions
│   ├── wallet.ts        # Wallet creation/import logic
│   ├── blockchain.ts    # Live blockchain balance fetching
│   └── transactions.ts  # Real crypto transaction signing and sending
├── pages/
│   ├── Home.tsx         # Dashboard with balance and services
│   ├── Convert.tsx      # Currency conversion (NGN ↔ USDT ↔ crypto)
│   ├── QRCode.tsx       # QR code generator and scanner
│   ├── Withdraw.tsx     # Withdraw USDT to Nigerian bank
│   ├── Trade.tsx        # Coin listing and trading (header access)
│   ├── Wallet.tsx       # Wallet management with live balances (header access)
│   ├── Giftcard.tsx     # Gift card buy/sell (header access)
│   ├── Account.tsx      # User profile and settings
│   ├── CreateWallet.tsx # Wallet creation/import flow
│   ├── Deposit.tsx      # Card payment and bank transfer deposits
│   └── Transfer.tsx     # Real crypto transactions with signing
├── hooks/               # Custom React hooks
└── main.tsx             # Application entry point
```

## Features

### Core Features (Bottom Navigation)
- **Home**: Balance display, quick actions (Deposit, Transfer, Buy, Sell), services list
- **Convert**: Exchange between NGN, USDT, BTC, ETH, SOL with platform rates (1.5% fee)
- **QR Code**: Generate QR codes for receiving payments, scan QR codes to send
- **Withdraw**: Withdraw USDT to Nigerian bank accounts (1% fee, 1 USDT = ₦1,600)
- **Account**: User profile, KYC status, settings

### Secondary Features (Header Access)
- **Trade**: Coin listing with live prices
- **Wallet**: Wallet management with live balances
- **Giftcard**: Buy and sell gift cards

## Wallet Features
- Local wallet generation using ethers.js, @scure/bip32, and @noble/hashes
- Supports 5 blockchain networks with standard BIP44 derivation:
  - BTC (Bitcoin) - path m/44'/0'/0'/0/0 with P2PKH addresses
  - ETH (Ethereum) - path m/44'/60'/0'/0/0
  - SOL (Solana) - SLIP-0010 ed25519 path m/44'/501'/0'/0'
  - USDT ERC20 - path m/44'/60'/0'/0/0 (Ethereum)
  - USDT TRC20 - path m/44'/195'/0'/0/0 (Tron)
- Mnemonic phrase generation and display (12 words)
- Private key management
- Wallet import via mnemonic or private key
- Secure local storage (only stores addresses, not private keys or mnemonics)

## Currency Conversion
Platform exchange rates with 1.5% fee baked in:
- NGN → USDT: 0.00062 (1 NGN = 0.00062 USDT)
- USDT → NGN: 1,600 (1 USDT = ₦1,600)
- USDT → BTC: 0.000016
- USDT → ETH: 0.00032
- USDT → SOL: 0.0067

## QR Code Format
Custom StableX QR format for easy payments:
```
stablex:network:address:amount (amount optional)
```
Examples:
- `stablex:ETH:0x1234...abcd` (receive any amount)
- `stablex:BTC:1A1zP1...Bfr8:0.001` (receive exactly 0.001 BTC)

## Blockchain Integration
Live balance fetching from public APIs:
- **BTC**: Blockstream API (https://blockstream.info/api)
- **ETH/ERC20**: LlamaRPC (https://eth.llamarpc.com)
- **SOL**: Solana Mainnet RPC (https://api.mainnet-beta.solana.com)
- **TRC20**: TronGrid API (https://api.trongrid.io)

## Development
- Run: `npm run dev` (starts on port 5000)
- Build: `npm run build`
- Lint: `npm run lint`

## Export & Local Development

### Step 1: Download from Replit
1. Click the three dots menu in the Files panel
2. Select "Download as zip"
3. Extract to your local machine

### Step 2: Install Dependencies
```bash
cd stablex
npm install
```

### Step 3: Run Locally
```bash
npm run dev
```
App will be available at http://localhost:5000

### Step 4: Build for Production
```bash
npm run build
```
Output will be in the `dist` folder

## Deploy to Vercel

### Option A: Via Vercel Dashboard
1. Push code to GitHub
2. Go to vercel.com and import your GitHub repo
3. Vercel auto-detects Vite and configures build settings
4. Click Deploy

### Option B: Via Vercel CLI
```bash
npm install -g vercel
vercel login
vercel
```

### Vercel Settings (if needed)
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

## Deploy to GitHub Pages

1. Add to package.json:
```json
"homepage": "https://yourusername.github.io/repo-name"
```

2. Install gh-pages:
```bash
npm install --save-dev gh-pages
```

3. Add deploy scripts to package.json:
```json
"scripts": {
  "predeploy": "npm run build",
  "deploy": "gh-pages -d dist"
}
```

4. Deploy:
```bash
npm run deploy
```

## Recent Changes
- 2026-02-05: Added 4 new tokens and StableX Secure custodial wallet
  - New tokens: XRP (Ripple), USDC (ERC20), WBTC (Wrapped Bitcoin), DAI
  - XRP wallet generation with proper XRPL address encoding (ripple base58 alphabet)
  - ERC20 token balance fetching via ethers.js for USDC, WBTC, DAI
  - XRP balance fetching via xrplcluster.com public API
  - StableX Secure custodial wallet page with Binance-style UI
  - Multi-network withdrawal support (choose network when withdrawing)
  - Deposit simulation for testing custodial wallet
  - Wallet page now shows link to StableX Secure
  - Switched Interswitch to Inline Checkout (secure popup handles card/OTP/3DS)
- 2026-02-04: Added real crypto transaction support for all 5 networks
  - Transfer page for sending BTC, ETH, SOL, USDT ERC20, and USDT TRC20 on mainnet
  - Transaction service with signing via bitcoinjs-lib, ethers.js, and @solana/web3.js
  - UTXO selection and fee calculation for BTC transactions
  - TronGrid API integration for TRC20 USDT transfers
  - Gas/fee estimation for all networks
  - Address validation for all networks
  - Private key secured (cleared immediately after signing)
  - Transaction history saved to local storage
  - Explorer links for tracking transactions
- 2026-02-04: Integrated real Interswitch payment gateway
  - Backend Express server for Interswitch API (port 3001)
  - Token generation, card purchase, OTP verification endpoints
  - Transaction status checking and resend OTP support
  - Test mode enabled with test card 5060990580000217499
  - Environment variable validation for API credentials
  - Note: Production requires PCI DSS certification and proper RSA/3DES encryption
- 2026-02-04: Added Deposit page and payment gateway integration
  - Card payment support (Visa, Mastercard, Verve, Amex)
  - Bank transfer with virtual account numbers
  - NGN, USD (Domiciliary), and USDT wallet accounts
  - Dark/Light mode toggle with green accent theme
  - Eye icon to hide/show balance
  - Fund and Deposit quick action buttons
  - Transaction history for incoming/outgoing payments
- 2026-02-04: Added Convert, QR Code, and Withdraw features
  - Currency conversion with custom platform rates
  - QR code generation and scanning for payments
  - Bank withdrawal with account verification
  - Updated navigation to Home/Convert/QR/Withdraw/Account
  - Trade, Wallet, Giftcard accessible via header icons
- 2026-02-04: Rebranded to StableX
  - New logo and header design
  - Consistent branding throughout
- 2026-02-04: Added live blockchain balance fetching
  - Integration with public APIs for all 5 networks
  - Real-time balance display in Wallet page
  - Explorer links for each wallet address
- 2026-02-04: Complete UI revamp to match fintech mobile app design
  - Navy blue color scheme
  - Bottom navigation with 5 tabs
  - Local wallet creation for 5 blockchain networks

## User Preferences
- Mobile-first UI design
- Navy blue (#1a2f5a) as primary color
- App designed for millions of users (robust architecture)
- Will export and deploy to Vercel

## External Wallet Connection
Connect external wallets via:
- **MetaMask**: Browser extension integration
- **WalletConnect**: Trust Wallet, Rainbow, and other mobile wallets

Connection button is prominently displayed on the Home page for easy access.
