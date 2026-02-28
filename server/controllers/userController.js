import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';
import Wallet from '../models/walletModel.js';
import redis from '../config/redis.js';
import { generateMnemonic, deriveWallets } from '../utils/walletGenerator.js';
import { encrypt } from '../utils/encryption.js';
import { generateAuthTokens, generateAccessToken } from '../utils/tokenService.js';
import { sendOtpEmail } from '../utils/mailService.js';

// Helper: Generate wallets for a newly verified user
const generateWalletsForUser = async (user) => {
    try {
        console.log(`[REGISTRATION] 🔑 Generating mnemonic for ${user.email}...`);
        const mnemonic = generateMnemonic();
        const derIndex = 0;

        console.log(`[REGISTRATION] 📊 Deriving wallets...`);
        const walletsData = await deriveWallets(mnemonic, derIndex);

        // Encrypt and save the mnemonic
        const encryptedPhrase = encrypt(mnemonic);
        user.encryptedMnemonic = encryptedPhrase.encryptedData;
        user.mnemonicIv = encryptedPhrase.iv;
        user.mnemonicAuthTag = encryptedPhrase.authTag;
        user.walletDerivationIndex = derIndex;
        await user.save();

        // Encrypt each wallet's private key and save
        const walletsToSave = walletsData.map(w => {
            const { encryptedData, iv, authTag } = encrypt(w.privateKey);
            return {
                user: user._id,
                walletType: user.role === 'merchant' ? 'merchant' : 'user',
                network: w.currency,
                currency: w.currency,
                address: w.address,
                encryptedPrivateKey: encryptedData,
                privateKeyIv: iv,
                privateKeyAuthTag: authTag
            };
        });

        await Wallet.insertMany(walletsToSave);
        console.log(`[REGISTRATION] ✨ Wallets created for ${user.email}`);
        return true;
    } catch (error) {
        console.error("[REGISTRATION] ❌ Wallet generation failed:", error.message);
        throw error;
    }
};

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
const authUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    console.log(`[AUTH] Login attempt for: ${email}`);

    const user = await User.findOne({ email });

    if (!user) {
        console.log(`[AUTH] ❌ No user found with email: ${email}`);
        res.status(401);
        throw new Error('Invalid email or password');
    }

    const passwordMatch = await user.matchPassword(password);
    console.log(`[AUTH] Password match: ${passwordMatch}`);

    if (passwordMatch) {
        if (!user.isVerified) {
            console.log(`[AUTH] ❌ User ${email} is not verified`);
            res.status(401);
            throw new Error('Please verify your email/phone first');
        }

        const { accessToken, refreshToken } = await generateAuthTokens(user._id);

        res.cookie('token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000 // 15 minutes
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        console.log(`[AUTH] ✅ Login successful for: ${email} (ID: ${user._id})`);
        res.json({
            _id: user._id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            kycStatus: user.kycStatus,
            isVerified: user.isVerified,
        });
    } else {
        console.log(`[AUTH] ❌ Wrong password for: ${email}`);
        res.status(401);
        throw new Error('Invalid email or password');
    }
});

// @desc    Verify OTP (Original for compatibility)
// @route   POST /api/users/verify
// @access  Public
const verifyOtp = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;
    console.log(`[OTP] Verification attempt for: ${email}`);

    // Check Redis for pending registration
    const pendingData = await redis.get(`otp:register:${email}`);

    if (!pendingData) {
        // Fallback to check MongoDB for legacy users (optional, but requested new flow)
        const user = await User.findOne({ email });
        if (user && user.otp === otp && user.otpExpires > Date.now()) {
            user.isVerified = true;
            user.otp = undefined;
            user.otpExpires = undefined;
            await user.save();

            const { accessToken, refreshToken } = await generateAuthTokens(user._id);
            res.cookie('token', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 15 * 60 * 1000 });
            res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });

            return res.json({ _id: user._id, email: user.email, role: user.role, message: "Account verified successfully" });
        }

        return res.status(400).json({
            message: 'OTP expired or session not found. Please register again.',
            expired: true
        });
    }

    const { name, email: pendingEmail, password, otp: storedOtp, role, phoneNumber, merchantProfile } = JSON.parse(pendingData);

    if (otp !== storedOtp) {
        return res.status(400).json({ message: 'Incorrect OTP. Please try again.' });
    }

    // Create account NOW in MongoDB
    // Note: We don't hash password here because it was hashed in registerUser
    // But User.create hash hook won't trigger if we pass a pre-hashed string? 
    // Actually User model hook hashes if isModified('password'). 
    // Let's store plain password in Redis (safe in private Redis) or skip hook.
    // User requested hashed storage in Redis.

    // To prevent double hashing by the model hook, we can create directly
    const user = new User({
        name,
        email: pendingEmail,
        password, // already hashed
        role: role || 'user',
        phoneNumber,
        merchantProfile,
        isVerified: true
    });

    // Manually set as not modified so hook doesn't re-hash
    user.isNew = true;
    await user.save();

    // Generate wallets
    try {
        await generateWalletsForUser(user);
    } catch (err) {
        console.error('[WALLETS] ❌ Generation failed during verify:', err.message);
    }

    // Delete Redis key
    await redis.del(`otp:register:${email}`);

    // Generate tokens and set cookies
    const { accessToken, refreshToken } = await generateAuthTokens(user._id);

    res.cookie('token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000
    });

    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
        message: 'Account created successfully',
        user: {
            _id: user._id,
            email: user.email,
            role: user.role,
        }
    });
});

// @desc    Resend OTP to user's email
// @route   POST /api/users/resend-otp
// @access  Public
const resendOtp = asyncHandler(async (req, res) => {
    const { email } = req.body;

    // Check Redis for pending registration
    const pendingData = await redis.get(`otp:register:${email}`);

    if (!pendingData) {
        return res.status(400).json({
            message: 'Session expired. Please register again.',
            expired: true
        });
    }

    const parsed = JSON.parse(pendingData);

    // Generate new OTP
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    parsed.otp = newOtp;

    // Reset TTL to 10 minutes
    await redis.setex(`otp:register:${email}`, 600, JSON.stringify(parsed));

    try {
        await sendOtpEmail(email, newOtp);
        return res.json({ message: 'New OTP sent to your email' });
    } catch (mailError) {
        return res.status(500).json({ message: 'Failed to send OTP.' });
    }
});

// @desc    Register a new user
// @route   POST /api/users
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
    const { email, password, name, phoneNumber, role, merchantProfile } = req.body;
    console.log(`[REGISTRATION] Attempt for email: ${email}`);

    try {
        if (!name || !email || !password) {
            res.status(400);
            throw new Error('Name, email and password are required');
        }

        const userExists = await User.findOne({ email });
        if (userExists && userExists.isVerified) {
            res.status(409);
            throw new Error('An account with this email already exists. Please log in.');
        }

        // Hash password now for storage in Redis
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Store pending registration in Redis (10 min TTL)
        const pendingData = {
            name,
            email,
            password: hashedPassword,
            otp,
            role: role || 'user',
            phoneNumber,
            merchantProfile,
            createdAt: Date.now()
        };

        await redis.setex(`otp:register:${email}`, 600, JSON.stringify(pendingData));

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[DEV MODE] OTP for ${email}: ${otp}`);
        }

        let emailSent = true;
        try {
            await sendOtpEmail(email, otp);
            console.log('[OTP_TRACE] ✅ OTP sent to:', email);
        } catch (mailError) {
            console.error('[OTP_TRACE] ❌ Failed to send OTP:', mailError.message);
            emailSent = false;
        }

        return res.status(200).json({
            message: emailSent ? 'OTP sent to your email' : 'Account pending. Use resend button.',
            emailSent,
            email
        });

    } catch (error) {
        console.error(`[REGISTRATION] ❌ Error: ${error.message}`);
        throw error;
    } finally {
        console.log(`[REGISTRATION] Attempt finished for: ${email}`);
    }
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        // Fetch user's wallets
        const wallets = await Wallet.find({ user: user._id }).select('-encryptedPrivateKey -iv -authTag');

        res.json({
            _id: user._id,
            email: user.email,
            role: user.role,
            wallets: wallets
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// @desc    Search user by username
// @route   GET /api/users/search
// @access  Private
const searchUser = asyncHandler(async (req, res) => {
    const { q } = req.query;
    if (!q) {
        return res.status(400).json({ message: 'Username query is required' });
    }

    const cleanUsername = q.replace('@', '').toLowerCase();

    // Find user by username exact match (case insensitive)
    const user = await User.findOne({
        username: new RegExp(`^${cleanUsername}$`, 'i')
    }).select('username email _id');

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Prevent sending to self
    if (req.user && user._id.toString() === req.user._id.toString()) {
        return res.status(400).json({ message: 'You cannot send money to yourself' });
    }

    res.json(user);
});

// @desc    Logout user / clear cookie
// @route   POST /api/users/logout
// @access  Public
const logoutUser = asyncHandler(async (req, res) => {
    res.cookie('token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: new Date(0),
    });
    res.cookie('refreshToken', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: new Date(0),
    });
    res.status(200).json({ message: 'Logged out successfully' });
});

export {
    authUser,
    registerUser,
    getUserProfile,
    verifyOtp,
    resendOtp,
    searchUser,
    logoutUser,
};
