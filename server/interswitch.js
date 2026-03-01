// ──────────────────────────────────────────────────────────────
// Interswitch Router
// Thin route definitions that delegate to controllers
// ──────────────────────────────────────────────────────────────
import express from 'express';
import { IS_LIVE } from './services/interswitchConfig.js';
import {
  handleGetConfig,
  handleCardPayment,
  handleAuthenticateOtp,
  handleAuthorize3DS,
  handlePayTransfer,
  handlePayUssd,
  handleGetUssdBanks,
  handleTransactionStatus,
  handleWebCheckoutConfirm,
  handleNameEnquiry,
  handleGenerateWebCheckoutHash,
} from './controllers/depositController.js';
import { handleWebhook } from './controllers/webhookController.js';
import { protect } from './middleware/authMiddleware.js';

const router = express.Router();

// ── Startup Log ─────────────────────────────────────────────
console.log('');
console.log('╔══════════════════════════════════════════════╗');
console.log('║   INTERSWITCH ROUTER INITIALIZED             ║');
console.log(`║   Mode: ${IS_LIVE ? '🔴 LIVE PRODUCTION' : '🟢 TEST / QA'}              ║`);
console.log('╚══════════════════════════════════════════════╝');
console.log('');

// ── Config ──────────────────────────────────────────────────
router.get('/config', handleGetConfig);

// ── Card Payment ────────────────────────────────────────────
router.post('/card-payment', protect, handleCardPayment);
router.post('/purchase', protect, handleCardPayment); // Legacy alias
router.post('/authenticate-otp', protect, handleAuthenticateOtp);
router.post('/verify-otp', protect, handleAuthenticateOtp); // Legacy alias
router.post('/authorize-3ds', protect, handleAuthorize3DS);

// ── Bank Transfer (Virtual Account) ────────────────────────
router.post('/pay-transfer', protect, handlePayTransfer);

// ── USSD ────────────────────────────────────────────────────
router.post('/pay-ussd', protect, handlePayUssd);
router.get('/ussd-banks', handleGetUssdBanks);

// ── Web Checkout (Inline) ──────────────────────────────────
router.post('/generate-checkout-hash', protect, handleGenerateWebCheckoutHash);
router.get('/web-checkout-confirm', protect, handleWebCheckoutConfirm);

// ── Transaction Status (All Channels) ──────────────────────
router.get('/transaction-status', protect, handleTransactionStatus);

import { handleGetPayoutBanks, handleAccountInquiry, handlePayoutTransfer } from './controllers/payoutController.js';

// ── Name Enquiry (Withdrawals) ─────────────────────────────
// Re-routing to the live Payout API instead of the mock
router.get('/name-enquiry', handleAccountInquiry);

// ── Payouts (Bank Transfers & Bank Lists) ────────────────────
router.get('/banks', handleGetPayoutBanks);
router.post('/transfer', protect, handlePayoutTransfer);

// ── Webhook (Interswitch Notifications) ─────────────────────
router.post('/webhook', handleWebhook);

export default router;
