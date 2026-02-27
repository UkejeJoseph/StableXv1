import { NetworkType } from "./wallet";

export interface TransactionRequest {
  network: NetworkType;
  fromAddress: string;
  toAddress: string;
  amount: string;
}

export interface GasFeeEstimate {
  network: NetworkType;
  gasPrice: string;
  gasLimit: string;
  totalFee: string;
  feeInUSD: string;
}

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  explorerUrl?: string;
}

export const FEES = {
  ETH: 0.005,
  USDT_ERC20: 15,
  USDT_TRC20: 1.5,
  BTC: 0.0002,
  SOL: 0.02,
  TRX: 15,
};

export async function estimateGasFee(
  network: NetworkType,
  toAddress: string,
  amount: string
): Promise<GasFeeEstimate> {
  // In a real centralized exchange, this would query a dynamic backend endpoint.
  // We're returning static/estimated values for the display UI.
  try {
    switch (network) {
      case "ETH":
      case "USDT_ERC20": {
        const fee = network === "ETH" ? FEES.ETH : FEES.USDT_ERC20;
        return {
          network,
          gasPrice: "20 Gwei",
          gasLimit: "21000",
          totalFee: `${fee} ${network.includes("USDT") ? "USDT" : "ETH"}`,
          feeInUSD: `$${fee === FEES.ETH ? "15.00" : "15.00"}`, // Approximation
        };
      }

      case "SOL": {
        return {
          network,
          gasPrice: "5000 lamports",
          gasLimit: "1",
          totalFee: `${FEES.SOL} SOL`,
          feeInUSD: "$0.02",
        };
      }

      case "BTC": {
        return {
          network,
          gasPrice: "10 sat/byte",
          gasLimit: "250 bytes",
          totalFee: `${FEES.BTC} BTC`,
          feeInUSD: "$12.00",
        };
      }

      case "USDT_TRC20":
      case "TRX":
      case "ETH_TRC20":
      case "SOL_TRC20": {
        const isTx = network === "TRX";
        const fee = isTx ? `${FEES.TRX} TRX` : `${FEES.USDT_TRC20} USDT`;
        const feeUsd = isTx ? "$1.8" : "$1.50";
        return {
          network,
          gasPrice: "Dynamic",
          gasLimit: "1",
          totalFee: fee,
          feeInUSD: feeUsd,
        };
      }

      default:
        throw new Error(`Unsupported network: ${network}`);
    }
  } catch (error) {
    console.error("Error estimating gas:", error);
    return {
      network,
      gasPrice: "Unknown",
      gasLimit: "Unknown",
      totalFee: "Unable to estimate",
      feeInUSD: "Unknown",
    };
  }
}

export async function sendTransaction(request: TransactionRequest): Promise<TransactionResult> {
  const { network, toAddress, amount } = request;

  try {
    const response = await fetch("/api/transactions/withdraw-crypto", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        network,
        toAddress,
        amount,
        currency: network // The backend expects currency/network mapping
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || "Transaction failed",
      };
    }

    return {
      success: true,
      txHash: result.txHash,
      explorerUrl: getExplorerUrl(network, result.txHash),
    };

  } catch (error: any) {
    console.error("Transaction error:", error);
    return {
      success: false,
      error: error.message || "An unexpected error occurred",
    };
  }
}

export function getExplorerUrl(network: NetworkType, txHash: string): string {
  switch (network) {
    case "BTC":
      return `https://blockstream.info/tx/${txHash}`;
    case "ETH":
    case "USDT_ERC20":
      return `https://etherscan.io/tx/${txHash}`;
    case "SOL":
      return `https://solscan.io/tx/${txHash}`;
    case "USDT_TRC20":
    case "TRX":
    case "ETH_TRC20":
    case "SOL_TRC20":
      return `https://tronscan.org/#/transaction/${txHash}`;
    default:
      return "";
  }
}

export function validateAddress(network: NetworkType, address: string): boolean {
  try {
    switch (network) {
      case "ETH":
      case "USDT_ERC20":
        return /^0x[a-fA-F0-9]{40}$/.test(address);

      case "SOL":
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);

      case "BTC":
        return /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(address);

      case "USDT_TRC20":
      case "TRX":
      case "ETH_TRC20":
      case "SOL_TRC20":
        return /^T[a-zA-Z0-9]{33}$/.test(address);

      default:
        return false;
    }
  } catch {
    return false;
  }
}

export interface TransactionStatus {
  confirmed: boolean;
  confirmations: number;
  blockNumber?: number;
  timestamp?: string;
}

export async function getTransactionStatus(
  network: NetworkType,
  txHash: string
): Promise<TransactionStatus> {
  // In a centralized exchange context, you don't poll the blockchain from the client
  // You poll your own database REST endpoint to see if the status is "completed"
  return { confirmed: true, confirmations: 1 };
}
