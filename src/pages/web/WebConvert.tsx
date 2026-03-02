import { useState, useEffect } from "react";
import { WebLayout } from "@/components/WebSidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowDownUp, Info, History } from "lucide-react";
import { useBalances } from "@/hooks/useBalances";
import { useQueryClient } from "@tanstack/react-query";
import { useMarketData } from "@/hooks/useMarketData";
import { fetchSwapRate } from "@/lib/marketData";

export default function WebConvert() {
  const queryClient = useQueryClient();
  const { balances: balancesArray = [] } = useBalances();
  const [tab, setTab] = useState("buy");
  const [spendAmount, setSpendAmount] = useState("");
  const [receiveAmount, setReceiveAmount] = useState("0.00");
  const [spendCurrency, setSpendCurrency] = useState("NGN");
  const [receiveCurrency, setReceiveCurrency] = useState("USDT_TRC20");
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { toast } = useToast();

  const { data: marketData, loading: pricesLoading, isStale } = useMarketData();

  const getBalance = (currency: string) => {
    if (!balancesArray || !Array.isArray(balancesArray)) return 0;
    const wallet = balancesArray.find((b: any) => b.currency === currency) || balancesArray.find((b: any) => b.currency === (currency === 'USDT' ? 'USDT_TRC20' : currency));
    return wallet ? wallet.balance : 0;
  };

  // Dynamic conversion math for preview based on backend rates
  useEffect(() => {
    if (!spendAmount || isNaN(Number(spendAmount)) || !marketData) {
      setReceiveAmount("0.00");
      return;
    }

    const amount = Number(spendAmount);
    const rates = marketData.rates || {};

    // Check for direct pair (e.g. USDT_TRC20_NGN) or normalized base (USDT_NGN)
    const pair = `${spendCurrency}_${receiveCurrency}`;
    let rate = rates[pair];

    if (!rate) {
      // Fallback for NGN -> Crypto or Crypto -> NGN if specific pair variant missing
      const fromBase = spendCurrency.split('_')[0];
      const toBase = receiveCurrency.split('_')[0];

      if (spendCurrency === 'NGN') {
        rate = rates[`NGN_${receiveCurrency}`] || rates[`NGN_${toBase}`] || 0;
      } else if (receiveCurrency === 'NGN') {
        rate = rates[`${spendCurrency}_NGN`] || rates[`${fromBase}_NGN`] || 0;
      } else {
        // Crypto to Crypto via NGN as bridge
        const fromToNgn = rates[`${spendCurrency}_NGN`] || rates[`${fromBase}_NGN`] || 0;
        const ngnToTo = rates[`NGN_${receiveCurrency}`] || rates[`NGN_${toBase}`] || 0;
        if (fromToNgn && ngnToTo) rate = fromToNgn * ngnToTo;
      }
    }


    if (rate) {
      const displayDecimals = receiveCurrency === 'NGN' ? 2 : 6;
      setReceiveAmount((amount * rate).toFixed(displayDecimals));
    } else {
      setReceiveAmount("0.00");
    }
  }, [spendAmount, spendCurrency, receiveCurrency, marketData]);

  const handleSwap = () => {
    setSpendCurrency(receiveCurrency);
    setReceiveCurrency(spendCurrency);
    setSpendAmount(receiveAmount === "0.00" ? "" : receiveAmount);
  };

  const handleTransactionClick = () => {
    if (!spendAmount || isNaN(Number(spendAmount)) || Number(spendAmount) <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid amount greater than 0.", variant: "destructive" });
      return;
    }

    setShowConfirm(true);
  };

  const handleTransactionExecute = async () => {
    setShowConfirm(false);
    setIsLoading(true);
    try {
      const res = await fetch("/api/transactions/swap", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromCurrency: spendCurrency,
          toCurrency: receiveCurrency,
          amount: parseFloat(spendAmount)
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || "Swap failed");
      }

      const data = await res.json();

      if (data.success) {
        toast({
          title: "Swap Successful",
          description: `Successfully swapped ${spendAmount} ${spendCurrency} for ${Number(data.receiveAmount).toFixed(4)} ${receiveCurrency}.`,
        });
        await queryClient.invalidateQueries({ queryKey: ["userBalances"] });
        setSpendAmount("");
      } else {
        throw new Error(data.error || "A transaction error occurred.");
      }
    } catch (error: any) {
      toast({
        title: "Swap Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <WebLayout>
      <div className="flex flex-col h-full bg-background text-foreground -mt-4 transition-colors">

        {/* Page Header matching Bybit One-Click Buy */}
        <div className="flex items-center justify-between py-6 border-b border-border/20">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight">One-Click Buy</h1>
            <div className="hidden sm:flex items-center gap-4 text-sm font-medium text-muted-foreground ml-4">
              <span className="text-foreground border-b-2 border-accent pb-1 cursor-pointer">Express</span>
              <span className="hover:text-foreground cursor-pointer pb-1 border-b-2 border-transparent">P2P Trading</span>
              <span className="hover:text-foreground cursor-pointer pb-1 border-b-2 border-transparent">Fiat Deposit</span>
            </div>
          </div>
          <Button variant="outline" className="border-border/30 h-8 text-xs font-semibold gap-2">
            <History className="w-4 h-4" /> Orders
          </Button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 py-12 flex justify-center">
          <Card className="w-full max-w-[480px] bg-card border-border/20 p-6 shadow-2xl relative overflow-hidden transition-colors">
            <Tabs value={tab} onValueChange={setTab} className="w-full mb-6">
              <TabsList className="bg-background w-full p-1 rounded-lg">
                <TabsTrigger value="buy" className="w-1/2 data-[state=active]:bg-muted data-[state=active]:text-green-500 rounded-md">Buy</TabsTrigger>
                <TabsTrigger value="sell" className="w-1/2 data-[state=active]:bg-muted data-[state=active]:text-red-500 rounded-md">Sell</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-4 relative">
              {/* Spend Input */}
              <div className="bg-background rounded-xl p-4 border border-border/10 focus-within:border-accent/50 transition-colors">
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span>Spend</span>
                  <span>Balance: {getBalance(spendCurrency).toLocaleString()} {spendCurrency}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="10.00 - 100,000.00"
                    value={spendAmount}
                    onChange={(e) => setSpendAmount(e.target.value)}
                    className="bg-transparent border-0 h-10 text-2xl font-semibold p-0 focus-visible:ring-0 shadow-none placeholder:text-muted-foreground/30 flex-1"
                  />
                  <div className="bg-muted rounded-md px-1 py-0.5 whitespace-nowrap">
                    <Select value={spendCurrency} onValueChange={setSpendCurrency}>
                      <SelectTrigger className="w-24 h-8 border-0 bg-transparent focus:ring-0 shadow-none font-bold text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border/20 text-foreground">
                        <SelectItem value="NGN">NGN</SelectItem>
                        <SelectItem value="USDT_TRC20">USDT (TRC20)</SelectItem>
                        <SelectItem value="BTC">BTC</SelectItem>
                        <SelectItem value="ETH">ETH</SelectItem>
                        <SelectItem value="SOL">SOL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Swap Button */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pt-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-card border-border/20 hover:bg-muted hover:text-accent text-muted-foreground shadow-md"
                  onClick={handleSwap}
                >
                  <ArrowDownUp className="w-4 h-4" />
                </Button>
              </div>

              {/* Receive Input */}
              <div className="bg-background rounded-xl p-4 border border-border/10 focus-within:border-accent/50 transition-colors">
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span>Receive</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    readOnly
                    value={receiveAmount}
                    className="bg-transparent border-0 h-10 text-2xl font-semibold p-0 focus-visible:ring-0 shadow-none text-foreground/90 flex-1"
                  />
                  <div className="bg-muted rounded-md px-1 py-0.5 whitespace-nowrap">
                    <Select value={receiveCurrency} onValueChange={setReceiveCurrency}>
                      <SelectTrigger className="w-24 h-8 border-0 bg-transparent focus:ring-0 shadow-none font-bold text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border/20 text-foreground">
                        <SelectItem value="USDT_TRC20">USDT (TRC20)</SelectItem>
                        <SelectItem value="BTC">BTC</SelectItem>
                        <SelectItem value="ETH">ETH</SelectItem>
                        <SelectItem value="SOL">SOL</SelectItem>
                        <SelectItem value="NGN">NGN</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

            </div>

            {/* Info Panel */}
            {spendAmount && Number(spendAmount) > 0 && (
              <div className="mt-6 space-y-3 bg-secondary p-3 rounded-lg border border-border/10">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">Exchange Rate <Info className="w-3 h-3" /></span>
                  <span className="font-medium text-foreground">1 {receiveCurrency === 'NGN' ? spendCurrency : receiveCurrency} ≈ {
                    receiveCurrency === 'NGN'
                      ? (1 / (Number(receiveAmount) / Number(spendAmount))).toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : (Number(spendAmount) / Number(receiveAmount)).toLocaleString(undefined, { maximumFractionDigits: 2 })
                  } NGN</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Transaction Fee</span>
                  <span className="font-medium text-primary">Included in rate</span>
                </div>
              </div>
            )}

            {/* Call to Action */}
            <Button
              className={`w-full h-12 mt-6 text-base font-bold rounded-lg ${tab === 'buy' ? 'bg-[#22c55e] hover:bg-[#22c55e]/90 text-white' : 'bg-[#ef4444] hover:bg-[#ef4444]/90 text-white'}`}
              disabled={!spendAmount || Number(spendAmount) <= 0 || isLoading}
              onClick={handleTransactionClick}
            >
              {isLoading ? "Processing..." : `${tab === 'buy' ? 'Buy' : 'Sell'} ${receiveCurrency}`}
            </Button>

            {/* Payment Methods Banner */}
            <div className="mt-6 flex items-center justify-center gap-4 text-muted-foreground/30">
              <span className="text-xs font-semibold uppercase tracking-widest">Supported</span>
              <div className="flex gap-2 opacity-50">
                {/* Mocking icons with text for layout */}
                <div className="text-[10px] font-bold border border-current px-1 rounded">VISA</div>
                <div className="text-[10px] font-bold border border-current px-1 rounded">MC</div>
                <div className="text-[10px] font-bold border border-current px-1 rounded">BANK</div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Swap</DialogTitle>
            <DialogDescription>
              Please review your transaction details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg border border-border/40">
              <span className="text-sm font-medium text-muted-foreground">You pay</span>
              <span className="font-bold text-lg">{spendAmount} {spendCurrency}</span>
            </div>

            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <ArrowDownUp className="w-4 h-4 text-primary" />
              </div>
            </div>

            <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg border border-border/40">
              <span className="text-sm font-medium text-muted-foreground">You receive</span>
              <span className="font-bold text-lg text-green-500">{receiveAmount} {receiveCurrency}</span>
            </div>

            <div className="flex flex-col gap-1 text-xs text-muted-foreground mt-2">
              <div className="flex justify-between">
                <span>Rate</span>
                <span>1 {receiveCurrency === 'NGN' ? spendCurrency : receiveCurrency} ≈ {
                  receiveCurrency === 'NGN'
                    ? (1 / (Number(receiveAmount) / Number(spendAmount))).toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : (Number(spendAmount) / Number(receiveAmount)).toLocaleString(undefined, { maximumFractionDigits: 2 })
                } NGN</span>
              </div>
              <div className="flex justify-between">
                <span>Fee</span>
                <span className="text-green-500">Included in rate</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConfirm(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleTransactionExecute} className="flex-1">
              Confirm Swap
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WebLayout>
  );
}
