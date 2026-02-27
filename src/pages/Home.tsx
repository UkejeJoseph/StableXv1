import { useState } from "react";
import { Header } from "@/components/Header";
import { BalanceDisplay } from "@/components/BalanceDisplay";
import { QuickActions } from "@/components/QuickActions";
import { ServicesList } from "@/components/ServicesList";
import { TrendingTokens } from "@/components/TrendingTokens";
import { MarqueeTicker } from "@/components/MarqueeTicker";
import { TransactionHistory } from "@/components/TransactionHistory";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Wallet, Hexagon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const Home = () => {
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connectMetaMask = async () => {
    if (typeof window.ethereum === "undefined") {
      alert("MetaMask is not installed. Please install MetaMask to connect.");
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts"
      }) as string[];
      if (accounts && accounts.length > 0) {
        setConnectedAddress(accounts[0]);
        setConnectedWallet("MetaMask");
        setIsConnectOpen(false);
      }
    } catch (error) {
      console.error("Error connecting to MetaMask:", error);
      alert("Failed to connect to MetaMask. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  const connectWalletConnect = async () => {
    setIsConnecting(true);
    try {
      const WalletConnectProvider = (await import("@walletconnect/web3-provider")).default;
      const provider = new WalletConnectProvider({
        rpc: {
          1: "https://eth.llamarpc.com",
        },
      });

      await provider.enable();
      const accounts = provider.accounts;
      if (accounts && accounts.length > 0) {
        setConnectedAddress(accounts[0]);
        setConnectedWallet("WalletConnect");
        setIsConnectOpen(false);
      }
    } catch (error) {
      console.error("Error connecting via WalletConnect:", error);
      if ((error as Error).message !== "User closed modal") {
        alert("Failed to connect via WalletConnect. Please try again.");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnect = () => {
    setIsConnectOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-background">
      <Header />
      <BalanceDisplay />
      <QuickActions variant="home" onConnect={handleConnect} />

      <MarqueeTicker />

      {connectedWallet && (
        <div className="mx-4 mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-sm text-green-700 dark:text-green-400 text-center">
            Connected: {connectedWallet} ({connectedAddress?.slice(0, 6)}...{connectedAddress?.slice(-4)})
          </p>
        </div>
      )}

      <div className="mt-6">
        <ServicesList />
      </div>

      <TrendingTokens />

      <TransactionHistory />

      <Card className="mx-4 mt-6 p-4 bg-navy text-white relative overflow-visible" data-testid="rates-banner">
        <div className="relative z-10">
          <h3 className="font-semibold text-lg">Rates</h3>
          <p className="text-sm text-white/80">Stay up to date with our rates</p>
        </div>
        <div className="absolute right-4 bottom-2 opacity-50">
          <div className="w-20 h-20 rounded-full bg-white/10" />
        </div>
      </Card>

      <Button
        size="icon"
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-navy shadow-lg"
        data-testid="button-chat"
      >
        <MessageCircle className="w-6 h-6" />
      </Button>

      <Dialog open={isConnectOpen} onOpenChange={setIsConnectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Connect Wallet</DialogTitle>
            <DialogDescription>
              Choose a wallet to connect to StableX
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-14"
              onClick={connectMetaMask}
              disabled={isConnecting}
              data-testid="button-connect-metamask"
            >
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                <Hexagon className="w-5 h-5 text-orange-500" />
              </div>
              <div className="text-left">
                <p className="font-medium">MetaMask</p>
                <p className="text-xs text-muted-foreground">Browser extension</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-14"
              onClick={connectWalletConnect}
              disabled={isConnecting}
              data-testid="button-connect-walletconnect"
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-left">
                <p className="font-medium">WalletConnect</p>
                <p className="text-xs text-muted-foreground">Trust Wallet, Rainbow & more</p>
              </div>
            </Button>
          </div>

          {isConnecting && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              Connecting...
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Home;
