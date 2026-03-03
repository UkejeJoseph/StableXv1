# StableX: Demo Recording & Technical Testing Overview

This document outlines the testing parameters, simulated flows, and technical QA processes conducted to verify the platform before recording the final Hackathon Demo. 

### 1. Goal of Testing
The objective was to completely validate the end-to-end user and merchant experience on a local development environment (`localhost:9090` and `localhost:5000`) to ensure a flawless recording for the product demo video.

### 2. Simulated Funding & Webhooks
Because we were testing locally, we needed a way to fund the test accounts without relying on live blockchain transfers or live bank deposits.
*   **Database Seeding (fundDb.js):** We wrote custom administrative scripts to directly access the MongoDB Atlas cluster and inject mock balances. This allowed us to instantly fund the test user (`jukeje07@gmail.com`) with **5,000,000 NGN** and **40 USDT**.
*   **Webhook Simulation:** We also prepared and tested the KoraPay webhook endpoints (`/api/webhooks/korapay`) to ensure that if a live deposit was simulated, the system's idempotency checks and ledger updates would fire correctly.

### 3. Core Flows Tested for the Demo
The testing and recording phased focused heavily on the following core functionalities:

#### A. User Onboarding & Dashboard Rendering
*   **Action:** Logging in via standard email/password authentication using JSON Web Tokens (JWT).
*   **Verification:** Ensuring the `UserDashboard` correctly fetches real-time balances from the user's generated crypto and fiat wallets, and displays the combined portfolio value accurately.

#### B. The Swap Engine (Fiat to Crypto)
*   **Action:** Simulating a conversion of NGN into USDT via the internal ledger.
*   **Verification:** We tested the "Conversions" UI to ensure that the system successfully fetches the live market rate (plus the implicit spread), confirms the swap, deducts the NGN wallet, and instantly credits the USDT TRC-20 wallet—all occurring off-chain on the MongoDB ledger for instant settlement.

#### C. Embedded Gift Cards (Reloadly API)
*   **Action:** Navigating to the Giftcards tab to purchase digital goods with crypto.
*   **Verification:** Ensuring the frontend correctly loads the catalog of available gift cards via the Reloadly integration, rendering the UI smoothly for the final mock purchase flow.

#### D. The Merchant Experience (Pay-In / Pay-Out)
*   **Action:** Accessing the specialized Merchant Portal.
*   **Verification:** Demonstrating the B2B capabilities of StableX. This included generating payment links/checkout sessions for customers to pay via Crypto/Fiat, and showing the automated settlement features where merchants can disburse (Pay Out) their aggregated funds to local bank accounts.

### 4. Bugs Identified & Fixed During QA
During the simulation phase, our automated testing agents identified a critical blocker that was immediately patched:
*   **Issue:** `ReferenceError: user is not defined` at `GET /api/users/profile`.
*   **Cause:** The backend controller expected the `user` object to be defined from the `req` context but failed to assign it explicitly, causing the API to throw a 500 Internal Server Error when non-admin users tried to load their dashboards.
*   **Resolution:** The `userController.js` was immediately patched to correctly extract `const user = req.user;` before proceeding, restoring full access to the User and Merchant portals.

### 5. Conclusion
With the accounts successfully seeded and the critical routing bugs patched, the platform is technically sound and visually verified to support a highly professional, end-to-end Hackathon presentation covering the complete Fiat-to-Crypto lifecycle for both retail users and organizational merchants.
