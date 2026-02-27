import dotenv from 'dotenv';
import korapayService from '../services/korapayService.js';

dotenv.config({ path: '../.env' });

/**
 * Vetting Script for KoraPay Integration
 * Purpose: Verify that the temporary account generation logic works with the API.
 */
async function vetKoraIntegration() {
    console.log('--- Starting KoraPay Integration Vetting ---');

    // 1. Check Env
    const secretKey = process.env.KORA_SECRET_KEY;
    if (!secretKey || secretKey.includes('...')) {
        console.error('❌ FAILED: KORA_SECRET_KEY is missing or contains placeholder in .env');
        console.log('Please add your actual KoraPay Secret Key to the .env file before running this script again.');
        return;
    }
    console.log('✅ ENV: KoraPay keys detected.');

    // 2. Test Bank List (Simpler check)
    try {
        console.log('Testing listBanks()...');
        const banks = await korapayService.listBanks();
        console.log(`✅ Success: Found ${banks.length} banks.`);
    } catch (error) {
        console.error('❌ FAILED: listBanks() failed.', error.message);
    }

    // 3. Test Temporary Account Generation (The "Jeroid" Flow)
    const mockUser = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com'
    };
    const reference = `VET_REF_${Date.now()}`;

    try {
        console.log('Testing createVirtualAccount (Jeroid Style)...');
        const vba = await korapayService.createVirtualAccount(mockUser, reference, false);
        console.log('✅ Success: Temporary account generated.');
        console.log('Bank:', vba.bank_name);
        console.log('Account Number:', vba.account_number);
    } catch (error) {
        console.error('❌ FAILED: createVirtualAccount() failed.', error.message);
    }

    console.log('--- Vetting Complete ---');
}

vetKoraIntegration();
