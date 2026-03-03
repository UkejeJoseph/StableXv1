# StableX: The Nigerian Crypto Finance Platform

### 1. The Core Concept
StableX is an all-in-one "Fiat-to-Crypto On/Off Ramp" and Centralized Exchange (CEX) built specifically for the Nigerian market. It bridges the gap between traditional banking (the Naira) and the global decentralized economy (Cryptocurrency). 

Instead of juggling multiple apps (e.g., one app to buy USDT with Naira, another app to swap USDT for SOL, and a third app to hold it securely), **StableX allows users to do it all inside a single, secure environment.**

### 2. Live Blockchains Supported (The Tech Stack)
StableX is not theoretical; it is connected to the real global blockchain network. It currently supports four major blockchains:
*   **Bitcoin (BTC):** The digital gold and primary store of value.
*   **Ethereum (ETH / ERC-20):** Supporting Ethereum and ERC-20 tokens.
*   **Solana (SOL):** The high-speed, low-cost network.
*   **Tron (TRC-20):** The primary network Africans use for fast, cheap USDT transfers.

### 3. Core Features & User Journey
StableX packs the functionality of a massive exchange into a clean, modern interface.

*   **Frictionless Fiat On-Ramp:** A user can instantly deposit Naira directly from their bank account using the **Korapay** and **Interswitch** API integrations. 
*   **One-Click Swaps (Internal Ledger):** Once funded, users can instantly swap NGN for Crypto, or Crypto for Crypto (e.g., BTC to USDT). These swaps happen *off-chain* on StableX's internal MongoDB ledger, allowing the transactions to be instant and free from blockchain gas fees.
*   **Off-Ramp (Cashing Out):** Whenever a user needs cash to pay real-world bills, they simply sell their crypto back to NGN on the app, and StableX automatically wires the Naira directly to their local Nigerian bank account via the payment gateway APIs.
*   **Staking & Yield:** Instead of letting crypto sit idle, users can lock their funds in the "Staking" pool to earn up to an 8% APY yield, providing a real alternative to failing traditional savings accounts.
*   **Gift Cards:** StableX integrates with **Reloadly**, allowing users to spend their crypto directly to buy international or local gift cards seamlessly.
*   **Merchant API:** StableX offers an API for merchants and business owners. Businesses can accept crypto payments from their customers globally, and StableX instantly converts it and settles the payment into the merchant's local bank account in NGN.

### 4. How StableX Makes Money (The Business Model)
StableX is designed to be highly profitable per user through several revenue streams:
1.  **The Spread (Market Making):** Currently, when a user does a "One-Click Buy" to swap currencies, StableX acts as the Treasury. It fetches the live market price and applies an implicit ~2.5% spread margin. This means StableX makes a 2.5% profit on every single swap executed on the platform.
2.  **Withdrawal Fees:** When users want to move their crypto off StableX and into a personal external wallet (like Trust Wallet), StableX can charge a fixed withdrawal fee that covers the network gas cost and leaves a margin of profit.
3.  **Deposit Sweep Optimization:** When users deposit crypto, background "Listeners" track the blockchain and automatically sweep the funds into StableX’s secure Cold/Hot Vaults, allowing the company to aggregate liquidity and manage risk efficiently.

### 5. Security & Architecture
For a financial platform, security is the product. 
*   **Custodial Wallets:** When a user creates an account, StableX automatically generates unique, real blockchain sub-wallets for them. 
*   **AES-256 Encryption:** The private keys for these wallets are never exposed. They are symmetrically encrypted using AES-256 (bank-grade encryption) before being saved to the database. Only the server can decrypt them at the exact moment a transaction needs to be signed.
*   **JWT & OAuth:** The platform uses extremely strict authentication, featuring JSON Web Tokens (JWT) rotating access, OTP phone/email verification, and direct Google OAuth integrations.

### 6. The Verdict: Why it Wins
Binance and Bybit were forced out of Nigeria in 2024. The 22 million Nigerians who rely on cryptocurrency to hedge against 24% inflation and a collapsing currency are currently left stranded, relying on dangerous, high-fee Telegram P2P markets. 

StableX provides a fully compliant, hyper-local, and technologically advanced replacement. **It actually exists, it actually works, and it solves the biggest financial crisis in West Africa today.**
