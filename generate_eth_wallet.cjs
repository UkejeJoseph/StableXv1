
const { ethers } = require('ethers');

const wallet = ethers.Wallet.createRandom();
console.log('--- NEW ETH TREASURY WALLET ---');
console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);
console.log('-------------------------------');
console.log('IMPORTANT: Save this private key securely. Fund the address with 0.05 ETH for gas.');
