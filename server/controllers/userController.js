import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import Wallet from '../models/walletModel.js';
import { generateMnemonic, deriveWallets } from '../utils/walletGenerator.js';
import { encrypt } from '../utils/encryption.js';

import { generateAuthTokens } from '../utils/tokenService.js';

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
            maxAge: 15 * 60 * 1000 // 15 mins
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
            refreshToken, // Send refresh token optionally in payload, or maybe cookie too later. We keep token out.
        });
    } else {
        console.log(`[AUTH] ❌ Wrong password for: ${email}`);
        res.status(401);
        throw new Error('Invalid email or password');
    }
});

// @desc    Verify OTP
// @route   POST /api/users/verify
// @access  Public
const verifyOtp = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;
    console.log(`[OTP] Verification attempt for: ${email}, OTP provided: ${otp}`);

    const user = await User.findOne({ email });

    if (!user) {
        console.log(`[OTP] ❌ No user found with email: ${email}`);
        res.status(400);
        throw new Error('Invalid or expired OTP');
    }

    console.log(`[OTP] User found. Stored OTP: ${user.otp}, Expires: ${user.otpExpires}`);
    console.log(`[OTP] OTP match: ${user.otp === otp}`);
    console.log(`[OTP] OTP still valid: ${user.otpExpires > Date.now()} (Expires: ${new Date(user.otpExpires).toISOString()}, Now: ${new Date().toISOString()})`);

    if (user.otp === otp && user.otpExpires > Date.now()) {
        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        const { accessToken, refreshToken } = await generateAuthTokens(user._id);

        res.cookie('token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000 // 15 mins
        });

        console.log(`[OTP] ✅ Verification successful for: ${email}`);
        res.json({
            _id: user._id,
            email: user.email,
            role: user.role,
            refreshToken,
            message: "Account verified successfully"
        });
    } else {
        const reason = user.otp !== otp ? 'OTP mismatch' : 'OTP expired';
        console.log(`[OTP] ❌ Verification failed for ${email}: ${reason}`);
        res.status(400);
        throw new Error('Invalid or expired OTP');
    }
});

import { sendOtpEmail } from '../utils/mailService.js';

// @desc    Resend OTP to user's email
// @route   POST /api/users/resend-otp
// @access  Public
const resendOtp = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        res.status(400);
        throw new Error('Email is required');
    }

    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error('No account found with this email');
    }

    if (user.isVerified) {
        res.status(400);
        throw new Error('This account is already verified');
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    console.log(`[Resend OTP] New OTP for ${email}: ${otp}`);

    // Send OTP email
    try {
        await sendOtpEmail(email, otp);
        console.log(`[Resend OTP] ✅ OTP email sent to ${email}`);
    } catch (mailError) {
        console.error(`[Resend OTP] ❌ Email failed:`, mailError.message);
    }

    res.json({ message: 'A new verification code has been sent to your email' });
});

// @desc    Register a new user
// @route   POST /api/users
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    // Generate username from email
    const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    let finalUsername = baseUsername;

    // Check if username exists, append random numbers if it does
    while (await User.findOne({ username: finalUsername })) {
        finalUsername = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const isAdmin = email.toLowerCase() === 'ukejejoseph1@gmail.com';

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = await User.create({
        username: finalUsername,
        name,
        email,
        password,
        role: isAdmin ? 'admin' : 'user',
        kycLevel: 1,
        otp,
        otpExpires,
        isVerified: false
    });

    console.log(`[DEV MODE] OTP for ${email}: ${otp}`);

    // Send Real OTP Email
    try {
        await sendOtpEmail(email, otp);
    } catch (mailError) {
        console.warn("Mail sending failed, but user created (falling back to console):", mailError.message);
    }

    if (user) {
        console.log(`✅ User created: ${user._id}. Starting wallet generation...`);
        // Generate Wallets
        try {
            const mnemonic = generateMnemonic();
            console.log(`🔑 Mnemonic generated. Deriving wallets...`);

            // Get the next available derivation index (auto-increment)
            const maxIndexUser = await User.findOne({ walletDerivationIndex: { $gte: 0 } })
                .sort({ walletDerivationIndex: -1 })
                .select('walletDerivationIndex')
                .lean();
            const nextIndex = maxIndexUser ? maxIndexUser.walletDerivationIndex + 1 : 0;
            console.log(`📊 Assigned derivation index: ${nextIndex}`);

            const walletsData = await deriveWallets(mnemonic, nextIndex);
            console.log(`💳 ${walletsData.length} wallets derived. Encrypting keys...`);

            // Encrypt and save the mnemonic phrase + derivation index to User record
            const encryptedPhrase = encrypt(mnemonic);
            user.encryptedMnemonic = encryptedPhrase.encryptedData;
            user.mnemonicIv = encryptedPhrase.iv;
            user.mnemonicAuthTag = encryptedPhrase.authTag;
            user.walletDerivationIndex = nextIndex;
            await user.save();

            // Encrypt each wallet's private key and save
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

        } catch (error) {
            console.error("Wallet generation failed:", error);
        }

        res.status(201).json({
            _id: user._id,
            email: user.email,
            role: user.role,
            message: 'Registration successful. Please verify your email with the OTP sent.',
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
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
