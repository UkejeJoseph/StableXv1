import { ethers } from "ethers";
import { NetworkType } from "./wallet";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

const TOKEN_CONTRACTS: Record<string, string> = {
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  TRC20_USDT: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
};

const TOKEN_DECIMALS: Record<string, number> = {
  USDT: 6,
  USDC: 6,
  WBTC: 8,
  DAI: 18,
};

const RPC_ENDPOINTS = {
  ETH: "https://eth.llamarpc.com",
  SOL: "https://api.mainnet-beta.solana.com",
  BTC: "https://blockstream.info/api",
  TRC20: "https://api.trongrid.io",
  XRP: "https://xrplcluster.com",
};

export async function getBalance(address: string, network: NetworkType): Promise<string> {
  try {
    switch (network) {
      case "BTC":
        return await getBTCBalance(address);
      case "ETH":
        return await getETHBalance(address);
      case "SOL":
        return await getSOLBalance(address);
      case "USDT_ERC20":
        return await getERC20Balance(address, "USDT");
      case "USDT_TRC20":
        return await getUSDTTRC20Balance(address);
      case "XRP":
        return await getXRPBalance(address);
      case "USDC_ERC20":
        return await getERC20Balance(address, "USDC");
      case "WBTC":
        return await getERC20Balance(address, "WBTC");
      case "DAI":
        return await getERC20Balance(address, "DAI");
      default:
        return "0";
    }
  } catch (error) {
    console.error(`Error fetching balance for ${network}:`, error);
    return "0";
  }
}

async function getBTCBalance(address: string): Promise<string> {
  const response = await fetch(`${RPC_ENDPOINTS.BTC}/address/${address}`);
  if (!response.ok) return "0";
  const data = await response.json();
  const satoshis = (data.chain_stats?.funded_txo_sum || 0) - (data.chain_stats?.spent_txo_sum || 0);
  return (satoshis / 100000000).toFixed(8);
}

async function getETHBalance(address: string): Promise<string> {
  const provider = new ethers.JsonRpcProvider(RPC_ENDPOINTS.ETH);
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}

async function getSOLBalance(address: string): Promise<string> {
  const response = await fetch(RPC_ENDPOINTS.SOL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [address],
    }),
  });
  const data = await response.json();
  if (data.result?.value) {
    return (data.result.value / 1000000000).toFixed(9);
  }
  return "0";
}

async function getERC20Balance(address: string, token: string): Promise<string> {
  const provider = new ethers.JsonRpcProvider(RPC_ENDPOINTS.ETH);
  const contractAddress = TOKEN_CONTRACTS[token];
  if (!contractAddress) return "0";
  const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider);
  const balance = await contract.balanceOf(address);
  const decimals = TOKEN_DECIMALS[token] || 18;
  return ethers.formatUnits(balance, decimals);
}

async function getUSDTTRC20Balance(address: string): Promise<string> {
  const response = await fetch(
    `${RPC_ENDPOINTS.TRC20}/v1/accounts/${address}/tokens?token_id=${TOKEN_CONTRACTS.TRC20_USDT}`
  );
  if (!response.ok) return "0";
  const data = await response.json();
  if (data.data && data.data.length > 0) {
    const token = data.data.find((t: any) => t.token_id === TOKEN_CONTRACTS.TRC20_USDT);
    if (token) {
      return (Number(token.balance) / 1000000).toFixed(6);
    }
  }
  return "0";
}

async function getXRPBalance(address: string): Promise<string> {
  try {
    const response = await fetch(RPC_ENDPOINTS.XRP, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "account_info",
        params: [
          {
            account: address,
            strict: true,
            ledger_index: "current",
          },
        ],
      }),
    });
    const data = await response.json();
    if (data.result?.account_data?.Balance) {
      const drops = parseInt(data.result.account_data.Balance, 10);
      return (drops / 1000000).toFixed(6);
    }
    return "0";
  } catch {
    return "0";
  }
}

export async function sendTransaction(
  privateKey: string,
  toAddress: string,
  amount: string,
  network: NetworkType
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    switch (network) {
      case "ETH":
        return await sendETHTransaction(privateKey, toAddress, amount);
      case "USDT_ERC20":
        return await sendERC20Transaction(privateKey, toAddress, amount, "USDT");
      case "USDC_ERC20":
        return await sendERC20Transaction(privateKey, toAddress, amount, "USDC");
      case "WBTC":
        return await sendERC20Transaction(privateKey, toAddress, amount, "WBTC");
      case "DAI":
        return await sendERC20Transaction(privateKey, toAddress, amount, "DAI");
      default:
        return { success: false, error: `Send not yet implemented for ${network}` };
    }
  } catch (error: any) {
    return { success: false, error: error.message || "Transaction failed" };
  }
}

async function sendETHTransaction(
  privateKey: string,
  toAddress: string,
  amount: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const provider = new ethers.JsonRpcProvider(RPC_ENDPOINTS.ETH);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  const tx = await wallet.sendTransaction({
    to: toAddress,
    value: ethers.parseEther(amount),
  });
  
  const receipt = await tx.wait();
  return { success: true, txHash: receipt?.hash };
}

async function sendERC20Transaction(
  privateKey: string,
  toAddress: string,
  amount: string,
  token: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const provider = new ethers.JsonRpcProvider(RPC_ENDPOINTS.ETH);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contractAddress = TOKEN_CONTRACTS[token];
  if (!contractAddress) return { success: false, error: "Unknown token" };
  const contract = new ethers.Contract(contractAddress, ERC20_ABI, wallet);
  
  const decimals = TOKEN_DECIMALS[token] || 18;
  const amountInUnits = ethers.parseUnits(amount, decimals);
  
  const tx = await contract.transfer(toAddress, amountInUnits);
  const receipt = await tx.wait();
  return { success: true, txHash: receipt?.hash };
}

export function getExplorerUrl(txHash: string, network: NetworkType): string {
  switch (network) {
    case "BTC":
      return `https://blockstream.info/tx/${txHash}`;
    case "ETH":
    case "USDT_ERC20":
    case "USDC_ERC20":
    case "WBTC":
    case "DAI":
      return `https://etherscan.io/tx/${txHash}`;
    case "SOL":
      return `https://solscan.io/tx/${txHash}`;
    case "USDT_TRC20":
      return `https://tronscan.org/#/transaction/${txHash}`;
    case "XRP":
      return `https://xrpscan.com/tx/${txHash}`;
    default:
      return "";
  }
}

export function getAddressExplorerUrl(address: string, network: NetworkType): string {
  switch (network) {
    case "BTC":
      return `https://blockstream.info/address/${address}`;
    case "ETH":
    case "USDT_ERC20":
    case "USDC_ERC20":
    case "WBTC":
    case "DAI":
      return `https://etherscan.io/address/${address}`;
    case "SOL":
      return `https://solscan.io/account/${address}`;
    case "USDT_TRC20":
      return `https://tronscan.org/#/address/${address}`;
    case "XRP":
      return `https://xrpscan.com/account/${address}`;
    default:
      return "";
  }
}
