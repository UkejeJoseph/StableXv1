import { useState, useEffect } from "react";
import { WebLayout } from "@/components/WebSidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, ExternalLink, Copy, Check, History, Shield } from "lucide-react";
import { getNetworkDisplayName, type StoredWallet, type NetworkType } from "@/lib/wallet";
import { useWallets } from "@/hooks/useWallets";
import { getBalance, getAddressExplorerUrl } from "@/lib/blockchain";
import { Link } from "react-router-dom";
import { SiBitcoin, SiEthereum, SiSolana, SiTether, SiRipple } from "react-icons/si";
import { TransactionHistory } from "@/components/TransactionHistory";

interface WalletWithBalance extends StoredWallet {
  balance: string;
  isLoading: boolean;
}

const networkIcons: Record<NetworkType, JSX.Element> = {
  BTC: <SiBitcoin className="w-6 h-6 text-orange-500" />,
  ETH: <SiEthereum className="w-6 h-6 text-blue-500" />,
  SOL: <SiSolana className="w-6 h-6 text-purple-500" />,
  USDT_ERC20: <SiTether className="w-6 h-6 text-green-500" />,
  USDT_TRC20: <SiTether className="w-6 h-6 text-red-500" />,
  XRP: <SiRipple className="w-6 h-6 text-blue-400" />,
  USDC_ERC20: <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">$</div>,
  WBTC: <SiBitcoin className="w-6 h-6 text-yellow-600" />,
  DAI: <div className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">D</div>,
  TRX: <span className="text-red-500 font-bold text-sm">TRX</span>,
  ETH_TRC20: <SiEthereum className="w-6 h-6 text-green-500" />,
  SOL_TRC20: <SiSolana className="w-6 h-6 text-green-600" />,
};

const networkSymbols: Record<NetworkType, string> = {
  BTC: "BTC",
  ETH: "ETH",
  SOL: "SOL",
  USDT_ERC20: "USDT",
  USDT_TRC20: "USDT",
  XRP: "XRP",
  USDC_ERC20: "USDC",
  WBTC: "WBTC",
  DAI: "DAI",
  TRX: "TRX",
  ETH_TRC20: "ETH",
  SOL_TRC20: "SOL",
};

export default function WebWallet() {
  const { data: storedWallets = [], isLoading: isWalletsLoading, refetch: refetchWallets } = useWallets();
  const [wallets, setWallets] = useState<WalletWithBalance[]>([]);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!isWalletsLoading) {
      loadBalances(storedWallets);
    }
  }, [storedWallets, isWalletsLoading]);

  const loadBalances = async (stored: StoredWallet[]) => {
    const walletsWithBalance: WalletWithBalance[] = stored.map((w) => ({
      ...w,
      balance: "0",
      isLoading: true,
    }));
    setWallets(walletsWithBalance);

    for (let i = 0; i < walletsWithBalance.length; i++) {
      const wallet = walletsWithBalance[i];
      try {
        const balance = await getBalance(wallet.address, wallet.network);
        setWallets((prev) =>
          prev.map((w, idx) =>
            idx === i ? { ...w, balance, isLoading: false } : w
          )
        );
      } catch (error) {
        setWallets((prev) =>
          prev.map((w, idx) =>
            idx === i ? { ...w, balance: "0", isLoading: false } : w
          )
        );
      }
    }
  };

  const refreshBalances = async () => {
    setIsRefreshing(true);
    const { data } = await refetchWallets();
    if (data) {
      await loadBalances(data);
    }
    setIsRefreshing(false);
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  return (
    <WebLayout>
      <div className="max-w-4xl mx-auto space-y-6">

        <div className="bg-navy text-white p-6 mx-4 rounded-xl mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm opacity-80">Total Wallets</p>
            <Button
              variant="ghost"
              size="icon"
              className="text-white"
              onClick={refreshBalances}
              disabled={isRefreshing}
              data-testid="button-refresh-balances"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <p className="text-3xl font-bold">{wallets.length}</p>
          <p className="text-sm opacity-80 mt-1">Active blockchain wallets</p>
        </div>

        <div className="px-4 py-3">
          <Link to="/stablex-secure">
            <Card className="p-3 border-primary/30 bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-sm">StableX Secure</p>
                  <p className="text-xs text-muted-foreground">Custodial wallet with multi-network withdrawals</p>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </div>
            </Card>
          </Link>
        </div>

        <div className="px-4 py-2">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-semibold text-foreground">Self-Custody Wallets</h2>
            <Link to="/create-wallet">
              <Button variant="outline" size="sm" data-testid="button-add-wallet">
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </Link>
          </div>

          {wallets.length === 0 ? (
            <Card className="p-8">
              <div className="flex flex-col items-center justify-center">
                <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
                  <Plus className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm text-center mb-4">
                  No wallets yet. Create your first wallet to start receiving crypto.
                </p>
                <Link to="/create-wallet">
                  <Button className="bg-navy" data-testid="button-create-first-wallet">
                    Create Wallet
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {wallets.map((wallet) => (
                <Card key={`${wallet.network}-${wallet.address}`} className="p-4" data-testid={`card-wallet-${wallet.network}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      {networkIcons[wallet.network]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-foreground">
                          {getNetworkDisplayName(wallet.network)}
                        </p>
                        <div className="text-right">
                          {wallet.isLoading ? (
                            <div className="w-16 h-4 bg-muted animate-pulse rounded" />
                          ) : (
                            <p className="font-semibold text-foreground">
                              {parseFloat(wallet.balance).toFixed(6)} {networkSymbols[wallet.network]}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-muted-foreground truncate">
                          {wallet.address.slice(0, 12)}...{wallet.address.slice(-8)}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => copyAddress(wallet.address)}
                          data-testid={`button-copy-${wallet.network}`}
                        >
                          {copiedAddress === wallet.address ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                        <a
                          href={getAddressExplorerUrl(wallet.address, wallet.network)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                          data-testid={`link-explorer-${wallet.network}`}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Transaction History</h2>
          </div>
          <TransactionHistory />
        </div>

        <div className="px-4 mt-6 mb-4">
          <p className="text-xs text-center text-muted-foreground">
            Balances are fetched from live blockchain data
          </p>
        </div>
      </div>
    </WebLayout>
  );
}
