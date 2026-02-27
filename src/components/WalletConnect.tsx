import { useState } from "react";
import { Wallet, LogOut, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useWallet } from "@/contexts/WalletContext";

const WALLETS = [
  {
    id: "metamask",
    name: "MetaMask",
    icon: "🦊",
    description: "Connect using MetaMask",
    deepLink: "https://metamask.app.link/dapp/",
    installUrl: "https://metamask.io/download/",
    checkInstalled: () => !!(window as any).ethereum?.isMetaMask,
  },
  {
    id: "trustwallet",
    name: "Trust Wallet",
    icon: "🛡️",
    description: "Connect using Trust Wallet",
    deepLink: "https://link.trustwallet.com/open_url?coin_id=60&url=",
    installUrl: "https://trustwallet.com/download",
    checkInstalled: () =>
      !!(window as any).ethereum?.isTrust ||
      !!(window as any).trustwallet,
  },
];

export const WalletConnect = () => {
  const { account, connectWallet, disconnectWallet, isConnecting } = useWallet();
  const [showModal, setShowModal] = useState(false);

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const handleWalletSelect = async (walletId: string) => {
    const wallet = WALLETS.find((w) => w.id === walletId);
    if (!wallet) return;

    // Check if the wallet extension is available in the browser
    const hasExtension = wallet.checkInstalled();

    if (hasExtension || (window as any).ethereum) {
      // Extension detected — connect directly
      setShowModal(false);
      await connectWallet();
    } else if (isMobile) {
      // On mobile without the in-app browser — deep link to wallet app
      const currentUrl = encodeURIComponent(window.location.href);
      const deepLink =
        walletId === "metamask"
          ? `${wallet.deepLink}${window.location.host}${window.location.pathname}`
          : `${wallet.deepLink}${currentUrl}`;
      window.location.href = deepLink;
    } else {
      // Desktop without extension — open install page
      window.open(wallet.installUrl, "_blank");
    }
  };

  if (account) {
    return (
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium">
            {account.slice(0, 6)}...{account.slice(-4)}
          </span>
        </div>
        <Button variant="outline" size="icon" onClick={disconnectWallet}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button onClick={() => setShowModal(true)} disabled={isConnecting}>
        <Wallet className="mr-2 h-4 w-4" />
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Connect Wallet</DialogTitle>
            <DialogDescription>
              Choose your preferred wallet to connect to StableX
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            {WALLETS.map((wallet) => {
              const isInstalled = wallet.checkInstalled();
              return (
                <button
                  key={wallet.id}
                  onClick={() => handleWalletSelect(wallet.id)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] group"
                >
                  <span className="text-3xl">{wallet.icon}</span>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {wallet.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isInstalled
                        ? "Detected — Click to connect"
                        : isMobile
                          ? "Open in wallet app"
                          : "Not installed — Click to install"}
                    </p>
                  </div>
                  {isInstalled && (
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  )}
                  {!isInstalled && (
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground text-center">
              {isMobile
                ? "Tap a wallet to open it. Your browser will switch to the wallet app."
                : "New to crypto wallets? Install MetaMask to get started."}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
