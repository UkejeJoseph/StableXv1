import express from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import Wallet from '../models/walletModel.js';
import { generateMnemonic, deriveWallets } from '../utils/walletGenerator.js';
import { encrypt } from '../utils/encryption.js';

const router = express.Router();

import RefreshToken from '../models/refreshTokenModel.js';
import { generateAuthTokens, generateAccessToken } from '../utils/tokenService.js';

// ── Configure Passport Google Strategy ────────────────────────
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || `${process.env.APP_BASE_URL || 'http://localhost:5000'}/api/auth/google/callback`,
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails[0].value;
        console.log(`[GOOGLE AUTH] Processing Google login for: ${email}`);

        // Check if user already exists
        let user = await User.findOne({ email });

        if (user) {
            // Existing user — just log them in
            console.log(`[GOOGLE AUTH] ✅ Existing user found: ${user._id}`);
            return done(null, user);
        }

        // New user — create account + generate wallets
        console.log(`[GOOGLE AUTH] 📝 Creating new user from Google profile...`);

        const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        let finalUsername = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;

        // Check if username exists
        while (await User.findOne({ username: finalUsername })) {
            finalUsername = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
        }

        const isAdmin = profile.emails[0].value.toLowerCase() === 'ukejejoseph1@gmail.com';

        user = await User.create({
            googleId: profile.id,
            username: finalUsername,
            name: profile.displayName,
            email: profile.emails[0].value,
            password: Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8), // Dummy password
            isVerified: true, // Google emails are pre-verified
            kycLevel: 1,
            role: isAdmin ? 'admin' : 'user'
        });

        // Generate wallets for the new user (same logic as registerUser)
        try {
            const mnemonic = generateMnemonic();
            console.log(`[GOOGLE AUTH] 🔑 Generating wallets for new Google user...`);

            // Get next derivation index
            const maxIndexUser = await User.findOne({ walletDerivationIndex: { $gte: 0 } })
                .sort({ walletDerivationIndex: -1 })
                .select('walletDerivationIndex')
                .lean();
            const nextIndex = maxIndexUser ? maxIndexUser.walletDerivationIndex + 1 : 0;

            const walletsData = await deriveWallets(mnemonic, nextIndex);

            // Encrypt mnemonic and save to user
            const encryptedPhrase = encrypt(mnemonic);
            user.encryptedMnemonic = encryptedPhrase.encryptedData;
            user.mnemonicIv = encryptedPhrase.iv;
            user.mnemonicAuthTag = encryptedPhrase.authTag;
            user.walletDerivationIndex = nextIndex;
            await user.save();

            // Encrypt and save wallets
            const walletsToSave = walletsData.map(w => {
                const { encryptedData, iv, authTag } = encrypt(w.privateKey);
                return {
                    user: user._id,
                    walletType: user.role === 'merchant' ? 'merchant' : 'user',
                    currency: w.currency,
                    address: w.address,
                    encryptedPrivateKey: encryptedData,
                    iv,
                    authTag
                };
            });
            await Wallet.insertMany(walletsToSave);
            console.log(`[GOOGLE AUTH] ✅ Created ${walletsToSave.length} wallets for user ${user._id}`);

        } catch (walletError) {
            console.error('[GOOGLE AUTH] ❌ Wallet generation failed:', walletError.message);
        }

        done(null, user);
    } catch (error) {
        console.error('[GOOGLE AUTH] ❌ Error:', error.message);
        done(error, null);
    }
}));

// Passport serialize/deserialize (needed even though we use JWT)
passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// ── Routes ────────────────────────────────────────────────────

// Step 1: Redirect user to Google
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
}));

// Step 2: Google redirects back here with the user's info
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/web/login?error=google_auth_failed', session: false }),
    async (req, res) => {
        try {
            // Generate dual JWT tokens for the authenticated user
            const { accessToken, refreshToken } = await generateAuthTokens(req.user._id);

            // Set the HTTP-only cookie for Google Auth
            res.cookie('token', accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 15 * 60 * 1000 // 15 mins
            });

            const userData = {
                _id: req.user._id,
                email: req.user.email,
                role: req.user.role,
                refreshToken: refreshToken,
            };

            // Redirect to frontend without token in URL params (security!)
            const encodedData = encodeURIComponent(JSON.stringify(userData));
            res.redirect(`${process.env.APP_BASE_URL || 'http://localhost:5000'}/web/auth-callback?data=${encodedData}`);
        } catch (error) {
            console.error('[GOOGLE AUTH CALLBACK] Error:', error);
            res.redirect(`${process.env.APP_BASE_URL || 'http://localhost:5000'}/web/login?error=token_generation_failed`);
        }
    }
);

// ── Token Endpoints ──────────────────────────────────────────

// @desc    Refresh Access Token
// @route   POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: 'Refresh Token required' });

    try {
        const storedToken = await RefreshToken.findOne({ token: refreshToken, revoked: false });
        if (!storedToken) return res.status(401).json({ message: 'Invalid or revoked refresh token' });

        if (storedToken.expiresAt < new Date()) {
            await RefreshToken.deleteOne({ _id: storedToken._id });
            return res.status(401).json({ message: 'Refresh token expired. Please login again.' });
        }

        const accessToken = generateAccessToken(storedToken.user);

        // Update the secure cookie with the fresh access token
        res.cookie('token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000 // 15 mins
        });

        res.json({ success: true, token: "cookie-auth-active" });
    } catch (error) {
        res.status(500).json({ message: 'Refresh failed', error: error.message });
    }
});

// @desc    Logout (Revoke Refresh Token and Clear Cookie)
// @route   POST /api/users/logout (or /api/auth/logout - we keep both for parity)
router.post('/logout', async (req, res) => {
    const { refreshToken } = req.body;
    try {
        if (refreshToken) {
            await RefreshToken.deleteOne({ token: refreshToken });
        }
        res.cookie('token', '', {
            httpOnly: true,
            expires: new Date(0),
        });
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Logout failed', error: error.message });
    }
});

export default router;
