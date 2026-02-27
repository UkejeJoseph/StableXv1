import User from '../models/userModel.js';

export const requireApiKey = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'Unauthorized: Missing API Key' });
        }

        const apiKey = authHeader.split(' ')[1];

        // Find user by either secretKey or publicKey
        const merchant = await User.findOne({
            $or: [
                { 'apiKeys.secretKey': apiKey },
                { 'apiKeys.publicKey': apiKey }
            ]
        });

        if (!merchant) {
            return res.status(401).json({ success: false, error: 'Unauthorized: Invalid API Key' });
        }

        req.merchant = merchant;
        req.apiKeyType = apiKey.startsWith('sk_') ? 'secret' : 'public';

        next();
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Authorization Error' });
    }
};
