# StableX Context Handoff Document

This document contains the complete state of the StableX application up to the point of our previous chat migration. 
**PROMPT FOR THE NEW AGENT: "Read this document to understand the full context of StableX, the current architecture we migrated to, and the pending tasks we need to complete."**

## Core Architecture Migration (Custodial Model)
StableX has explicitly migrated from a "Non-Custodial" (Web3/MetaMask style) application to a **Centralized Custodial Exchange** (like Binance). 
User private keys are **NO LONGER EXPOSED OR USED** on the frontend. All blockchain interactions are handled securely by the Node.js backend using Hot Wallets.

### 1. Crypto Deposits (Implemented & Working)
- **Mechanism:** Background Polling Listener (`server/workers/blockchainListener.js`).
- **How it works:** A `node-cron` job runs every 1-2 minutes, checking the TronGrid API for inbound `USDT_TRC20` transactions to generated user deposit addresses.
- **Idempotency:** Transactions are checked against the MongoDB `Transaction` collection (where `reference` = `TxHash`) to prevent double-crediting.
- **Sweeping Logistics:** When a deposit is found:
  1. The DB credits the user's internal `Wallet` balance.
  2. The backend uses the `STABLEX_TREASURY_TRC20_PRIVATE_KEY` to send TRX (gas money) to the user's specific sub-wallet.
  3. The backend then sweeps the deposited USDT from the sub-wallet into the central `STABLEX_HOT_WALLET_TRC20`.

### 2. Crypto Withdrawals (Implemented & Working)
- **Mechanism:** REST API `POST /api/transactions/withdraw-crypto` (`server/transactions.js`).
- **How it works:**
  1. Validates the user has sufficient balance in MongoDB.
  2. Deducts the withdrawal amount + `STABLEX_TRC20_WITHDRAWAL_FEE` (dynamically loaded from `.env`, defaults to ~1.5 USDT).
  3. The **backend** interacts with the TronGrid API to trigger a `USDT_TRC20_CONTRACT` transfer from the `STABLEX_HOT_WALLET_TRC20` directly to the requested external address, signed using the Hot Wallet's private key.
- **Frontend Changes:** `Transfer.tsx`, `QRCode.tsx`, and `lib/transactions.ts` have been stripped of raw `ethers.js`/Web3 logic. Users do *not* enter private keys on the frontend anymore.

### 3. Swaps (Implemented & Working)
- **Mechanism:** Internal Ledger Math.
- **How it works:** Real-time prices are fetched from CoinGecko. The system applies a standard `SPREAD_PERCENTAGE` (1% profit) to the conversion rate. The user's `Wallet` balances are atomically debited/credited entirely within MongoDB using ACID transactions (`session.startTransaction()`). No blockchain fees are incurred for internal swaps.

---

## ⚠️ PENDING TASK: Phase 3 - Fiat Deposits (Interswitch WebPay)

This is the exact point where the previous chat was handed off. The Interswitch integration is halfway complete.

**Current State:**
- The frontend (`Deposit.tsx`) successfully opens the Interswitch WebCheckout popup.
- The `handleWebCheckoutConfirm` server logic is successfully validating the transaction with Interswitch and returning `ResponseCode: '00'`.
- THE BUG: The user's actual MongoDB `NGN` Wallet balance **is not being credited** after a successful payment.

**Required Steps for the New Agent:**

1. **Frontend `Deposit.tsx` Update:**
   - Before firing `window.webpayCheckout(...)`, the frontend must make an API call to `POST /api/transactions/deposit-pending` to securely register the intent in the database with a specific `status: 'pending'` and the `transactionRef`. Ensure that `deposit-pending` accepts Fiat (NGN).

2. **Backend Confirmation `depositController.js` Update:**
   - Modify `handleWebCheckoutConfirm`. When Interswitch returns a successful verify (`ResponseCode: '00'`), it must lookup the user's NGN `Wallet` document and increment the `balance` by exactly the `amount` paid.
   - It must update the `Transaction` record status to `completed`.

3. **Double-Credit Protection (Webhook Idempotency):**
   - We must ensure that between the frontend hitting the `/web-checkout-confirm` endpoint AND the `webhookController.js` receiving a push notification from Interswitch, the user's balance is **strictly increased exactly ONCE**. Use `status === 'pending'` checks wrapped in MongoDB Sessions before making the increment.

## Additional Environment Variables Recently Added
- `STABLEX_TRC20_WITHDRAWAL_FEE`: (e.g., 1.5)
- `STABLEX_HOT_WALLET_TRC20`: T...
- `STABLEX_HOT_WALLET_TRC20_PRIVATE_KEY`: ...
- `STABLEX_TREASURY_TRC20_PRIVATE_KEY`: ...
- `TRX_GAS_FEE_AMOUNT`: (e.g., 15)
