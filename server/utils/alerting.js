import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import Transaction from '../models/transactionModel.js';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

let bot;
if (token && chatId) {
    bot = new TelegramBot(token, { polling: false });
}

/**
 * Send alert to Telegram
 */
export const sendAlert = async (message) => {
    try {
        console.log(`[ALERT] ${message}`);
        if (bot && chatId) {
            await bot.sendMessage(chatId, `🚨 *StableX Alert* 🚨\n\n${message}`, { parse_mode: 'Markdown' });
        }
    } catch (err) {
        console.error(`[ALERT] Failed to send Telegram alert:`, err.message);
    }
};

/**
 * Specialized alert for failed sweeps or large deposits
 */
export const sendOperationalAlert = async (type, data) => {
    const message = `*Type:* ${type}\n${Object.entries(data).map(([k, v]) => `*${k}:* ${v}`).join('\n')}`;
    await sendAlert(message);
};

/**
 * Send daily summary of transactions and fees
 */
export const sendDailyStats = async () => {
    try {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const txs = await Transaction.find({ createdAt: { $gte: yesterday }, status: 'completed' });

        const deposits = txs.filter(t => t.type === 'deposit').length;
        const depositVolume = txs.filter(t => t.type === 'deposit').reduce((sum, t) => sum + (t.amount || 0), 0);
        const withdrawals = txs.filter(t => t.type === 'withdrawal').length;

        const stats = `📊 *Daily Platform Report*\n\n` +
            `✅ Deposits: ${deposits}\n` +
            `💰 Volume: ${depositVolume.toFixed(4)} (mixed currencies)\n` +
            `📤 Withdrawals: ${withdrawals}\n\n` +
            `_Report generated at ${new Date().toISOString()}_`;

        await sendAlert(stats);
    } catch (err) {
        console.error(`[ALERT] Failed to generate daily stats:`, err.message);
    }
};
