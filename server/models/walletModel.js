import mongoose from 'mongoose';

const walletSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    walletType: {
        type: String,
        enum: ['user', 'merchant', 'treasury', 'hot'],
        default: 'user',
    },
    currency: {
        type: String, // Legacy, e.g. BTC, ETH
    },
    network: {
        type: String, // e.g. BTC, ETH
        required: true,
    },
    balance: {
        type: Number,
        default: 0,
        min: [0, 'Wallet balance cannot be negative']
    },
    address: {
        type: String,
        required: true,
    },
    encryptedPrivateKey: {
        type: String,
        required: true,
    },
    iv: {
        type: String, // Legacy
    },
    authTag: {
        type: String, // Legacy
    },
    privateKeyIv: {
        type: String, // New
    },
    privateKeyAuthTag: {
        type: String, // New
    },
    encryptedMnemonic: {
        type: String,
    },
    mnemonicIv: {
        type: String,
    },
    mnemonicAuthTag: {
        type: String,
    },
    isCustodial: {
        type: Boolean,
        default: true,
    },
    lastCheckedBlock: {
        type: String, // String for extremely large block numbers on TRON/ETH
        default: "0",
    },
    lastCheckedTimestamp: {
        type: Date,
        default: Date.now,
    }
}, {
    timestamps: true,
});

walletSchema.index({ user: 1, currency: 1, walletType: 1 });
walletSchema.index({ address: 1 });

const Wallet = mongoose.model('Wallet', walletSchema);
export default Wallet;
