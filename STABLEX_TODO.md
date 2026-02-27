# StableX Production TODO List

This list- [ ] Task 30: Fix ETH Listener Connection & Provider Failover
    - [ ] Implement `initProvider` with failover RPCs
    - [ ] Update `pollBlocks` with auto-reinit guards
    - [ ] Verify connectivity via logstion.

## 🔴 HIGH PRIORITY (Critical Path)

### 1. Fix NGN Withdrawal Flow
- [ ] **Define Route**: Add `router.post('/transfer', ...)` to `server/interswitch.js`.
- [ ] **Implement Logic**: Ensure `handlePayTransfer` (or a new payout handler) is correctly linked to Interswitch's Payout/Transfer API.
- [ ] **Verification**: Test end-to-end withdrawal from NGN wallet to a real bank account.

### 2. Implement Real Name Enquiry
- [ ] **Remove Mock**: Delete the `setTimeout` and hardcoded Name result in `depositController.js`.
- [ ] **API Integration**: Implement the real Interswitch Name Enquiry API call.
- [ ] **Validation**: Ensure it correctly handles "Account Not Found" and "Invalid Bank Code" errors.

## 🟡 MEDIUM PRIORITY (Feature Completion)

### 3. Move Swap Rates to Backend-Only
- [ ] **Clean Frontend**: Remove the `EXCHANGE_RATES` constant and local fallbacks in `Convert.tsx`.
- [ ] **Robust Price Service**: Enhance `server/utils/priceService.js` to use multiple sources (e.g., Binance, KuCoin) so it never returns 0.

### 4. Implement Trade History & Real Prices
- [ ] **Live Feed**: Connect `Trade.tsx` to the `priceService.js` endpoint to show real-time price updates.
- [ ] **Database Connection**: Link the "All" tab to real market data rather than the hardcoded coin list.

## 🔵 LOW PRIORITY (Future Roadmap)

### 5. Staking (Earn) Implementation
- [ ] **Smart Contract Integration**: (If applicable) Connect to on-chain staking pools.
- [ ] **Centralized Staking**: Alternatively, implement internal custodial staking logic and reward calculation.

### 6. Gift Card Integration
- [ ] **Provider Integration**: Selection and integration of a gift card vendor API (e.g., Reloadly, Ding).
- [ ] **Inventory Management**: Build the system to track and sell digital codes.

---

> [!NOTE]
> Until **High Priority** items are resolved, the application's core loop (Deposit -> Swap -> Withdraw) is broken for Fiat (NGN).
