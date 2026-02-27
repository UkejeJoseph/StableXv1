import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
// Ensure this key is 32 bytes (64 hex characters)
const MASTER_KEY = Buffer.from(process.env.WALLET_MASTER_KEY || '0000000000000000000000000000000000000000000000000000000000000000', 'hex');

export const encrypt = (text) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag
    };
};

export const decrypt = (encryptedData, iv, authTag) => {
    const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};
