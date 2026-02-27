import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
    },
    name: {
        type: String,
    },
    username: {
        type: String,
        unique: true,
        sparse: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['user', 'merchant', 'admin'],
        default: 'user',
    },
    kycStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending',
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    phoneNumber: {
        type: String,
    },
    otp: {
        type: String,
    },
    otpExpires: {
        type: Date,
    },
    merchantProfile: {
        businessName: String,
        taxId: String,
        bankAccounts: [{
            accountName: String,
            accountNumber: String,
            bankCode: String,
            bankName: String,
            isDefault: { type: Boolean, default: false }
        }]
    },
    // Security: Store encrypted mnemonic to allow recovery or key derivation
    encryptedMnemonic: { type: String },
    mnemonicIv: { type: String },
    mnemonicAuthTag: { type: String },
    // HD Wallet: Each user gets a unique derivation index
    walletDerivationIndex: {
        type: Number,
        default: -1, // -1 means not yet assigned
    },
    // Google OAuth: Store Google profile ID
    googleId: { type: String, default: null },
    // Developer API Gateway
    apiKeys: {
        publicKey: { type: String, default: null, index: true },
        secretKey: { type: String, default: null, index: true },
    },
    webhookUrl: { type: String, default: null },
    webhookSecret: { type: String, default: null },
}, {
    timestamps: true,
});

userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
