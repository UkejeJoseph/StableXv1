
const { ethers } = require('ethers');
try {
    console.log('Testing JsonRpcProvider with undefined...');
    const p1 = new ethers.JsonRpcProvider(undefined);
    console.log('Success (unexpected)');
} catch (e) {
    console.error('Caught error (expected):', e.message);
}

try {
    console.log('Testing JsonRpcProvider with empty string...');
    const p2 = new ethers.JsonRpcProvider("");
    console.log('Success (unexpected)');
} catch (e) {
    console.error('Caught error (expected):', e.message);
}
