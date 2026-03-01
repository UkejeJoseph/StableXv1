import crypto from 'crypto';
import CheckoutSession from '../models/checkoutSessionModel.js';
import User from '../models/userModel.js';
import Wallet from '../models/walletModel.js';
import Transaction from '../models/transactionModel.js';
import { creditUserWallet, debitUserWallet } from '../services/walletService.js';

const PLATFORM_FEE_WALLET_ID = process.env.PLATFORM_FEE_WALLET_ID;
const MERCHANT_FEE_PERCENTAGE = 0.015; // 1.5%

// @desc    Initialize a Checkout Session (Called by external Merchant backend)
// @route   POST /api/v1/checkout/initialize
// @access  Protected (Requires Secret API Key)
export const initializeCheckout = async (req, res) => {
    try {
        const merchant = req.merchant;

        if (req.apiKeyType !== 'secret') {
            return res.status(403).json({ success: false, error: 'Forbidden: Secret Key required to initialize checkout' });
        }

        const { amount, currency, reference, customerEmail, customerName, description, successUrl, cancelUrl } = req.body;

        if (!amount || !currency || !reference) {
            return res.status(400).json({ success: false, error: 'Missing required fields: amount, currency, reference' });
        }

        // Check for existing reference
        const existingSession = await CheckoutSession.findOne({ merchantId: merchant._id, reference });
        if (existingSession) {
            return res.status(400).json({ success: false, error: 'Duplicate reference: A transaction with this reference already exists.' });
        }

        // Generate unique public sessionId
        const sessionId = `chk_${crypto.randomBytes(16).toString('hex')}`;

        // Expires in 1 hour
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        const session = await CheckoutSession.create({
            merchantId: merchant._id,
            amount,
            currency,
            customerEmail,
            customerName,
            description,
            reference,
            sessionId,
            successUrl,
            cancelUrl,
            expiresAt
        });

        const baseUrl = process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:5000';
        const checkoutUrl = `${baseUrl}/checkout/${session.sessionId}`;

        res.status(201).json({
            success: true,
            message: 'Checkout session initialized',
            data: {
                sessionId: session.sessionId,
                checkoutUrl,
                expiresAt: session.expiresAt
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Get details of a public Checkout Session (Called by frontend widget)
// @route   GET /api/v1/checkout/:sessionId/details
// @access  Public
export const getCheckoutDetails = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await CheckoutSession.findOne({ sessionId }).populate('merchantId', 'username merchantProfile.businessName');

        if (!session) {
            return res.status(404).json({ success: false, error: 'Checkout session not found' });
        }

        if (session.expiresAt < new Date() && session.status === 'pending') {
            session.status = 'expired';
            await session.save();
        }

        // Fetch all merchant wallets to allow the customer to select a crypto payment method
        const merchantWallets = await Wallet.find({ user: session.merchantId._id, walletType: 'merchant' });
        const availableCryptoAddresses = {};

        merchantWallets.forEach(wallet => {
            if (wallet.currency && wallet.currency !== 'NGN' && wallet.address) {
                availableCryptoAddresses[wallet.currency] = wallet.address;
            }
        });

        res.json({
            success: true,
            data: {
                amount: session.amount,
                currency: session.currency,
                customerEmail: session.customerEmail,
                description: session.description,
                status: session.status,
                merchant: {
                    username: session.merchantId.username,
                    businessName: session.merchantId.merchantProfile?.businessName || session.merchantId.username
                },
                merchantAddresses: availableCryptoAddresses,
                expiresAt: session.expiresAt
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Process Payment for Web Checkout Widget directly via StableX Internal Wallet
// @route   POST /api/v1/checkout/:sessionId/pay-internal
// @access  Protected (Requires standard User JWT Auth)
export const processInternalPayment = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const customer = req.user; // User trying to pay with their balance

        console.log(`[CHECKOUT_TRACE] Initiating internal payment for session: ${sessionId} by user: ${customer._id}`);

        const session = await CheckoutSession.findOne({ sessionId, status: 'pending' });
        if (!session) {
            console.log(`[CHECKOUT_TRACE] Session ${sessionId} not found or not pending.`);
            return res.status(404).json({ success: false, error: 'Session not found or already completed/expired' });
        }

        if (session.expiresAt < new Date()) {
            session.status = 'expired';
            await session.save();
            console.log(`[CHECKOUT_TRACE] Session ${sessionId} expired.`);
            return res.status(400).json({ success: false, error: 'Session has expired' });
        }

        // Prevent paying yourself
        if (session.merchantId.toString() === customer._id.toString()) {
            console.log(`[CHECKOUT_TRACE] User ${customer._id} attempted to pay their own session ${sessionId}.`);
            return res.status(400).json({ success: false, error: 'You cannot pay your own checkout session' });
        }

        // Calculate Fees
        const grossAmount = session.amount;
        const platformFee = grossAmount * MERCHANT_FEE_PERCENTAGE;
        const merchantReceives = grossAmount - platformFee;

        console.log(`[CHECKOUT_TRACE] Atomic execution: Pay ${grossAmount} ${session.currency} (Fee: ${platformFee})`);

        // 1. Debit Customer (StableX Internal Transfer Pattern)
        const { wallet: updatedCustomerWallet } = await debitUserWallet(
            customer._id,
            session.currency,
            grossAmount,
            `CHKA-OUT-${session.sessionId}`,
            { type: 'checkout_payment', sessionId: session.sessionId, merchantId: session.merchantId },
            'internal'
        );

        // 2. Credit Merchant (Net Amount)
        await creditUserWallet(
            session.merchantId,
            session.currency,
            merchantReceives,
            `CHKA-IN-${session.sessionId}`,
            { type: 'checkout_receipt', sessionId: session.sessionId, customerId: customer._id },
            'internal'
        );

        // 3. Route Platform Fee
        if (PLATFORM_FEE_WALLET_ID && platformFee > 0) {
            await creditUserWallet(
                PLATFORM_FEE_WALLET_ID,
                session.currency,
                platformFee,
                `CHKA-FEE-${session.sessionId}`,
                { type: 'merchant_fee', originalSessionId: session.sessionId, merchantId: session.merchantId },
                'internal'
            ).catch(e => console.error("Fee error:", e.message));
        }

        // 4. Update Session Status
        session.status = 'completed';
        session.paymentMethod = 'StableX';
        session.platformFee = platformFee;
        session.merchantReceives = merchantReceives;
        session.feePercentage = MERCHANT_FEE_PERCENTAGE;
        await session.save();

        // Fire Webhook to Merchant
        try {
            const webhookMerchant = await User.findById(session.merchantId);
            if (webhookMerchant && webhookMerchant.webhookUrl) {
                global.fetch(webhookMerchant.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: 'charge.success',
                        data: {
                            sessionId: session.sessionId,
                            reference: session.reference,
                            amount: session.amount,
                            currency: session.currency,
                            customerEmail: session.customerEmail,
                            status: session.status,
                            completedAt: new Date()
                        }
                    })
                }).catch(err => console.error("[Webhook Error]: Failed to reach merchant server -", err.message));
            }
        } catch (webhookErr) {
            console.error("[Webhook Error]: Internal error while firing webhook -", webhookErr.message);
        }

        res.json({
            success: true,
            message: 'Payment completed successfully',
            successUrl: session.successUrl
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
