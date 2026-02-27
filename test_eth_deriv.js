
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as tinysecp from 'tiny-secp256k1';
import { ethers } from 'ethers';

const bip32algo = BIP32Factory(tinysecp);

async function testEthDerivation() {
    try {
        const mnemonic = bip39.generateMnemonic(256);
        const seed = await bip39.mnemonicToSeed(mnemonic);
        const root = bip32algo.fromSeed(seed);

        const path = "m/44'/60'/0'/0/0";
        const child = root.derivePath(path);

        console.log('child.privateKey type:', typeof child.privateKey);
        console.log('child.privateKey is Buffer?', Buffer.isBuffer(child.privateKey));

        const hexPriv = child.privateKey.toString('hex');
        console.log('Hex Priv:', hexPriv);

        const fullPriv = '0x' + hexPriv;
        console.log('Full Priv (with 0x):', fullPriv);

        const wallet = new ethers.Wallet(fullPriv);
        console.log('Wallet Address:', wallet.address);

    } catch (err) {
        console.error('Error Details:', err);
    }
}

testEthDerivation();
