import WebhookQueue from '../models/webhookQueueModel.js';
import crypto from 'crypto';
import fetch from 'node-fetch';

/**
 * Service to handle signing and queuing webhooks
 */
export const queueWebhook = async (user, eventType, data) => {
    try {
        if (!user.webhookUrl) return;

        // Generate signature if user has a secret (assume user.webhookSecret exists or use a default)
        const secret = user.webhookSecret || process.env.WEBHOOK_SIGNING_SECRET || 'stablex_secret';
        const signature = crypto
            .createHmac('sha512', secret)
            .update(JSON.stringify(data))
            .digest('hex');

        await WebhookQueue.create({
            user: user._id,
            url: user.webhookUrl,
            eventType,
            payload: data,
            signature
        });

        console.log(`[WEBHOOK] Queued ${eventType} for ${user.email}`);
    } catch (err) {
        console.error(`[WEBHOOK] Error queuing webhook:`, err.message);
    }
};

export const deliverWebhook = async (webhook) => {
    try {
        const response = await fetch(webhook.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-StableX-Event': webhook.eventType,
                'X-StableX-Signature': webhook.signature,
            },
            body: JSON.stringify(webhook.payload),
            timeout: 10000,
        });

        if (response.ok) {
            webhook.status = 'completed';
            webhook.lastResponse = `Success: ${response.status}`;
        } else {
            throw new Error(`Endpoint returned ${response.status}`);
        }
    } catch (err) {
        webhook.retryCount += 1;
        webhook.lastResponse = err.message;

        if (webhook.retryCount >= 5) {
            webhook.status = 'failed';
        } else {
            // Exponential backoff: 2min, 10min, 30min, 2h, 6h
            const delays = [2, 10, 30, 120, 360];
            const nextDelay = delays[webhook.retryCount - 1] || 60;
            webhook.nextRetryAt = new Date(Date.now() + nextDelay * 60000);
            webhook.status = 'pending';
        }
    }

    await webhook.save();
};
