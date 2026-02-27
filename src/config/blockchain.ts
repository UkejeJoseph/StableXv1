// Ethereum Mainnet Configuration (REAL / LIVE)
export const ETHEREUM_MAINNET = {
  chainId: "0x1", // 1 in hex
  chainName: "Ethereum Mainnet",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: ["https://eth.llamarpc.com"],
  blockExplorerUrls: ["https://etherscan.io"],
};

// Real USDT on Ethereum Mainnet
export const USDT_CONTRACT = {
  address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  decimals: 6,
  symbol: "USDT",
  name: "Tether USD",
};

// Real USDC on Ethereum Mainnet
export const USDC_CONTRACT = {
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  decimals: 6,
  symbol: "USDC",
  name: "USD Coin",
};

export const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "success", type: "bool" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
];

// WalletConnect Project ID (get your own at https://cloud.walletconnect.com)
export const WALLETCONNECT_PROJECT_ID = "YOUR_PROJECT_ID_HERE";
