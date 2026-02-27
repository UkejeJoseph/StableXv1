// ──────────────────────────────────────────────────────────────
// ETH Blockchain Listener
// Polls Ethereum RPC for incoming ETH and ERC20 USDT deposits
// Credits internal DB balance on detection
// ──────────────────────────────────────────────────────────────
import { ethers } from 'ethers';
import Wallet from '../models/walletModel.js';
import Transaction from '../models/transactionModel.js';
import { creditUserWallet } from '../services/walletService.js';

const ETH_RPC = "https://ethereum-rpc.publicnode.com";
const USDT_ERC20_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDT_DECIMALS = 6;
const POLL_INTERVAL = 60000; // 60 seconds

// Minimal ERC20 ABI for balanceOf + Transfer event
const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 value)"
];

let provider;

const getProvider = () => {
    if (!provider) {
        provider = new ethers.JsonRpcProvider(ETH_RPC);
    }
    return provider;
};

export const startEthListener = () => {
    console.log("🔗 [ETH] Listener Started: Polling LlamaRPC for ETH/USDT ERC20 deposits...");
    setTimeout(checkEthDeposits, 15000); // Stagger start
    setInterval(checkEthDeposits, POLL_INTERVAL);
};

const checkEthDeposits = async () => {
    try {
        const wallets = await Wallet.find({ currency: { $in: ['ETH', 'USDT_ERC20'] } });

        if (wallets.length === 0) return;

        const ethProvider = getProvider();

        for (const wallet of wallets) {
            // Normalize the address to valid EIP-55 checksum format
            // ethers v6 strictly enforces checksums; raw DB values may have wrong casing
            let checksumAddress;
            try {
                checksumAddress = ethers.getAddress(wallet.address);
            } catch (addrErr) {
                // Completely invalid hex address — skip this wallet silently
                continue;
            }

            if (wallet.currency === 'ETH') {
                await checkEthBalance(wallet, ethProvider, checksumAddress);
                // TODO [Priority 1]: Store ethProvider.getBlockNumber() into wallet.lastCheckedBlock to support missed deposit recovery
            } else if (wallet.currency === 'USDT_ERC20') {
                await checkErc20Balance(wallet, ethProvider, checksumAddress);
                // TODO [Priority 1]: Store ethProvider.getBlockNumber() into wallet.lastCheckedBlock to support missed deposit recovery
            }
        }
    } catch (error) {
        console.error("[ETH] Poll Error:", error.message);
    }
};

/**
 * Check for ETH balance increases by comparing to last known balance
 */
const checkEthBalance = async (wallet, ethProvider, checksumAddress) => {
    try {
        const balanceWei = await ethProvider.getBalance(checksumAddress);
        const balanceEth = parseFloat(ethers.formatEther(balanceWei));

        const lastKnown = wallet.balance || 0;

        // Detect increase
        if (balanceEth > lastKnown && lastKnown > 0) {
            const depositAmount = balanceEth - lastKnown;

            // Skip tiny dust amounts (< 0.0001 ETH)
            if (depositAmount < 0.0001) return;

            const reference = `ETH_DEP_${wallet.address.slice(-8)}_${Date.now()}`;

            // Idempotency: check if we detected this recently
            const recentTx = await Transaction.findOne({
                user: wallet.user,
                currency: 'ETH',
                type: 'deposit',
                status: 'completed',
                createdAt: { $gte: new Date(Date.now() - POLL_INTERVAL * 2) }
            });
            if (recentTx && Math.abs(recentTx.amount - depositAmount) < 0.0001) return;

            console.log('');
            console.log('═══════════════════════════════════════════════');
            console.log(`💰 [ETH] New ETH Deposit Detected!`);
            console.log(`   Amount: ${depositAmount} ETH`);
            console.log(`   Address: ${wallet.address}`);
            console.log(`   User: ${wallet.user}`);
            console.log('═══════════════════════════════════════════════');

            // Check for pending deposit
            const pendingTx = await Transaction.findOne({
                user: wallet.user,
                currency: 'ETH',
                status: 'pending',
                type: 'deposit',
            });

            let txMetadata = { network: 'ETH', confirmedAt: new Date().toISOString() };
            if (pendingTx && pendingTx.metadata) {
                txMetadata = Object.fromEntries(pendingTx.metadata);
                txMetadata.confirmedAt = new Date().toISOString();
            }

            try {
                await creditUserWallet(
                    wallet.user,
                    'ETH',
                    depositAmount,
                    pendingTx ? pendingTx.reference : reference,
                    txMetadata
                );
                console.log(`[ETH] ✅ Credited ${depositAmount} ETH. New balance synchronized.`);
            } catch (err) {
                console.error(`[ETH] Atomic credit error:`, err.message);
            }
        } else if (lastKnown === 0 && balanceEth > 0) {
            // First time seeing balance — just sync without creating a transaction
            await Wallet.updateOne({ _id: wallet._id }, { balance: balanceEth });
            console.log(`[ETH] Synced initial balance: ${balanceEth} ETH for ${wallet.address}`);
        }
    } catch (error) {
        console.error(`[ETH] Error checking ETH for ${wallet.address}:`, error.message);
    }
};

/**
 * Check for USDT ERC20 balance increases
 */
const checkErc20Balance = async (wallet, ethProvider, checksumAddress) => {
    try {
        const contract = new ethers.Contract(USDT_ERC20_CONTRACT, ERC20_ABI, ethProvider);
        const rawBalance = await contract.balanceOf(checksumAddress);
        const balance = parseFloat(ethers.formatUnits(rawBalance, USDT_DECIMALS));

        const lastKnown = wallet.balance || 0;

        if (balance > lastKnown && lastKnown > 0) {
            const depositAmount = balance - lastKnown;

            if (depositAmount < 0.01) return; // Skip dust

            const reference = `USDT_ERC20_DEP_${wallet.address.slice(-8)}_${Date.now()}`;

            console.log('');
            console.log('═══════════════════════════════════════════════');
            console.log(`💰 [ETH] New USDT ERC20 Deposit Detected!`);
            console.log(`   Amount: ${depositAmount} USDT`);
            console.log(`   Address: ${wallet.address}`);
            console.log(`   User: ${wallet.user}`);
            console.log('═══════════════════════════════════════════════');

            const pendingTx = await Transaction.findOne({
                user: wallet.user,
                currency: 'USDT_ERC20',
                status: 'pending',
                type: 'deposit',
            });

            let txMetadata = { network: 'ERC20', confirmedAt: new Date().toISOString() };
            if (pendingTx && pendingTx.metadata) {
                txMetadata = Object.fromEntries(pendingTx.metadata);
                txMetadata.confirmedAt = new Date().toISOString();
            }

            try {
                await creditUserWallet(
                    wallet.user,
                    'USDT_ERC20',
                    depositAmount,
                    pendingTx ? pendingTx.reference : reference,
                    txMetadata
                );
                console.log(`[ETH] ✅ Credited ${depositAmount} USDT ERC20. New balance synchronized.`);
            } catch (err) {
                console.error(`[ETH] Atomic credit error:`, err.message);
            }
        } else if (lastKnown === 0 && balance > 0) {
            await Wallet.updateOne({ _id: wallet._id }, { balance: balance });
            console.log(`[ETH] Synced initial USDT ERC20 balance: ${balance} for ${wallet.address}`);
        }
    } catch (error) {
        console.error(`[ETH] Error checking USDT ERC20 for ${wallet.address}:`, error.message);
    }
};
