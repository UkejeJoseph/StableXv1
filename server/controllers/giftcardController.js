import asyncHandler from 'express-async-handler';
import { getGiftCards, purchaseGiftCardFromReloadly } from '../services/giftcardService.js';
import { creditUserWallet, debitUserWallet } from '../services/walletService.js';

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
    const { productId, unitPrice, quantity = 1, recipientEmail, paymentCurrency = 'USDT_TRC20' } = req.body;
    const userId = req.user._id;

    if (!productId || !unitPrice || !recipientEmail) {
        return res.status(400).json({ success: false, error: 'Missing required fields: productId, unitPrice, recipientEmail' });
    }

    // Calculate pricing: user pays wholesale + 5% markup
    const reloadlyPrice = Number(unitPrice);
    const userPrice = reloadlyPrice * (1 + GIFTCARD_MARKUP);
    const platformProfit = (userPrice - reloadlyPrice) * Number(quantity);
    const totalCost = userPrice * Number(quantity);

    // Debit user wallet
    const txRef = `giftcard_${Date.now()}`;
    const debitResult = await debitUserWallet(userId, paymentCurrency, totalCost, txRef);
    if (!debitResult) {
        return res.status(400).json({ success: false, error: `Insufficient ${paymentCurrency} balance. Need ${totalCost}` });
    }

    // Purchase from Reloadly at wholesale price
    try {
        const order = await purchaseGiftCardFromReloadly({
            productId,
            quantity: Number(quantity),
            unitPrice: reloadlyPrice,
            recipientEmail,
        });

        // Credit platform profit
        if (PLATFORM_FEE_WALLET_ID && platformProfit > 0) {
            await creditUserWallet(
                PLATFORM_FEE_WALLET_ID,
                paymentCurrency,
                platformProfit,
                `giftcard_profit_${txRef}`,
                { type: 'giftcard_profit', productId, quantity }
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
        // Refund user on Reloadly failure
        await creditUserWallet(userId, paymentCurrency, totalCost, `refund_${txRef}`, { type: 'giftcard_refund' });
        res.status(500).json({ success: false, error: 'Gift card purchase failed. Balance refunded.', details: err.message });
    }
});
