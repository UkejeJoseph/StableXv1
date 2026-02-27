import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import RefreshToken from '../models/refreshTokenModel.js';

export const generateAccessToken = (id) => {
    // 15 minutes for access token
    return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod', {
        expiresIn: '15m',
    });
};

export const generateRefreshToken = async (id) => {
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 Days

    // Save to DB
    await RefreshToken.create({
        user: id,
        token: refreshToken,
        expiresAt,
    });

    return refreshToken;
};

export const generateAuthTokens = async (id) => {
    const accessToken = generateAccessToken(id);
    const refreshToken = await generateRefreshToken(id);
    return { accessToken, refreshToken };
};
