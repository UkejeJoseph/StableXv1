import asyncHandler from 'express-async-handler';
import { getGiftCards, purchaseGiftCardFromReloadly } from '../services/giftcardService.js';
import { creditUserWallet, debitUserWallet } from '../services/walletService.js';
import { getLiveRates } from '../utils/priceService.js';

const PLATFORM_FEE_WALLET_ID = process.env.PLATFORM_FEE_WALLET_ID;
const GIFTCARD_MARKUP = 0.05; // 5% markup on Reloadly wholesale price

// @desc    List available gift cards
// @route   GET /api/giftcards
// @access  Private
export const listGiftCards = asyncHandler(async (req, res) => {
    const { country = 'NG' } = req.query;
    const cards = await getGiftCards(country);
    res.json({ success: true, data: cards });
});

// @desc    Purchase a gift card
// @route   POST /api/giftcards/purchase
// @access  Private
export const purchaseGiftCard = asyncHandler(async (req, res) => {
    const { productId, unitPrice, quantity = 1, recipientEmail, paymentCurrency = 'USDT_TRC20', productCurrency = 'NGN' } = req.body;
    const userId = req.user._id;

    console.log(`[GIFTCARD] 🎁 Purchase Initialized: ${productId} | Recipient: ${recipientEmail} | Pay in: ${paymentCurrency}`);

    if (!productId || !unitPrice || !recipientEmail) {
        return res.status(400).json({ success: false, error: 'Missing required fields: productId, unitPrice, recipientEmail' });
    }

    // 1. Get Live Rates for Conversion
    const rates = await getLiveRates();
    const reloadlyWholesalePrice = Number(unitPrice); // This is in productCurrency (usually NGN for Nigeria)

    let finalCostInPaymentCurrency;

    // 2. Pricing Logic with Conversion
    // If product is in NGN and user pays in USDT_TRC20
    if (productCurrency === 'NGN' && paymentCurrency.startsWith('USDT')) {
        const ngnToUsdtRate = rates.NGN_USDT || (1 / 1600);
        finalCostInPaymentCurrency = reloadlyWholesalePrice * ngnToUsdtRate * (1 + GIFTCARD_MARKUP);
    }
    // If product is in NGN and user pays in NGN
    else if (productCurrency === 'NGN' && paymentCurrency === 'NGN') {
        finalCostInPaymentCurrency = reloadlyWholesalePrice * (1 + GIFTCARD_MARKUP);
    }
    // Default/Fallback (assume already in payment currency or 1:1 if unknown)
    else {
        finalCostInPaymentCurrency = reloadlyWholesalePrice * (1 + GIFTCARD_MARKUP);
    }

    const totalCost = finalCostInPaymentCurrency * Number(quantity);
    const platformProfit = totalCost * (GIFTCARD_MARKUP / (1 + GIFTCARD_MARKUP));

    console.log(`[GIFTCARD] 🧮 Pricing Audit: Wholesale ${reloadlyWholesalePrice} ${productCurrency} -> User pays ${totalCost.toFixed(2)} ${paymentCurrency}`);

    // 3. Debit user wallet
    const txRef = `giftcard_${Date.now()}`;
    const debitResult = await debitUserWallet(userId, paymentCurrency, totalCost, txRef, {
        type: 'giftcard_purchase',
        productId,
        recipientEmail,
        wholesalePrice: reloadlyWholesalePrice,
        productCurrency
    });

    if (!debitResult) {
        return res.status(400).json({ success: false, error: `Insufficient ${paymentCurrency} balance. Need ${totalCost.toFixed(2)}` });
    }

    // 4. Purchase from Reloadly at wholesale price
    try {
        const order = await purchaseGiftCardFromReloadly({
            productId,
            quantity: Number(quantity),
            unitPrice: reloadlyWholesalePrice,
            recipientEmail,
        });

        if (order.status === 'REFUNDED' || (order.errorCode && order.errorCode !== 'SUCCESS')) {
            throw new Error(order.message || 'Reloadly provider error');
        }

        // 5. Credit platform profit
        if (PLATFORM_FEE_WALLET_ID && platformProfit > 0) {
            await creditUserWallet(
                PLATFORM_FEE_WALLET_ID,
                paymentCurrency,
                platformProfit,
                `giftcard_profit_${txRef}`,
                { type: 'giftcard_profit', productId, quantity, originalTx: txRef }
            );
        }

        res.json({
            success: true,
            message: 'Gift card purchased successfully',
            order,
            charged: totalCost,
            currency: paymentCurrency,
        });
    } catch (err) {
        console.error(`[GIFTCARD] ❌ Purchase Failed: ${err.message}. Refunding user...`);
        // Refund user on Reloadly failure
        await creditUserWallet(userId, paymentCurrency, totalCost, `refund_${txRef}`, { type: 'giftcard_refund', originalTx: txRef });
        res.status(500).json({ success: false, error: 'Gift card purchase failed. balance refunded.', details: err.message });
    }
});
