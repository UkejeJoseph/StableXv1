// ──────────────────────────────────────────────────────────────
// Deposit Controller
// Express route handlers for all Interswitch deposit channels
// ──────────────────────────────────────────────────────────────
import { CONFIG, URLS, IS_LIVE } from '../services/interswitchConfig.js';
import { initiateCardPayment, authenticateOtp, authorize3DSecure, createRefund } from '../services/cardDepositService.js';
import { createVirtualAccount } from '../services/transferDepositService.js';
import { initiateUssdPayment, getUssdBanks } from '../services/ussdDepositService.js';
import { getTransactionStatus } from '../services/transactionService.js';
import Transaction from '../models/transactionModel.js';
import { creditUserWallet } from '../services/walletService.js';

// ── GET /config ─────────────────────────────────────────────
export async function handleGetConfig(req, res) {
    console.log('[CTRL:Config] 📋 Returning Interswitch config...');
    console.log('[CTRL:Config] Mode:', IS_LIVE ? '🔴 LIVE' : '🟢 TEST');
    console.log('[CTRL:Config] Merchant Code:', CONFIG.merchantCode);
    console.log('[CTRL:Config] Pay Item ID:', CONFIG.payItemId);

    res.json({
        merchantCode: CONFIG.merchantCode,
        payItemId: CONFIG.payItemId,
        checkoutScript: URLS.CHECKOUT_SCRIPT,
        mode: IS_LIVE ? 'LIVE' : 'TEST',
    });
}

// ── POST /card-payment ──────────────────────────────────────
export async function handleCardPayment(req, res) {
    const startTime = Date.now();
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('[CTRL:Card] 💳 CARD PAYMENT INITIATED');
    console.log('[CTRL:Card] Environment:', IS_LIVE ? '🔴 LIVE' : '🟢 TEST');
    console.log('[CTRL:Card] Request body keys:', Object.keys(req.body));
    console.log('═══════════════════════════════════════════════');

    try {
        const { customerId, amount, authData, transactionRef, currency, deviceInformation } = req.body;

        if (!customerId || !amount || !authData || !transactionRef) {
            console.log('[TX_TRACE] [CTRL:Card] ❌ Missing required fields');
            console.log('[TX_TRACE] [CTRL:Card] Received:', { customerId: !!customerId, amount: !!amount, authData: !!authData, transactionRef: !!transactionRef });
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: customerId, amount, authData, transactionRef',
            });
        }

        console.log('[CTRL:Card] ✅ Validation passed. Customer:', customerId, 'Amount:', amount, 'Ref:', transactionRef);
        console.log('[CTRL:Card] ⏳ Calling Interswitch Card API...');

        const existingTx = await Transaction.findOne({ reference: transactionRef });
        if (!existingTx) {
            await Transaction.create({
                user: req.user._id,
                type: 'deposit',
                status: 'pending',
                amount: Number(amount),
                currency: currency || 'NGN',
                reference: transactionRef,
                description: 'Initiated card deposit via Interswitch'
            });
        }

        const result = await initiateCardPayment({
            customerId,
            amount: Math.round(parseFloat(amount) * 100), // Convert NGN to kobo
            currency: currency || 'NGN',
            authData,
            transactionRef,
            deviceInformation,
        });

        const elapsed = Date.now() - startTime;
        console.log(`[CTRL:Card] ⏱️ Interswitch responded in ${elapsed}ms`);
        console.log('[CTRL:Card] Response code:', result.data.responseCode);
        console.log('[CTRL:Card] Response description:', result.data.responseDescription || 'N/A');

        if (!result.ok) {
            console.log('[CTRL:Card] ❌ Payment failed:', result.data);
            return res.status(result.status).json({
                success: false,
                error: result.data.responseDescription || result.data.message || 'Card payment failed',
                details: result.data,
            });
        }

        console.log('[CTRL:Card] ✅ Payment initiated successfully');
        console.log(`[TX_TRACE] Card Payment Success Initialized: ${transactionRef} | User: ${req.user._id}`);
        res.json({ success: true, ...result.data });

    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`[CTRL:Card] 💥 EXCEPTION after ${elapsed}ms:`, error.message);
        console.error('[CTRL:Card] Stack:', error.stack);
        res.status(500).json({ success: false, error: error.message });
    }
}

// ── POST /authenticate-otp ──────────────────────────────────
export async function handleAuthenticateOtp(req, res) {
    console.log('');
    console.log('[CTRL:OTP] 🔐 OTP AUTHENTICATION STARTED');
    console.log('[CTRL:OTP] Environment:', IS_LIVE ? '🔴 LIVE' : '🟢 TEST');

    try {
        const { paymentId, otp, transactionRef } = req.body;

        if (!paymentId || !otp || !transactionRef) {
            console.log('[CTRL:OTP] ❌ Missing fields:', { paymentId: !!paymentId, otp: !!otp, transactionRef: !!transactionRef });
            // The following line and block seem to be from a different context (Korapay Payout)
            // and are not applicable here. Keeping the original error response.
            // console.log(`[TX_TRACE] Korapay Payout Initialized: ${reference} | User: ${user._id} | Bank: ${bankCode}`);
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: paymentId, otp, transactionRef',
            });
        }

        console.log('[CTRL:OTP] ✅ Payload valid. PaymentId:', paymentId, 'Ref:', transactionRef);
        console.log('[CTRL:OTP] ⏳ Sending OTP to Interswitch...');

        const result = await authenticateOtp({ paymentId, otp, transactionRef });

        console.log('[CTRL:OTP] Response code:', result.data.responseCode);
        const isSuccess = result.ok && result.data.responseCode === '00';
        console.log('[CTRL:OTP]', isSuccess ? '✅ OTP verified' : '❌ OTP failed');

        res.json({ success: isSuccess, ...result.data });

    } catch (error) {
        console.error('[CTRL:OTP] 💥 EXCEPTION:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}

// ── POST /authorize-3ds ─────────────────────────────────────
export async function handleAuthorize3DS(req, res) {
    console.log('');
    console.log('[CTRL:3DS] 🛡️ 3D SECURE AUTHORIZATION STARTED');

    try {
        const { transactionId, eciFlag } = req.body;

        if (!transactionId || !eciFlag) {
            console.log('[CTRL:3DS] ❌ Missing fields');
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: transactionId, eciFlag',
            });
        }

        console.log('[CTRL:3DS] ⏳ Sending 3DS auth to Interswitch...');
        const result = await authorize3DSecure({ transactionId, eciFlag });

        console.log('[CTRL:3DS] Response code:', result.data.responseCode);
        res.json({ success: result.ok && result.data.responseCode === '00', ...result.data });

    } catch (error) {
        console.error('[CTRL:3DS] 💥 EXCEPTION:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}

// ── POST /pay-transfer ──────────────────────────────────────
export async function handlePayTransfer(req, res) {
    const startTime = Date.now();
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('[CTRL:Transfer] 🏦 VIRTUAL ACCOUNT CREATION STARTED');
    console.log('[CTRL:Transfer] Environment:', IS_LIVE ? '🔴 LIVE' : '🟢 TEST');
    console.log('[CTRL:Transfer] Virtual Account Base URL:', URLS.VIRTUAL_ACCOUNT);
    console.log('[CTRL:Transfer] Request body:', JSON.stringify(req.body));
    console.log('═══════════════════════════════════════════════');

    try {
        const { amount, transactionRef } = req.body;

        if (!amount) {
            console.log('[CTRL:Transfer] ❌ Missing amount');
            return res.status(400).json({
                success: false,
                error: 'Missing required field: amount',
            });
        }

        const transactionReference = transactionRef || `STX${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        console.log('[CTRL:Transfer] ✅ Using transaction reference:', transactionReference);
        console.log('[CTRL:Transfer] Amount (NGN):', amount);
        console.log('[CTRL:Transfer] Amount (kobo):', Math.round(parseFloat(amount) * 100));
        console.log('[CTRL:Transfer] ⏳ Calling Interswitch Virtual Account API...');

        const existingTx = await Transaction.findOne({ reference: transactionReference });
        if (!existingTx) {
            await Transaction.create({
                user: req.user._id,
                type: 'deposit',
                status: 'pending',
                amount: Number(amount),
                currency: 'NGN',
                reference: transactionReference,
                description: 'Initiated bank transfer deposit via Virtual Account'
            });
        }

        const result = await createVirtualAccount({
            amount: Math.round(parseFloat(amount) * 100),
            transactionReference,
            accountName: 'StableX Customer',
        });

        const elapsed = Date.now() - startTime;
        console.log(`[CTRL:Transfer] ⏱️ Interswitch responded in ${elapsed}ms`);
        console.log('[CTRL:Transfer] HTTP Status:', result.status);
        console.log('[CTRL:Transfer] Full Response:', JSON.stringify(result.data));

        if (!result.ok) {
            console.log('[CTRL:Transfer] ❌ Virtual account creation failed');
            return res.status(result.status).json({
                success: false,
                error: result.data.description || result.data.message || 'Virtual account creation failed',
                details: result.data,
            });
        }

        console.log('[CTRL:Transfer] ✅ Virtual account created successfully!');
        console.log('[CTRL:Transfer] Account Number:', result.data.accountNumber);
        console.log('[CTRL:Transfer] Bank:', result.data.bankName);
        console.log(`[TX_TRACE] Virtual Account Created: ${transactionReference} | User: ${req.user._id} | Acc: ${result.data.accountNumber}`);

        res.json({
            success: true,
            accountNumber: result.data.accountNumber,
            bankName: result.data.bankName,
            transactionReference,
            ...result.data,
        });

    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`[CTRL:Transfer] 💥 EXCEPTION after ${elapsed}ms:`, error.message);
        console.error('[CTRL:Transfer] Stack:', error.stack);
        res.status(500).json({ success: false, error: error.message });
    }
}

// ── POST /pay-ussd ──────────────────────────────────────────
export async function handlePayUssd(req, res) {
    const startTime = Date.now();
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('[CTRL:USSD] 📱 USSD PAYMENT INITIATED');
    console.log('[CTRL:USSD] Environment:', IS_LIVE ? '🔴 LIVE' : '🟢 TEST');
    console.log('[CTRL:USSD] Request body:', JSON.stringify(req.body));
    console.log('═══════════════════════════════════════════════');

    try {
        const { amount, bankCode, transactionRef } = req.body;

        if (!amount || !bankCode) {
            console.log('[CTRL:USSD] ❌ Missing required fields:', { amount: !!amount, bankCode: !!bankCode });
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: amount, bankCode',
            });
        }

        const merchantTransactionReference = transactionRef || `STX${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        console.log('[CTRL:USSD] ✅ Ref:', merchantTransactionReference, 'Amount:', amount, 'Bank:', bankCode);
        console.log('[CTRL:USSD] ⏳ Calling Interswitch USSD API...');

        const existingTx = await Transaction.findOne({ reference: merchantTransactionReference });
        if (!existingTx) {
            await Transaction.create({
                user: req.user._id,
                type: 'deposit',
                status: 'pending',
                amount: Number(amount),
                currency: 'NGN',
                reference: merchantTransactionReference,
                description: `Initiated USSD deposit via ${bankCode}`
            });
        }

        const result = await initiateUssdPayment({
            amount: Math.round(parseFloat(amount) * 100),
            bankCode,
            merchantTransactionReference,
        });

        const elapsed = Date.now() - startTime;
        console.log(`[CTRL:USSD] ⏱️ Interswitch responded in ${elapsed}ms`);
        console.log('[CTRL:USSD] Full Response:', JSON.stringify(result.data));

        if (!result.ok) {
            console.log('[CTRL:USSD] ❌ USSD payment failed');
            return res.status(result.status).json({
                success: false,
                error: result.data.description || result.data.message || 'USSD payment initiation failed',
                details: result.data,
            });
        }

        console.log('[CTRL:USSD] ✅ USSD code generated:', result.data.ussdString);
        console.log(`[TX_TRACE] USSD Deposit Initialized: ${merchantTransactionReference} | User: ${req.user._id} | Bank: ${bankCode}`);

        const transaction = await Transaction.findOne({ reference: merchantTransactionReference });
        if (transaction) {
            transaction.metadata = transaction.metadata || new Map();
            transaction.metadata.set('ussdString', result.data.ussdString);
            await transaction.save();
        }

        res.json({ success: true, ...result.data });

    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`[CTRL:USSD] 💥 EXCEPTION after ${elapsed}ms:`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}

// ── GET /ussd-banks ─────────────────────────────────────────
export async function handleGetUssdBanks(req, res) {
    console.log('[CTRL:USSD] 🏦 Fetching supported USSD banks...');

    try {
        const result = await getUssdBanks();
        console.log('[CTRL:USSD] Banks returned:', Array.isArray(result.data) ? result.data.length : 'N/A');
        res.json({ success: result.ok, banks: result.data });

    } catch (error) {
        console.error('[CTRL:USSD] 💥 Failed to fetch banks:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}

// ── GET /transaction-status ─────────────────────────────────
export async function handleTransactionStatus(req, res) {
    console.log('');
    console.log('[CTRL:Status] 🔍 TRANSACTION STATUS QUERY');
    console.log('[CTRL:Status] Environment:', IS_LIVE ? '🔴 LIVE' : '🟢 TEST');

    try {
        const { transactionRef, amount } = req.query;

        if (!transactionRef || !amount) {
            console.log('[CTRL:Status] ❌ Missing query params:', { transactionRef: !!transactionRef, amount: !!amount });
            return res.status(400).json({
                success: false,
                error: 'Missing required query params: transactionRef, amount',
            });
        }

        console.log('[CTRL:Status] Ref:', transactionRef, 'Amount:', amount);
        console.log('[CTRL:Status] ⏳ Querying Interswitch...');

        const result = await getTransactionStatus(transactionRef, Math.round(parseFloat(amount) * 100));

        console.log('[CTRL:Status] Response Code:', result.data.responseCode);
        console.log('[CTRL:Status] Success:', result.success);
        console.log('[CTRL:Status] Full data:', JSON.stringify(result.data));

        res.json({
            success: result.success,
            responseCode: result.data.responseCode,
            ...result.data,
        });

    } catch (error) {
        console.error('[CTRL:Status] 💥 EXCEPTION:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}

// ── GET /web-checkout-confirm ───────────────────────────────
// Per Interswitch Web Checkout docs:
// GET /collections/api/v1/gettransaction.json?merchantcode={}&transactionreference={}&amount={}
// This is the REQUIRED server-side confirmation after Web Checkout completes.
export async function handleWebCheckoutConfirm(req, res) {
    const startTime = Date.now();
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('[CTRL:WebCheckout] 🔍 WEB CHECKOUT CONFIRMATION');
    console.log('[CTRL:WebCheckout] Environment:', IS_LIVE ? '🔴 LIVE' : '🟢 TEST');
    console.log('═══════════════════════════════════════════════');

    try {
        const { transactionRef, amount } = req.query;

        if (!transactionRef || !amount) {
            console.log('[CTRL:WebCheckout] ❌ Missing query params');
            return res.status(400).json({
                success: false,
                error: 'Missing required query params: transactionRef, amount',
            });
        }

        const amountInMinor = Math.round(parseFloat(amount) * 100);
        const confirmBaseUrl = `${URLS.COLLECTIONS}/collections/api/v1/gettransaction.json`;

        console.log('[CTRL:WebCheckout] Ref:', transactionRef);
        console.log('[CTRL:WebCheckout] Amount (NGN):', amount);
        console.log('[CTRL:WebCheckout] Amount (minor/kobo):', amountInMinor);
        console.log('[CTRL:WebCheckout] Merchant Code:', CONFIG.merchantCode);

        const { getAccessToken: getToken } = await import('../services/interswitchConfig.js');
        const token = await getToken();

        const url = new URL(confirmBaseUrl);
        url.searchParams.append('merchantcode', CONFIG.merchantCode);
        url.searchParams.append('transactionreference', transactionRef);
        url.searchParams.append('amount', amountInMinor.toString());

        console.log('[CTRL:WebCheckout] 📤 FULL URL:', url.toString());
        console.log('[CTRL:WebCheckout] Headers: Authorization: Bearer *****');
        console.log('[CTRL:WebCheckout] ⏳ Querying Interswitch...');

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        const data = await response.json();
        const elapsed = Date.now() - startTime;
        const isSuccess = data.ResponseCode === '00';

        console.log(`[CTRL:WebCheckout] 📥 RESPONSE RECEIVED (took ${elapsed}ms)`);
        console.log('[CTRL:WebCheckout] HTTP Status:', response.status);
        console.log('[CTRL:WebCheckout] Response Body:', JSON.stringify(data, null, 2));
        console.log('[CTRL:WebCheckout] ResponseCode:', data.ResponseCode);
        console.log('[CTRL:WebCheckout] ResponseDescription:', data.ResponseDescription);
        console.log('[CTRL:WebCheckout] Amount Confirmed:', data.Amount);
        console.log('[CTRL:WebCheckout] Payment Reference:', data.PaymentReference);
        console.log('[CTRL:WebCheckout] SUCCESS:', isSuccess ? '✅ YES' : '❌ NO');

        if (isSuccess) {
            if (String(data.Amount) !== String(amountInMinor)) {
                console.log('[CTRL:WebCheckout] ⚠️ AMOUNT MISMATCH! Expected:', amountInMinor, 'Got:', data.Amount);
            }
            console.log('[CTRL:WebCheckout] 💰 Transaction verified. Safe to credit wallet.');

            // ── ACTION: Credit the user's NGN wallet ────────────────
            const userId = req.user._id;
            const currency = 'NGN';
            const amountInNgn = parseFloat(amount);

            await creditUserWallet(
                userId,
                currency,
                amountInNgn,
                transactionRef,
                {
                    paymentReference: data.PaymentReference || '',
                    interswitchResponseCode: data.ResponseCode,
                    method: 'WebCheckout',
                    confirmedAt: new Date().toISOString()
                }
            );
            console.log(`[CTRL:WebCheckout] ✅ Wallet credited for Ref: ${transactionRef}`);
        }

        res.json({
            success: isSuccess,
            ...data,
        });

    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`[CTRL:WebCheckout] 💥 EXCEPTION after ${elapsed}ms:`, error.message);
        console.error('[CTRL:WebCheckout] Stack:', error.stack);
        res.status(500).json({ success: false, error: error.message });
    }
}

// ── GET /name-enquiry ───────────────────────────────────────
// Real-time bank account verification for the withdrawal flow using Interswitch.
export async function handleNameEnquiry(req, res) {
    console.log('');
    console.log('[CTRL:NameEnquiry] 🔍 ACCOUNT NAME INQUIRY STARTED');

    try {
        const { bankCode, accountId } = req.query;

        if (!bankCode || !accountId) {
            console.log('[CTRL:NameEnquiry] ❌ Missing inputs');
            return res.status(400).json({
                success: false,
                error: 'Missing required query params: bankCode, accountId',
            });
        }

        console.log('[CTRL:NameEnquiry] Bank Code:', bankCode);
        console.log('[CTRL:NameEnquiry] Account Number:', accountId);

        // Simulating the delay of external API request
        // Real ISW Name Enquiry (Production)
        try {
            const result = await PayoutService.verifyBankAccount(bankCode, accountId);
            if (!result.ok) {
                return res.status(422).json({
                    message: 'Unable to verify account. Please check details and try again.',
                    details: result.error
                });
            }
            res.json({ success: true, accountName: result.data.accountName || result.data.name });
        } catch (error) {
            console.error('[CTRL:NameEnquiry] 💥 Verification error:', error.message);
            res.status(500).json({ message: 'Internal server error during account verification' });
        }

    } catch (error) {
        console.error('[CTRL:NameEnquiry] 💥 EXCEPTION:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}
