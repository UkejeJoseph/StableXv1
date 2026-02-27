// ──────────────────────────────────────────────────────────────
// BTC Blockchain Listener
// Polls Blockstream API for incoming BTC deposits to user wallets
// Credits internal DB balance on detection
// ──────────────────────────────────────────────────────────────
import Wallet from '../models/walletModel.js';
import Transaction from '../models/transactionModel.js';
import { creditUserWallet } from '../services/walletService.js';

const BTC_API = "https://blockstream.info/api";
const POLL_INTERVAL = 60000; // 60 seconds

export const startBtcListener = () => {
    console.log("🔗 [BTC] Listener Started: Polling Blockstream for BTC deposits...");
    // Initial check after 10s, then every 60s
    setTimeout(checkBtcDeposits, 10000);
    setInterval(checkBtcDeposits, POLL_INTERVAL);
};

const checkBtcDeposits = async () => {
    try {
        const wallets = await Wallet.find({ currency: 'BTC' });

        if (wallets.length === 0) return;

        for (const wallet of wallets) {
            await checkBtcWallet(wallet);
        }
    } catch (error) {
        console.error("[BTC] Poll Error:", error.message);
    }
};

const checkBtcWallet = async (wallet) => {
    try {
        // Fetch recent transactions for this address
        const url = `${BTC_API}/address/${wallet.address}/txs`;
        // TODO [Priority 1]: Use wallet.lastCheckedBlock / last tx cursor to fetch only new transactions instead of just recent 25 to prevent missed BTC deposits.
        const response = await fetch(url);

        if (!response.ok) {
            // Rate limited or error — skip this cycle
            return;
        }

        const transactions = await response.json();

        if (!Array.isArray(transactions) || transactions.length === 0) return;

        for (const tx of transactions) {
            // Only process confirmed transactions
            if (!tx.status?.confirmed) continue;

            const txid = tx.txid;

            // Check idempotency — skip if already processed
            const existingTx = await Transaction.findOne({ reference: txid });
            if (existingTx) continue;

            // Check if any output is directed to our wallet
            for (const vout of tx.vout) {
                if (vout.scriptpubkey_address === wallet.address) {
                    const amountBtc = vout.value / 100_000_000; // satoshis to BTC

                    console.log('');
                    console.log('═══════════════════════════════════════════════');
                    console.log(`💰 [BTC] New Deposit Detected!`);
                    console.log(`   Amount: ${amountBtc} BTC`);
                    console.log(`   To: ${wallet.address}`);
                    console.log(`   TxHash: ${txid}`);
                    console.log(`   User: ${wallet.user}`);
                    console.log('═══════════════════════════════════════════════');

                    // Check for matching pending transaction
                    const pendingTx = await Transaction.findOne({
                        user: wallet.user,
                        currency: 'BTC',
                        status: 'pending',
                        type: 'deposit',
                    });

                    let txMetadata = {
                        onChainTxHash: txid,
                        block: tx.status.block_height?.toString(),
                        network: 'BTC',
                        confirmedAt: new Date().toISOString()
                    };

                    if (pendingTx && pendingTx.metadata) {
                        txMetadata = { ...Object.fromEntries(pendingTx.metadata), ...txMetadata };
                    }

                    try {
                        await creditUserWallet(
                            wallet.user,
                            'BTC',
                            amountBtc,
                            pendingTx ? pendingTx.reference : txid,
                            txMetadata
                        );
                        console.log(`[BTC] ✅ Credited ${amountBtc} BTC to User ${wallet.user}. Balance updated atomically.`);
                    } catch (err) {
                        console.error(`[BTC] Atomic credit error for ${txid}:`, err.message);
                    }
                }
            }
        }
    } catch (error) {
        console.error(`[BTC] Error checking wallet ${wallet.address}:`, error.message);
    }
};
