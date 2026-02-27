import fetch from 'node-fetch';
import crypto from 'crypto';

const KORA_SECRET_KEY = process.env.KORA_SECRET_KEY || 'sk_test_...';
const KORA_PUBLIC_KEY = process.env.KORA_PUBLIC_KEY || 'pk_test_...';
const KORA_BASE_URL = 'https://api.korapay.com/merchant/api/v1';

class KorapayService {
    constructor() {
        if (!process.env.KORA_SECRET_KEY || process.env.KORA_SECRET_KEY === 'sk_test_placeholder_key') {
            console.warn(
                '⚠️  [KoraPay] Running with placeholder keys. ' +
                'NGN deposits and virtual accounts will not work. ' +
                'Add real KORA_SECRET_KEY to enable NGN features.'
            );
            this.enabled = false;
        } else {
            this.enabled = true;
        }

        this.headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.KORA_SECRET_KEY || KORA_SECRET_KEY}`
        };
    }

    async createVirtualAccount(user, accountReference, permanent = false) {
        if (!this.enabled) {
            throw new Error('NGN deposits are not available. KoraPay credentials not configured.');
        }
        const url = `${KORA_BASE_URL}/virtual-bank-account`;

        const payload = {
            account_name: `${user.firstName || 'StableX'} ${user.lastName || 'Checkout'}`.trim(),
            account_reference: accountReference,
            permanent: permanent,
            bank_code: '035', // Wema Bank is default for Kora dynamic accounts
            customer: {
                name: `${user.firstName || 'StableX'} ${user.lastName || ''}`.trim(),
                email: user.email,
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!data.status) {
            throw new Error(`Korapay VBA Error: ${data.message || JSON.stringify(data)}`);
        }
        return data.data;
    }

    async initializeCheckoutCharge(amount, email, name, reference, redirectUrl) {
        if (!this.enabled) {
            throw new Error('NGN deposits are not available. KoraPay credentials not configured.');
        }
        const url = `${KORA_BASE_URL}/charges/initialize`;

        const payload = {
            amount,
            currency: 'NGN',
            reference,
            customer: { name, email },
            merchant_bears_cost: true,
            notification_url: `${process.env.FRONTEND_URL}/api/korapay/webhook`,
            redirect_url: redirectUrl
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!data.status) {
            throw new Error(`Korapay Init Error: ${JSON.stringify(data.message || data)}`);
        }
        return data.data;
    }

    async queryCharge(reference) {
        if (!this.enabled) {
            throw new Error('NGN deposits are not available. KoraPay credentials not configured.');
        }
        const url = `${KORA_BASE_URL}/charges/${reference}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: this.headers
        });

        const data = await response.json();
        if (!data.status) {
            throw new Error(`Korapay Query Error: ${data.message || 'Unknown error'}`);
        }
        return data.data;
    }

    async listBanks() {
        if (!this.enabled) {
            throw new Error('NGN deposits are not available. KoraPay credentials not configured.');
        }
        const url = `${KORA_BASE_URL}/misc/banks`;

        const response = await fetch(url, {
            method: 'GET',
            headers: this.headers
        });

        const data = await response.json();
        if (!data.status) {
            throw new Error(`Korapay Bank List Error: ${data.message || 'Unknown error'}`);
        }
        return data.data;
    }

    async disburseToBankAccount(amount, bankCode, accountNumber, accountName, reference, narration = 'Withdrawal from StableX') {
        if (!this.enabled) {
            throw new Error('NGN deposits are not available. KoraPay credentials not configured.');
        }
        const url = `${KORA_BASE_URL}/transactions/disburse`;

        const payload = {
            reference,
            destination: {
                type: 'bank_account',
                amount,
                currency: 'NGN',
                narration,
                bank_account: {
                    bank: bankCode,
                    account: accountNumber,
                    name: accountName
                }
            }
        };

        const signature = this._generateSignature(payload);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                ...this.headers,
                'X-Korapay-Signature': signature
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!data.status) {
            throw new Error(`Korapay Payout Error: ${data.message || 'Unknown error'}`);
        }
        return data.data;
    }

    _generateSignature(payload) {
        const secret = KORA_SECRET_KEY;
        return crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');
    }

    verifyWebhookSignature(payloadBody, signatureHeader) {
        const secret = process.env.KORA_WEBHOOK_SECRET || KORA_SECRET_KEY;
        if (!secret) return false;

        const hash = crypto
            .createHmac('sha256', secret)
            .update(typeof payloadBody === 'string' ? payloadBody : JSON.stringify(payloadBody))
            .digest('hex');

        return hash === signatureHeader;
    }
}

export default new KorapayService();
