import WebhookQueue from '../models/webhookQueueModel.js';
import { deliverWebhook } from '../services/webhookService.js';

const POLL_INTERVAL = 30000; // 30 seconds

export const startWebhookWorker = () => {
    console.log("🔗 [WEBHOOK] Retry Worker Started: Processing outgoing notifications...");
    setInterval(processWebhooks, POLL_INTERVAL);
};

const processWebhooks = async () => {
    try {
        const pending = await WebhookQueue.find({
            status: 'pending',
            nextRetryAt: { $lte: new Date() }
        }).limit(20);

        for (const webhook of pending) {
            webhook.status = 'processing';
            await webhook.save();

            console.log(`[WEBHOOK] Attempting delivery of ${webhook.eventType} to ${webhook.url}`);
            await deliverWebhook(webhook);
        }
    } catch (err) {
        console.error("[WEBHOOK] Worker Error:", err.message);
    }
};
