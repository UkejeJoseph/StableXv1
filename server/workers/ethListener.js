import { ethers } from 'ethers';
import Wallet from '../models/walletModel.js';
import Transaction from '../models/transactionModel.js';
import { creditUserWallet } from '../services/walletService.js';
import { decrypt } from '../utils/encryption.js';
import SweepQueue from '../models/sweepQueueModel.js';

const ETH_RPC = process.env.ETH_RPC_URL || "https://ethereum-rpc.publicnode.com";
const USDT_ERC20_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDT_DECIMALS = 6;
const CONFIRMATION_THRESHOLD = 12;
const POLL_INTERVAL = 30000; // 30 seconds
const ENABLE_SWEEP = process.env.ENABLE_AUTO_SWEEP === 'true';
const HOT_WALLET = process.env.STABLEX_HOT_WALLET_ETH;
const TREASURY_PRIVATE_KEY = process.env.STABLEX_TREASURY_ETH_PRIVATE_KEY;

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 value)"
];

let provider;
const getProvider = () => {
    if (!provider) {
        const p1 = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL || "https://ethereum-rpc.publicnode.com");
        const p2 = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
        const p3 = new ethers.JsonRpcProvider('https://rpc.ankr.com/eth');
        const p4 = new ethers.JsonRpcProvider('https://cloudflare-eth.com');
        const p5 = new ethers.JsonRpcProvider(process.env.ETH_RPC_ALCHEMY_URL);

        provider = new ethers.FallbackProvider([
            { provider: p1, priority: 1, weight: 1 },
            { provider: p2, priority: 2, weight: 1 },
            { provider: p3, priority: 3, weight: 1 },
            { provider: p4, priority: 4, weight: 1 },
            { provider: p5, priority: 5, weight: 1 }
        ]);
    }
    return provider;
};

export const startEthListener = () => {
    console.log(`🔗 [ETH] Listener Started: Polling ${ETH_RPC} for ETH/USDT deposits...`);
    console.log(`🔄 [ETH] Auto-Sweep: ${ENABLE_SWEEP ? 'ENABLED' : 'DISABLED'} | Hot Wallet: ${HOT_WALLET}`);
    setInterval(pollBlocks, POLL_INTERVAL);
    setInterval(checkConfirmations, POLL_INTERVAL * 2);
};

/**
 * Strategy: Track last polled block in Wallet.lastCheckedBlock.
 * Fetch Transfer events for each wallet address.
 */
const pollBlocks = async () => {
    try {
        const ethProvider = getProvider();
        const currentBlock = await ethProvider.getBlockNumber();
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

            // Check for ETH balance increase
            const balanceWei = await ethProvider.getBalance(wallet.address);
            const balance = parseFloat(ethers.formatEther(balanceWei));

            // Note: Since ETH doesn't have a reliable 'Transfer' event for native ETH,
            // we use balance polling but combine with block confirmation logic.
            if (balance > (wallet.lastKnownBalance || 0)) {
                await handleDetectedDeposit(wallet, balance - (wallet.lastKnownBalance || 0), 'ETH', currentBlock);
            }

            // Check for USDT ERC20 Transfer events
            const usdtContract = new ethers.Contract(USDT_ERC20_CONTRACT, ERC20_ABI, ethProvider);
            const filter = usdtContract.filters.Transfer(null, wallet.address);
            const events = await usdtContract.queryFilter(filter, lastBlock + 1, currentBlock);

            for (const event of events) {
                const amount = parseFloat(ethers.formatUnits(event.args.value, USDT_DECIMALS));
                await handleDetectedDeposit(wallet, amount, 'USDT_ERC20', event.blockNumber, event.transactionHash);
            }

            // Update last checked block
            wallet.lastCheckedBlock = String(currentBlock);
            wallet.lastKnownBalance = balance;
            await wallet.save();
        }
    } catch (err) {
        console.error("[ETH] Poll Blocks Error:", err.message);
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
    try {
        const ethProvider = getProvider();
        const currentBlock = await ethProvider.getBlockNumber();
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
    try {
        console.log(`🔄 [ETH] Sweeping ${amount} ${currency} from ${wallet.address}...`);
        const ethProvider = getProvider();
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
    if (!TREASURY_PRIVATE_KEY) return;
    const ethProvider = getProvider();
    const treasury = new ethers.Wallet(TREASURY_PRIVATE_KEY, ethProvider);
    const tx = await treasury.sendTransaction({
        to: toAddress,
        value: amountWei
    });
    console.log(`⛽ [ETH] Gas fund tx: ${tx.hash}`);
    await tx.wait(1);
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
