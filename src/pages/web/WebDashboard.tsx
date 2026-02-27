import { useState } from "react";
import { WebLayout } from "@/components/WebSidebar";
import { PortfolioOverview } from "@/components/PortfolioOverview";
import { AssetDistributionChart } from "@/components/AssetDistributionChart";
import { DashboardSidebarWidgets } from "@/components/DashboardSidebarWidgets";
import { ServicesList } from "@/components/ServicesList";
import { TrendingTokens } from "@/components/TrendingTokens";
import { MarqueeTicker } from "@/components/MarqueeTicker";
import { TransactionHistory } from "@/components/TransactionHistory";
import { WebQuickSend } from "@/components/WebQuickSend";
import { Wallet, Hexagon, ShieldCheck, Plus } from "lucide-react";
import { WebAssetList } from "@/components/WebAssetList";
import { MultiChainWalletModal } from "@/components/MultiChainWalletModal";
import { useWallets } from "@/hooks/useWallets";
import { useBalances } from "@/hooks/useBalances";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const WebDashboard = () => {
  const { data: wallets = [], isLoading: isWalletsLoading, refetch: refetchWallets } = useWallets();

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

            <Card className="p-6 bg-[#0b0e11] text-white border-border/40 relative overflow-hidden" data-testid="rates-banner">
              <div className="relative z-10">
                <h3 className="font-semibold text-xl mb-1">Live Market Rates</h3>
                <p className="text-sm text-white/70">Stay up to date with realtime pricing driven by our aggregated liquidity pools.</p>
              </div>

              {/* Decorative Orbs */}
              <div className="absolute right-[-10%] bottom-[-50%] w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute right-[10%] top-[-20%] w-32 h-32 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
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
