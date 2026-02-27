import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
import { ETHEREUM_MAINNET, USDT_CONTRACT, ERC20_ABI } from "@/config/blockchain";
import { toast } from "@/hooks/use-toast";

interface WalletContextType {
  account: string | null;
  balance: string;
  isConnecting: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  transferUSDT: (to: string, amount: string) => Promise<string | null>;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
};

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("0");
  const [isConnecting, setIsConnecting] = useState(false);

  const checkNetwork = async (provider: BrowserProvider) => {
    const network = await provider.getNetwork();
    // Ethereum Mainnet chain ID is 1
    if (network.chainId !== 1n) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: ETHEREUM_MAINNET.chainId }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [ETHEREUM_MAINNET],
          });
        } else {
          throw switchError;
        }
      }
    }
  };

  const getBalance = async (address: string, provider: BrowserProvider) => {
    const contract = new Contract(USDT_CONTRACT.address, ERC20_ABI, provider);
    const bal = await contract.balanceOf(address);
    return formatUnits(bal, USDT_CONTRACT.decimals);
  };

  const refreshBalance = async () => {
    if (account && window.ethereum) {
      const provider = new BrowserProvider(window.ethereum);
      const bal = await getBalance(account, provider);
      setBalance(bal);
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      // No browser extension detected — guide user to install or use mobile
      toast({
        title: "Wallet Not Found",
        description:
          "Please install MetaMask or Trust Wallet extension, or open this page inside your wallet's in-app browser.",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      await checkNetwork(provider);

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      const address = accounts[0];
      setAccount(address);

      const bal = await getBalance(address, provider);
      setBalance(bal);

      toast({
        title: "Wallet Connected",
        description: `Connected to ${address.slice(0, 6)}...${address.slice(-4)} on Ethereum Mainnet`,
      });
    } catch (error: any) {
      console.error("Wallet connection error:", error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setBalance("0");
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected",
    });
  };

  const transferUSDT = async (to: string, amount: string): Promise<string | null> => {
    if (!account || !window.ethereum) return null;

    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(USDT_CONTRACT.address, ERC20_ABI, signer);

      const parsedAmount = parseUnits(amount, USDT_CONTRACT.decimals);
      const tx = await contract.transfer(to, parsedAmount);

      toast({
        title: "Transaction Submitted",
        description: "Waiting for confirmation on Ethereum Mainnet...",
      });

      const receipt = await tx.wait();
      await refreshBalance();

      toast({
        title: "Transfer Successful",
        description: `Sent ${amount} USDT on Ethereum Mainnet`,
      });

      return receipt.hash;
    } catch (error: any) {
      console.error("Transfer error:", error);
      toast({
        title: "Transfer Failed",
        description: error.message || "Transaction failed",
        variant: "destructive",
      });
      return null;
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          setAccount(accounts[0]);
          refreshBalance();
        }
      });

      window.ethereum.on("chainChanged", () => {
        window.location.reload();
      });
    }
  }, []);

  return (
    <WalletContext.Provider
      value={{
        account,
        balance,
        isConnecting,
        connectWallet,
        disconnectWallet,
        transferUSDT,
        refreshBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

declare global {
  interface Window {
    ethereum?: any;
  }
}
