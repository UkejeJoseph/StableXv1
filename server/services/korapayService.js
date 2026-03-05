import fetch from 'node-fetch';
import crypto from 'crypto';

const KORA_SECRET_KEY = process.env.KORAPAY_SECRET_KEY || 'sk_test_...';
const KORA_PUBLIC_KEY = process.env.KORAPAY_PUBLIC_KEY || 'pk_test_...';
const KORA_BASE_URL = 'https://api.korapay.com/merchant/api/v1';

class KorapayService {
    constructor() {
        if (!process.env.KORAPAY_SECRET_KEY || process.env.KORAPAY_SECRET_KEY === 'sk_test_placeholder_key') {
            console.warn(
                '⚠️  [KoraPay] Running with placeholder keys. ' +
                'NGN deposits and virtual accounts will not work. ' +
                'Add real KORAPAY_SECRET_KEY to enable NGN features.'
            );
            this.enabled = false;
        } else {
            this.enabled = true;
        }

        this.headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.KORAPAY_SECRET_KEY || KORA_SECRET_KEY}`
        };
    }

    async createVirtualAccount({ name, email, userId, bvn, bankCode = '035' }) {
        if (!this.enabled) {
            throw new Error('NGN deposits are not available. KoraPay credentials not configured.');
        }
        console.log('[KORAPAY-VBA] Creating VBA for user:', userId);
        console.log('[KORAPAY-VBA] BVN provided:', !!bvn);

        if (!bvn) {
            console.error('[KORAPAY-VBA] ❌ BVN is required since Jan 2024 - aborting');
            throw new Error('BVN is required to create a virtual bank account');
        }

        const accountReference = `VBA-${userId}`; // format MUST be VBA-{userId} for webhook lookup
        console.log('[KORAPAY-VBA] Account reference:', accountReference);

        const payload = {
            account_name: name,
            account_reference: accountReference,
            permanent: true,
            bank_code: bankCode,
            customer: { name, email },
            kyc: { bvn }
        };

        const response = await fetch(`${KORA_BASE_URL}/virtual-bank-account`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('[KORAPAY-VBA] Response:', JSON.stringify(data));
        if (!data.status) {
            throw new Error(`Korapay VBA Error: ${data.message || JSON.stringify(data)}`);
        }
        return data.data;
    }

    async initializeCheckoutCharge({ amount, email, name, reference, redirectUrl }) {
        if (!this.enabled) {
            throw new Error('NGN deposits are not available. KoraPay credentials not configured.');
        }
        console.log('[KORAPAY-SERVICE] Initializing checkout charge');
        console.log('[KORAPAY-SERVICE] Ref:', reference, 'Amount:', amount, 'Email:', email);

        const payload = {
            amount: Math.floor(parseFloat(amount)),
            currency: 'NGN',
            reference,
            customer: { name, email },
            merchant_bears_cost: true,
            notification_url: `${process.env.BACKEND_URL}/webhook/korapay`,
            redirect_url: redirectUrl,
            channels: ['bank_transfer', 'card', 'pay_with_bank']
        };

        console.log('[KORAPAY-SERVICE] Checkout payload:', JSON.stringify(payload));

        const response = await fetch(`${KORA_BASE_URL}/charges/initialize`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('[KORAPAY-SERVICE] Checkout response:', JSON.stringify(data));
        if (!data.status) {
            throw new Error(`Korapay Init Error: ${JSON.stringify(data.message || data)}`);
        }

        // Return checkout_url explicitly so controllers can use it for redirect methods
        return {
            ...data.data,
            checkoutUrl: data.data.checkout_url
        };
    }

    async initializeBankTransfer({ amount, name, email, reference }) {
        console.log('[KORAPAY-BANK-TRANSFER] Initiating for user:', email, 'amount:', amount);

        const payload = {
            account_name: name,
            reference,
            amount: Math.floor(parseFloat(amount)),
            currency: 'NGN',
            customer: { name, email },
            merchant_bears_cost: true,
            notification_url: `${process.env.BACKEND_URL}/webhook/korapay`,
            narration: 'StableX NGN Deposit',
        };

        const res = await fetch(`${KORA_BASE_URL}/charges/bank-transfer`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        console.log('[KORAPAY-BANK-TRANSFER] Response:', JSON.stringify(data));
        return data;
    }

    async initializePayWithBank({ amount, name, email, reference, bankCode, redirectUrl, narration = 'StableX NGN Deposit' }) {
        console.log('[KORAPAY-PWB] Initiating Pay With Bank');
        const payload = {
            amount: Math.floor(parseFloat(amount)),
            currency: 'NGN',
            reference,
            bank_code: bankCode,
            customer: { name, email },
            merchant_bears_cost: true,
            notification_url: `${process.env.BACKEND_URL}/webhook/korapay`,
            redirect_url: redirectUrl,
            narration: narration,
        };
        const res = await fetch(`${KORA_BASE_URL}/charge/pay-with-bank`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        console.log('[KORAPAY-PWB] Response:', JSON.stringify(data));
        return data;
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

    async queryPayout(reference) {
        if (!this.enabled) {
            throw new Error('KoraPay credentials not configured.');
        }
        const url = `${KORA_BASE_URL}/payouts/${reference}`;
        console.log('[KORAPAY] 🔍 Querying Payout status:', url);

        const response = await fetch(url, {
            method: 'GET',
            headers: this.headers
        });

        const data = await response.json();
        return data; // Return full object for handler to decide
    }

    async listBanks() {
        if (!this.enabled) {
            console.warn('[KORAPAY] ⚠️ Service disabled, using fallback bank list.');
            return this._getFallbackBanks();
        }
        const url = `${KORA_BASE_URL}/misc/banks?countryCode=NG`;
        console.log('[KORAPAY] 🏦 Fetching bank list from:', url);
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.KORAPAY_PUBLIC_KEY || process.env.KORA_PUBLIC_KEY}`
                }
            });

            if (response.status === 401) {
                console.error('[KORAPAY] ❌ 401 Unauthorized. Check your KORAPAY_SECRET_KEY.');
                return this._getFallbackBanks();
            }

            const data = await response.json();
            if (!data.status) {
                console.error('[KORAPAY] ❌ Bank List Error:', JSON.stringify(data));
                return this._getFallbackBanks();
            }
            console.log(`[KORAPAY] ✅ Banks fetched: ${data.data?.length || 0}`);
            return data.data;
        } catch (error) {
            console.error('[KORAPAY] 💥 Exception fetching banks:', error.message);
            return this._getFallbackBanks();
        }
    }

    async listPayWithBankBanks() {
        if (!this.enabled) {
            return this._getFallbackBanks().filter(b => ['100004', '100033'].includes(b.bank_code));
        }
        const url = `${KORA_BASE_URL}/charge/pay-with-bank/banks`;
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: this.headers
            });
            const data = await response.json();
            return data.status ? data.data : this._getFallbackBanks().filter(b => ['100004', '100033'].includes(b.bank_code));
        } catch (error) {
            console.error('[KORAPAY] 💥 Exception fetching PWB banks:', error.message);
            return this._getFallbackBanks().filter(b => ['100004', '100033'].includes(b.bank_code));
        }
    }

    _getFallbackBanks() {
        return [
            { bank_name: "Access Bank", bank_code: "044" },
            { bank_name: "GTBank", bank_code: "058" },
            { bank_name: "UBA", bank_code: "033" },
            { bank_name: "Zenith Bank", bank_code: "057" },
            { bank_name: "First Bank", bank_code: "011" },
            { bank_name: "Ecobank", bank_code: "050" },
            { bank_name: "Union Bank", bank_code: "032" },
            { bank_name: "Wema Bank", bank_code: "035" },
            { bank_name: "Fidelity Bank", bank_code: "070" },
            { bank_name: "Sterling Bank", bank_code: "232" },
            { bank_name: "OPay", bank_code: "100004" },
            { bank_name: "Kuda", bank_code: "090267" },
            { bank_name: "PalmPay", bank_code: "100033" }
        ];
    }

    async resolveBankAccount(bankCode, accountNumber) {
        console.log('[KORAPAY-RESOLVE] Verifying account:', accountNumber, 'bank:', bankCode);
        try {
            const res = await fetch(`${KORA_BASE_URL}/misc/banks/resolve`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({
                    bank: bankCode,
                    account: accountNumber,
                    currency: 'NG',
                }),
            });
            const data = await res.json();
            if (!data.status) {
                console.error('[KORAPAY-RESOLVE] ❌ Kora API Error:', data.message || JSON.stringify(data));
                return null;
            }
            return data.data;
        } catch (err) {
            console.error('[KORAPAY-RESOLVE] ❌ Fetch error:', err.message);
            return null;
        }
    }

    async disburseToBankAccount(amount, bankCode, accountNumber, accountName, reference, email, fullName, narration = 'Withdrawal from StableX') {
        if (!this.enabled) {
            throw new Error('NGN deposits are not available. KoraPay credentials not configured.');
        }
        const url = `${KORA_BASE_URL}/transactions/disburse`;

        const payload = {
            reference,
            destination: {
                type: 'bank_account',
                amount: Number(amount),
                currency: 'NGN',
                narration,
                bank_account: {
                    bank: bankCode,
                    account: accountNumber
                },
                customer: {
                    email,
                    name: fullName
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
        return data;
    }

    _generateSignature(payload) {
        const secret = process.env.KORAPAY_SECRET_KEY || KORA_SECRET_KEY;
        return crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');
    }

    verifyWebhookSignature(dataObject, signatureHeader) {
        const secret = process.env.KORAPAY_SECRET_KEY || KORA_SECRET_KEY;
        if (!secret) return false;

        // Korapay signs ONLY the 'data' object in the response payload.
        // We must stringify it exactly as it arrived or as per their JS example: JSON.stringify(req.body.data)
        const hash = crypto
            .createHmac('sha256', secret)
            .update(typeof dataObject === 'string' ? dataObject : JSON.stringify(dataObject))
            .digest('hex');

        return hash === signatureHeader;
    }
}

export default new KorapayService();
