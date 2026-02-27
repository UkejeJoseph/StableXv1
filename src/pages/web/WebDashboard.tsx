import { useState, useEffect } from "react";
import { WebLayout } from "@/components/WebSidebar";
import { PortfolioOverview } from "@/components/PortfolioOverview";
import { AssetDistributionChart } from "@/components/AssetDistributionChart";
import { DashboardSidebarWidgets } from "@/components/DashboardSidebarWidgets";
import { ServicesList } from "@/components/ServicesList";
import { TrendingTokens } from "@/components/TrendingTokens";
import { MarqueeTicker } from "@/components/MarqueeTicker";
import { TransactionHistory } from "@/components/TransactionHistory";
import { WebQuickSend } from "@/components/WebQuickSend";
import { Wallet, Hexagon, ShieldCheck, Plus, TrendingUp, Info } from "lucide-react";
import { WebAssetList } from "@/components/WebAssetList";
import { MultiChainWalletModal } from "@/components/MultiChainWalletModal";
import { useWallets } from "@/hooks/useWallets";
import { useBalances } from "@/hooks/useBalances";
import { getMarketPrices, type CryptoPrice } from "@/lib/marketData";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QuickActionsGrid } from "@/components/QuickActionsGrid";

const WebDashboard = () => {
  const { data: wallets = [], isLoading: isWalletsLoading, refetch: refetchWallets } = useWallets();
  const [isQuickSendOpen, setIsQuickSendOpen] = useState(false);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [prices, setPrices] = useState<CryptoPrice[]>([]);

  useEffect(() => {
    const fetchPrices = async () => {
      const data = await getMarketPrices();
      setPrices(data);
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = (providerId: string, address: string, network: string) => {
    // Logic to save the external wallet connection to backend
    fetch("/api/wallets/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, network, providerId }),
      credentials: "include"
    }).then(() => refetchWallets());
  };

  return (
    <WebLayout>
      <div className="space-y-6">
        {/* Top Verification Banner */}
        <div className="flex items-center justify-between bg-muted/30 p-3 rounded-xl border border-border/40">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm font-medium text-green-500 bg-green-500/10 px-2 py-1 rounded-md">
              <ShieldCheck className="w-4 h-4" /> Verified
            </div>
            <span className="text-sm text-muted-foreground hidden sm:inline">Daily Withdrawal Limit: 100 BTC</span>
          </div>
          <Button variant="link" size="sm" className="h-auto p-0 text-muted-foreground">Security Settings</Button>
        </div>

        <MarqueeTicker />
        <WebQuickSend isOpen={isQuickSendOpen} onClose={() => setIsQuickSendOpen(false)} />

        {connectedWallet && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-sm text-green-700 dark:text-green-400 text-center font-medium">
              Connected: {connectedWallet} ({connectedAddress?.slice(0, 6)}...{connectedAddress?.slice(-4)})
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content (Left 2/3) */}
          <div className="lg:col-span-2 space-y-6">
            <PortfolioOverview />
            <QuickActionsGrid />
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">My Assets</h2>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsConnectOpen(true)}>
                <Plus className="w-4 h-4" /> Connect External
              </Button>
            </div>
            <WebAssetList wallets={wallets} isLoading={isWalletsLoading} />
            <TrendingTokens />
            <TransactionHistory />
          </div>

          {/* Sidebar (Right 1/3) */}
          <div className="space-y-6 lg:col-span-1">
            <AssetDistributionChart />
            <ServicesList />
            <DashboardSidebarWidgets />

            <Card className="p-6 bg-[#0b0e11] border-border/40 relative overflow-hidden group hover:border-[#F0B90B]/30 transition-all shadow-xl" data-testid="rates-banner">
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-[#F0B90B]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-white">Market Pulse</h3>
                    <p className="text-xs text-muted-foreground">Aggregated Live Feeds</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {prices.slice(0, 4).map((token) => (
                    <div key={token.id} className="flex items-center justify-between group/item">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-bold">
                          {token.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white leading-none">{token.symbol}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{token.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-white leading-none">
                          ${token.price.toLocaleString(undefined, { minimumFractionDigits: token.price < 1 ? 4 : 2 })}
                        </p>
                        <p className={`text-[10px] mt-1 font-medium ${token.priceChange24h >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {token.priceChange24h >= 0 ? "+" : ""}{token.priceChange24h.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <Button variant="link" className="w-full text-[#F0B90B] mt-6 gap-2 p-0 h-auto font-bold flex items-center justify-center border-t border-border/10 pt-4">
                  <span>View All Markets</span>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Decorative Background Elements */}
              <div className="absolute right-[-10%] bottom-[-10%] w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute left-[0%] top-[0%] w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
            </Card>
          </div>
        </div>

        <MultiChainWalletModal
          isOpen={isConnectOpen}
          onClose={() => setIsConnectOpen(false)}
          onConnect={handleConnect}
        />
      </div>
    </WebLayout>
  );
};

export default WebDashboard;
