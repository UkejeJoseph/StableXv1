import crypto from 'crypto';
import User from '../models/userModel.js';

// Helper to generate a secure random key
const generateKey = (prefix) => {
    return `${prefix}_${crypto.randomBytes(24).toString('hex')}`;
};

// @desc    Generate new API keys (Public and Secret)
// @route   POST /api/developer/keys
// @access  Private
export const generateApiKeys = async (req, res) => {
    try {
        const user = req.user;

        // Optional: We can restrict this to only certain KYC levels or Roles
        // if (user.kycStatus !== 'verified' && user.role !== 'admin') {
        //     return res.status(403).json({ success: false, error: 'You must be KYC verified or an Admin to generate API keys.' });
        // }

        const publicKey = generateKey('pk_test'); // We can switch to pk_live conditionally
        const secretKey = generateKey('sk_test');

        user.apiKeys = {
            publicKey,
            secretKey
        };

        await user.save();

        res.json({
            success: true,
            message: 'API keys generated successfully',
            apiKeys: user.apiKeys
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Get current API keys
// @route   GET /api/developer/keys
// @access  Private
export const getApiKeys = async (req, res) => {
    try {
        const user = req.user;

        res.json({
            success: true,
            apiKeys: user.apiKeys || { publicKey: null, secretKey: null },
            webhookUrl: user.webhookUrl || null
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Update Webhook URL
// @route   PUT /api/developer/webhook
// @access  Private
export const updateWebhookUrl = async (req, res) => {
    try {
        const { webhookUrl } = req.body;
        const user = req.user;

        if (webhookUrl && !webhookUrl.startsWith('http')) {
            return res.status(400).json({ success: false, error: 'Invalid Webhook URL. It must be an absolute URL starting with http:// or https://' });
        }

        user.webhookUrl = webhookUrl;
        await user.save();

        res.json({
            success: true,
            message: 'Webhook URL updated successfully',
            webhookUrl: user.webhookUrl
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
