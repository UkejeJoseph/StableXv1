import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  ArrowUpRight,
  ArrowDownLeft,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Lock,
  Globe,
  Zap,
} from "lucide-react";
import { SiBitcoin, SiEthereum, SiSolana, SiTether, SiRipple } from "react-icons/si";
import type { NetworkType } from "@/lib/wallet";

type SecureAsset = {
  id: string;
  name: string;
  symbol: string;
  icon: JSX.Element;
  balance: number;
  usdValue: number;
  networks: { name: string; network: NetworkType; fee: string }[];
};

const SECURE_ASSETS: SecureAsset[] = [
  {
    id: "btc",
    name: "Bitcoin",
    symbol: "BTC",
    icon: <SiBitcoin className="w-6 h-6 text-orange-500" />,
    balance: 0,
    usdValue: 97500,
    networks: [
      { name: "Bitcoin Network", network: "BTC", fee: "0.0001 BTC" },
      { name: "Ethereum (WBTC)", network: "WBTC", fee: "0.005 ETH" },
    ],
  },
  {
    id: "eth",
    name: "Ethereum",
    symbol: "ETH",
    icon: <SiEthereum className="w-6 h-6 text-blue-500" />,
    balance: 0,
    usdValue: 3200,
    networks: [
      { name: "Ethereum Network", network: "ETH", fee: "0.002 ETH" },
    ],
  },
  {
    id: "sol",
    name: "Solana",
    symbol: "SOL",
    icon: <SiSolana className="w-6 h-6 text-purple-500" />,
    balance: 0,
    usdValue: 148,
    networks: [
      { name: "Solana Network", network: "SOL", fee: "0.00001 SOL" },
    ],
  },
  {
    id: "xrp",
    name: "XRP",
    symbol: "XRP",
    icon: <SiRipple className="w-6 h-6 text-blue-400" />,
    balance: 0,
    usdValue: 2.45,
    networks: [
      { name: "XRP Ledger", network: "XRP", fee: "0.01 XRP" },
    ],
  },
  {
    id: "usdt",
    name: "Tether",
    symbol: "USDT",
    icon: <SiTether className="w-6 h-6 text-green-500" />,
    balance: 0,
    usdValue: 1,
    networks: [
      { name: "Ethereum (ERC20)", network: "USDT_ERC20", fee: "5 USDT" },
      { name: "Tron (TRC20)", network: "USDT_TRC20", fee: "1 USDT" },
    ],
  },
  {
    id: "usdc",
    name: "USD Coin",
    symbol: "USDC",
    icon: <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">$</div>,
    balance: 0,
    usdValue: 1,
    networks: [
      { name: "Ethereum (ERC20)", network: "USDC_ERC20", fee: "5 USDC" },
    ],
  },
  {
    id: "dai",
    name: "DAI",
    symbol: "DAI",
    icon: <div className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">D</div>,
    balance: 0,
    usdValue: 1,
    networks: [
      { name: "Ethereum (ERC20)", network: "DAI", fee: "5 DAI" },
    ],
  },
];

const SECURE_STORAGE_KEY = "stablex_secure_balances";


export default function StableXSecure() {
  const navigate = useNavigate();
  const [showBalances, setShowBalances] = useState(true);
  const [activeTab, setActiveTab] = useState("assets");
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<SecureAsset | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState("");
  const [amount, setAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { data: walletsData, isLoading } = useQuery({
    queryKey: ['userWallets'],
    queryFn: async () => {
      const res = await fetch('/api/wallets', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch wallets');
      return res.json();
    }
  });

  const balances = useMemo(() => {
    const map: Record<string, number> = {};
    if (walletsData?.wallets) {
      walletsData.wallets.forEach((w: any) => {
        // Map common symbols to ids
        const symbol = w.currency?.toLowerCase();
        if (symbol) map[symbol] = w.balance || 0;
        if (symbol === 'usdt_trc20' || symbol === 'usdt_erc20') map['usdt'] = (map['usdt'] || 0) + (w.balance || 0);
      });
    }
    return map;
  }, [walletsData]);

  const assetsWithBalances = SECURE_ASSETS.map((a) => ({
    ...a,
    balance: balances[a.id] || 0,
  }));

  const totalUSD = assetsWithBalances.reduce(
    (sum, a) => sum + a.balance * a.usdValue,
    0
  );

  const depositAddresses = useMemo(() => {
    return {
      btc: "Deposit Unavailable",
      eth: "Deposit Unavailable",
      sol: "Deposit Unavailable",
      xrp: "Deposit Unavailable",
      usdt: "Deposit Unavailable",
      usdc: "Deposit Unavailable",
      dai: "Deposit Unavailable",
    };
  }, []);

  const handleDeposit = (asset: SecureAsset) => {
    setSelectedAsset(asset);
    setSelectedNetwork(asset.networks[0]?.name || "");
    setShowDepositDialog(true);
    setErrorMessage("");
  };

  const handleWithdraw = (asset: SecureAsset) => {
    setSelectedAsset(asset);
    setSelectedNetwork(asset.networks[0]?.network || "");
    setAmount("");
    setWithdrawAddress("");
    setShowWithdrawDialog(true);
    setErrorMessage("");
  };

  const copyDepositAddress = () => {
    if (selectedAsset) {
      navigator.clipboard.writeText(depositAddresses[selectedAsset.id] || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const simulateDeposit = () => {
    setErrorMessage("StableX Secure Vaults are coming soon.");
  };

  const processWithdrawal = () => {
    if (!selectedAsset || !amount || !withdrawAddress) {
      setErrorMessage("Please fill in all fields");
      return;
    }

    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      setErrorMessage("Please enter a valid amount");
      return;
    }

    const currentBalance = balances[selectedAsset.id] || 0;
    if (withdrawAmount > currentBalance) {
      setErrorMessage("Insufficient balance");
      return;
    }

    setIsProcessing(true);
    setErrorMessage("");

    // Simulate completion (In real app, this would be an API call)
    setTimeout(() => {
      setIsProcessing(false);
      setShowWithdrawDialog(false);
      setSuccessMessage(
        `${withdrawAmount} ${selectedAsset.symbol} withdrawal initiated`
      );
      setShowSuccess(true);
      setAmount("");
      setWithdrawAddress("");
    }, 2000);
  };

  const saveSecureTransaction = (type: string, asset: SecureAsset, amt: string) => {
    // Disabled fake transaction history
  };

  const secureTransactions: any[] = [];

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-background">
      <div className="flex items-center gap-4 px-4 py-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">StableX Secure</h1>
        </div>
      </div>

      <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-6 mx-4 rounded-xl mt-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowBalances(!showBalances)}
            data-testid="button-toggle-balance"
          >
            {showBalances ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-3xl font-bold text-foreground">
          {showBalances ? `$${totalUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "••••••"}
        </p>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-background/60 px-2 py-1 rounded-full">
            <Lock className="w-3 h-3" />
            <span>Custodial</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-background/60 px-2 py-1 rounded-full">
            <Globe className="w-3 h-3" />
            <span>Multi-Network</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-background/60 px-2 py-1 rounded-full">
            <Zap className="w-3 h-3" />
            <span>Instant</span>
          </div>
        </div>
      </div>

      <div className="px-4 mt-4">
        <Card className="p-3 bg-blue-500/10 border-blue-500/20">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-600 dark:text-blue-400">
              StableX Secure holds your funds securely. Withdraw to any supported network at any time. Like Binance, you choose the network when withdrawing.
            </p>
          </div>
        </Card>
      </div>

      <div className="px-4 mt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="assets" data-testid="tab-assets">Assets</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="assets" className="mt-4">
            <div className="space-y-3">
              {assetsWithBalances.map((asset) => (
                <Card key={asset.id} className="p-4" data-testid={`card-secure-${asset.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      {asset.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-foreground">{asset.name}</p>
                          <p className="text-xs text-muted-foreground">{asset.symbol}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-foreground">
                            {showBalances
                              ? `${asset.balance.toFixed(asset.symbol === "BTC" ? 8 : 4)} ${asset.symbol}`
                              : "••••"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {showBalances
                              ? `$${(asset.balance * asset.usdValue).toFixed(2)}`
                              : "••••"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleDeposit(asset)}
                          data-testid={`button-deposit-${asset.id}`}
                        >
                          <ArrowDownLeft className="w-3 h-3 mr-1" />
                          Deposit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleWithdraw(asset)}
                          data-testid={`button-withdraw-${asset.id}`}
                        >
                          <ArrowUpRight className="w-3 h-3 mr-1" />
                          Withdraw
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {secureTransactions.length === 0 ? (
              <Card className="p-8">
                <div className="flex flex-col items-center justify-center">
                  <p className="text-muted-foreground text-sm text-center">
                    No transactions yet. Deposit or withdraw to get started.
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-2">
                {secureTransactions.slice(0, 20).map((tx: any) => (
                  <Card key={tx.id} className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {tx.type === "incoming" ? (
                          <ArrowDownLeft className="w-4 h-4 text-green-500" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-red-500" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {tx.type === "incoming" ? "Deposit" : "Withdrawal"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${tx.type === "incoming" ? "text-green-600" : "text-red-500"}`}>
                          {tx.type === "incoming" ? "+" : "-"}{tx.amount} {tx.network}
                        </p>
                        <p className="text-xs text-muted-foreground">{tx.status}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showDepositDialog} onOpenChange={setShowDepositDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-green-500" />
              Deposit {selectedAsset?.symbol}
            </DialogTitle>
            <DialogDescription>
              Send {selectedAsset?.symbol} to the address below
            </DialogDescription>
          </DialogHeader>
          {selectedAsset && (
            <div className="space-y-4">
              {selectedAsset.networks.length > 1 && (
                <div>
                  <Label className="text-sm">Select Network</Label>
                  <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
                    <SelectTrigger className="mt-1" data-testid="select-deposit-network">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedAsset.networks.map((n) => (
                        <SelectItem key={n.network} value={n.name}>
                          {n.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-2">Deposit Address</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs break-all font-mono" data-testid="text-deposit-address">
                    {depositAddresses[selectedAsset.id]}
                  </code>
                  <Button variant="ghost" size="icon" onClick={copyDepositAddress} data-testid="button-copy-deposit">
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Card className="p-3 bg-amber-500/10 border-amber-500/20">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Only send {selectedAsset.symbol} on the selected network. Sending other assets or using the wrong network may result in permanent loss.
                </p>
              </Card>

              <Button
                variant="outline"
                className="w-full border-green-500/30 text-green-600"
                onClick={simulateDeposit}
                data-testid="button-simulate-deposit"
              >
                Simulate Test Deposit
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                For testing: simulates receiving a deposit
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-primary" />
              Withdraw {selectedAsset?.symbol}
            </DialogTitle>
            <DialogDescription>
              Choose network and enter withdrawal details
            </DialogDescription>
          </DialogHeader>
          {selectedAsset && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm">Network</Label>
                <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
                  <SelectTrigger className="mt-1" data-testid="select-withdraw-network">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedAsset.networks.map((n) => (
                      <SelectItem key={n.network} value={n.network}>
                        {n.name} (Fee: {n.fee})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm">Withdrawal Address</Label>
                <Input
                  placeholder="Enter wallet address"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  className="mt-1"
                  data-testid="input-withdraw-address"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-sm">Amount</Label>
                  <button
                    className="text-xs text-primary"
                    onClick={() =>
                      setAmount((balances[selectedAsset.id] || 0).toString())
                    }
                    data-testid="button-max-amount"
                  >
                    MAX: {(balances[selectedAsset.id] || 0).toFixed(4)} {selectedAsset.symbol}
                  </button>
                </div>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1"
                  data-testid="input-withdraw-amount"
                />
              </div>

              {errorMessage && (
                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-500/10 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Network Fee</span>
                  <span>{selectedAsset.networks.find((n) => n.network === selectedNetwork)?.fee || "—"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">You Receive</span>
                  <span className="font-medium">{amount || "0"} {selectedAsset.symbol}</span>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={processWithdrawal}
                disabled={isProcessing || isLoading || !amount || !withdrawAddress}
                data-testid="button-confirm-withdraw"
              >
                {isProcessing || isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isProcessing ? "Processing..." : "Loading Balances..."}
                  </>
                ) : (
                  "Confirm Withdrawal"
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-6 h-6" />
              Success!
            </DialogTitle>
            <DialogDescription>{successMessage}</DialogDescription>
          </DialogHeader>
          <Button className="w-full" onClick={() => setShowSuccess(false)} data-testid="button-close-success">
            Done
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
