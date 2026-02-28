import { ethers } from 'ethers';
import Wallet from '../models/walletModel.js';
import Transaction from '../models/transactionModel.js';
import { creditUserWallet } from '../services/walletService.js';
import { decrypt } from '../utils/encryption.js';
import SweepQueue from '../models/sweepQueueModel.js';

import { withRetry } from '../utils/retry.js';

const ETH_RPC = process.env.ETH_RPC_URL || "https://ethereum-rpc.publicnode.com";
const USDT_ERC20_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDT_DECIMALS = 6;
const CONFIRMATION_THRESHOLD = 12;
const POLL_INTERVAL = 10000; // 10 seconds
const ENABLE_SWEEP = process.env.ENABLE_AUTO_SWEEP === 'true';
const HOT_WALLET = process.env.STABLEX_HOT_WALLET_ETH;
const TREASURY_PRIVATE_KEY = process.env.STABLEX_TREASURY_ETH_PRIVATE_KEY;

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const RPC_URLS = [
    process.env.ETH_RPC_URL,
    'https://lb.drpc.live/ethereum/Aj0ag2yiJEfWo3zCvW8aHOtPF89TFHcR8ZsQtuZZzRRv',
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
    'https://cloudflare-eth.com',
    'https://ethereum-rpc.publicnode.com',
    process.env.ETH_RPC_ALCHEMY_URL,
].filter(Boolean);

let ethProvider = null;

const initProvider = async () => {
    for (const url of RPC_URLS) {
        try {
            const p = new ethers.JsonRpcProvider(url);
            const blockNumber = await p.getBlockNumber();
            console.log(`[ETH] Connected to RPC: ${url} (block ${blockNumber})`);
            ethProvider = p;
            return p;
        } catch (err) {
            console.warn(`[ETH] RPC failed, trying next: ${url}`);
        }
    }
    console.error('[ETH] All RPC providers failed. ETH deposits disabled.');
    return null;
};

export const startEthListener = async () => {
    await initProvider();
    console.log(`🔗 [ETH] Listener Started | Auto-Sweep: ${ENABLE_SWEEP ? 'ENABLED' : 'DISABLED'} | Hot Wallet: ${HOT_WALLET}`);
    setInterval(pollBlocks, POLL_INTERVAL);
    setInterval(checkConfirmations, POLL_INTERVAL * 2);
};

/**
 * Strategy: Track last polled block in Wallet.lastCheckedBlock.
 * Fetch Transfer events for each wallet address.
 */
const pollBlocks = async () => {
    if (!ethProvider) {
        // retry provider init
        ethProvider = await initProvider();
        if (!ethProvider) return;
    }

    let currentBlock;
    try {
        currentBlock = await ethProvider.getBlockNumber();
    } catch (err) {
        console.error('[ETH] Poll Blocks Error (Network):', err.message);
        ethProvider = null; // force reinit on next cycle
        return;
    }

    try {
        const wallets = await Wallet.find({ currency: { $in: ['ETH', 'USDT_ERC20'] } });

        for (const wallet of wallets) {
            const lastBlock = parseInt(wallet.lastCheckedBlock || "0");
            if (lastBlock === 0) {
                // Initialize for new wallets to current block - 100 to catch recent deposits
                wallet.lastCheckedBlock = String(currentBlock);
                await wallet.save();
                continue;
            }

            if (currentBlock <= lastBlock) continue;

            // Check for ETH balance increase with retry
            const balanceWei = await withRetry(() => ethProvider.getBalance(wallet.address));
            const balance = parseFloat(ethers.formatEther(balanceWei));

            // Note: Since ETH doesn't have a reliable 'Transfer' event for native ETH,
            // we use balance polling but combine with block confirmation logic.
            if (balance > (wallet.lastKnownBalance || 0)) {
                await handleDetectedDeposit(wallet, balance - (wallet.lastKnownBalance || 0), 'ETH', currentBlock);
            }

            // Check for USDT ERC20 Transfer events
            const usdtContract = new ethers.Contract(USDT_ERC20_CONTRACT, ERC20_ABI, ethProvider);
            const filter = usdtContract.filters.Transfer(null, wallet.address);
            const events = await withRetry(() => usdtContract.queryFilter(filter, lastBlock + 1, currentBlock));

            for (const event of events) {
                const amount = parseFloat(ethers.formatUnits(event.args.value, USDT_DECIMALS));
                await handleDetectedDeposit(wallet, amount, 'USDT_ERC20', event.blockNumber, event.transactionHash);
            }

            // Update last checked block
            wallet.lastCheckedBlock = String(currentBlock);
            wallet.lastKnownBalance = balance;
            await wallet.save();

            // Sequential delay to avoid RPC rate limits
            await new Promise(r => setTimeout(r, 200));
        }
    } catch (err) {
        console.error("[ETH] Poll Blocks Error (Processing):", err.message);
    }
};

const handleDetectedDeposit = async (wallet, amount, currency, blockNumber, txHash = null) => {
    // Avoid processing own sweeps or tiny dust
    if (amount <= 0) return;

    const reference = txHash || `ETH_DEP_${wallet.address.slice(-6)}_${blockNumber}`;
    const existing = await Transaction.findOne({ reference });
    if (existing) return;

    console.log(`💰 [ETH] Found ${amount} ${currency} deposit for ${wallet.address} in block ${blockNumber}`);

    await Transaction.create({
        user: wallet.user,
        type: 'deposit',
        status: 'confirming',
        amount,
        currency,
        reference,
        metadata: {
            network: 'ETH',
            onChainTxHash: txHash,
            blockNumber: String(blockNumber),
            confirmations: '0',
            requiredConfirmations: String(CONFIRMATION_THRESHOLD),
            walletId: String(wallet._id)
        }
    });
};

const checkConfirmations = async () => {
    if (!ethProvider) {
        ethProvider = await initProvider();
        if (!ethProvider) return;
    }

    let currentBlock;
    try {
        currentBlock = await ethProvider.getBlockNumber();
    } catch (err) {
        console.error('[ETH] Confirmation Check Error (Network):', err.message);
        ethProvider = null;
        return;
    }

    try {
        const confirmingTxs = await Transaction.find({ status: 'confirming', currency: { $in: ['ETH', 'USDT_ERC20'] } });

        for (const tx of confirmingTxs) {
            const txBlock = parseInt(tx.metadata.get('blockNumber'));
            const confirmations = currentBlock - txBlock;
            tx.metadata.set('confirmations', String(confirmations));
            await tx.save();

            if (confirmations >= CONFIRMATION_THRESHOLD) {
                console.log(`✅ [ETH] Tx ${tx.reference} confirmed (${confirmations}/${CONFIRMATION_THRESHOLD})`);

                try {
                    const creditResult = await creditUserWallet(
                        tx.user,
                        tx.currency,
                        tx.amount,
                        tx.reference,
                        { confirmedAt: new Date().toISOString(), blockNumber: txBlock }
                    );

                    const user = await User.findById(tx.user);
                    if (user && user.webhookUrl) {
                        await queueWebhook(user, 'deposit.confirmed', {
                            txHash: tx.reference,
                            amount: tx.amount,
                            currency: tx.currency,
                            network: 'ETH'
                        });
                    }

                    if (ENABLE_SWEEP && HOT_WALLET && creditResult.wallet) {
                        await sweepToHotWallet(creditResult.wallet, tx.currency, tx.amount, tx.reference);
                    }
                } catch (creditErr) {
                    console.error(`[ETH] Credit/Sweep failed for ${tx.reference}:`, creditErr.message);
                }
            }
        }
    } catch (err) {
        console.error("[ETH] Confirmation Check Error:", err.message);
    }
};

export const sweepToHotWallet = async (wallet, currency, amount, depositTxHash) => {
    if (!ethProvider) {
        ethProvider = await initProvider();
        if (!ethProvider) return;
    }
    try {
        console.log(`🔄 [ETH] Sweeping ${amount} ${currency} from ${wallet.address}...`);
        const privateKey = decrypt(wallet.encryptedPrivateKey, wallet.iv, wallet.authTag);
        const signer = new ethers.Wallet(privateKey, ethProvider);

        if (currency === 'ETH') {
            const gasPrice = (await ethProvider.getFeeData()).gasPrice;
            const gasLimit = 21000n;
            const totalGas = gasPrice * gasLimit;
            const balanceWei = await ethProvider.getBalance(wallet.address);

            if (balanceWei <= totalGas) throw new Error("Balance too small to cover gas for sweep");

            const sweepAmountWei = balanceWei - totalGas;
            const tx = await signer.sendTransaction({
                to: HOT_WALLET,
                value: sweepAmountWei,
                gasPrice,
                gasLimit
            });
            console.log(`🚀 [ETH] Native sweep broadcasted: ${tx.hash}`);
            await recordSweep(wallet, currency, parseFloat(ethers.formatEther(sweepAmountWei)), tx.hash, depositTxHash);

            const user = await User.findById(wallet.user);
            if (user && user.webhookUrl) {
                await queueWebhook(user, 'sweep.completed', {
                    sweepTxHash: tx.hash,
                    depositTxHash,
                    amount: parseFloat(ethers.formatEther(sweepAmountWei)),
                    currency,
                    network: 'ETH'
                });
            }
        } else {
            // USDT ERC20 Sweep
            const gasPrice = (await ethProvider.getFeeData()).gasPrice;
            const gasLimit = 65000n; // Estimate for USDT transfer
            const totalGas = gasPrice * gasLimit;

            const ethBalance = await ethProvider.getBalance(wallet.address);
            if (ethBalance < totalGas) {
                console.log(`⛽ [ETH] Funding gas for USDT sweep...`);
                await fundGasFromTreasury(wallet.address, totalGas);
                // Return and let it be swept in next retry or after delay
                throw new Error("Gas funded, waiting for next cycle to sweep USDT");
            }

            const usdtContract = new ethers.Contract(USDT_ERC20_CONTRACT, ERC20_ABI, signer);
            const amountRaw = ethers.parseUnits(String(amount), USDT_DECIMALS);
            const tx = await usdtContract.transfer(HOT_WALLET, amountRaw, { gasPrice, gasLimit });
            console.log(`🚀 [ETH] USDT sweep broadcasted: ${tx.hash}`);
            await recordSweep(wallet, currency, amount, tx.hash, depositTxHash);
        }
    } catch (err) {
        console.error(`❌ [ETH] Sweep Error:`, err.message);
        await sendOperationalAlert('SWEEP_FAILED', {
            network: 'ETH',
            currency,
            amount,
            wallet: wallet.address,
            error: err.message
        });
        await SweepQueue.create({
            walletId: wallet._id,
            tokenSymbol: currency,
            amount,
            depositTxHash,
            status: 'pending',
            lastError: err.message
        });
    }
};

const fundGasFromTreasury = async (toAddress, amountWei) => {
    if (!ethProvider) {
        ethProvider = await initProvider();
        if (!ethProvider) return;
    }
    try {
        if (!TREASURY_PRIVATE_KEY) return;
        const treasury = new ethers.Wallet(TREASURY_PRIVATE_KEY, ethProvider);
        const tx = await treasury.sendTransaction({
            to: toAddress,
            value: amountWei
        });
        await tx.wait();
        console.log(`⛽ [GAS] Funded ${toAddress} with ${ethers.formatEther(amountWei)} ETH`);
    } catch (err) {
        console.error(`❌ [GAS] Funding failed:`, err.message);
    }
};

const recordSweep = async (wallet, currency, amount, sweepTxHash, depositTxHash) => {
    await Transaction.create({
        user: wallet.user,
        type: 'sweep',
        status: 'completed',
        amount,
        currency,
        reference: sweepTxHash,
        description: `Auto-sweep ${amount} ${currency} to hot wallet`,
        metadata: { sweepTxHash, depositTxHash, network: 'ETH' }
    });
};
