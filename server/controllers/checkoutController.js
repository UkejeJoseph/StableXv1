import crypto from 'crypto';
import CheckoutSession from '../models/checkoutSessionModel.js';
import User from '../models/userModel.js';
import Wallet from '../models/walletModel.js';
import Transaction from '../models/transactionModel.js';
import { creditUserWallet } from '../services/walletService.js';

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

        const baseUrl = process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:5000/web';
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

        const session = await CheckoutSession.findOne({ sessionId, status: 'pending' });
        if (!session) {
            return res.status(404).json({ success: false, error: 'Session not found or already completed/expired' });
        }

        if (session.expiresAt < new Date()) {
            session.status = 'expired';
            await session.save();
            return res.status(400).json({ success: false, error: 'Session has expired' });
        }

        // Prevent paying yourself
        if (session.merchantId.toString() === customer._id.toString()) {
            return res.status(400).json({ success: false, error: 'You cannot pay your own checkout session' });
        }

        // Verify Balances
        const customerWallet = await Wallet.findOne({ user: customer._id, currency: session.currency });
        if (!customerWallet || customerWallet.balance < session.amount) {
            return res.status(400).json({ success: false, error: `Insufficient ${session.currency} balance` });
        }

        const merchantWallet = await Wallet.findOne({ user: session.merchantId, currency: session.currency, walletType: 'merchant' });
        if (!merchantWallet) {
            return res.status(400).json({ success: false, error: 'Merchant wallet error' });
        }

        // Verify Balances + Deduct atomically to avoid race conditions
        const updatedCustomerWallet = await Wallet.findOneAndUpdate(
            { _id: customerWallet._id, balance: { $gte: session.amount } },
            { $inc: { balance: -session.amount } },
            { new: true }
        );

        if (!updatedCustomerWallet) {
            return res.status(400).json({ success: false, error: `Insufficient ${session.currency} balance or concurrent transaction.` });
        }

        // Calculate merchant fee
        const grossAmount = session.amount;
        const platformFee = grossAmount * MERCHANT_FEE_PERCENTAGE;
        const merchantReceives = grossAmount - platformFee;

        // Credit Merchant Atomically (minus fee)
        await Wallet.findOneAndUpdate(
            { _id: merchantWallet._id },
            { $inc: { balance: merchantReceives } },
            { new: true }
        );

        // Update Session with fee breakdown
        session.status = 'completed';
        session.paymentMethod = 'StableX';
        session.platformFee = platformFee;
        session.merchantReceives = merchantReceives;
        session.feePercentage = MERCHANT_FEE_PERCENTAGE;
        await session.save();

        // Route platform fee to platform wallet
        if (PLATFORM_FEE_WALLET_ID && platformFee > 0) {
            try {
                await creditUserWallet(
                    PLATFORM_FEE_WALLET_ID,
                    session.currency,
                    platformFee,
                    `checkout_fee_${session.sessionId}`,
                    { type: 'merchant_fee', merchantId: session.merchantId.toString() }
                );
            } catch (feeErr) {
                console.error('[FEE ROUTING] Merchant fee credit failed:', feeErr.message);
            }
        }

        // Record Transactions
        await Transaction.create({
            user: customer._id,
            type: 'transfer',
            status: 'completed',
            amount: session.amount,
            currency: session.currency,
            reference: `CHKA-OUT-${Date.now()}`,
            description: `Payment to Merchant Order: ${session.reference}`
        });

        await Transaction.create({
            user: session.merchantId,
            type: 'deposit',
            status: 'completed',
            amount: session.amount,
            currency: session.currency,
            reference: `CHKA-IN-${Date.now()}`,
            description: `Checkout Payment from @${customer.username}`
        });

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
