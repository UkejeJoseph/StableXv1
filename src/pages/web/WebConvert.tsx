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
import { ArrowDownUp, Info, History } from "lucide-react";
import { getMarketPrices } from "@/lib/marketData";

import { useBalances } from "@/hooks/useBalances";
import { useQueryClient } from "@tanstack/react-query";

export default function WebConvert() {
  const queryClient = useQueryClient();
  const { data: balancesData } = useBalances();
  const [tab, setTab] = useState("buy");
  const [spendAmount, setSpendAmount] = useState("");
  const [receiveAmount, setReceiveAmount] = useState("0.00");
  const [spendCurrency, setSpendCurrency] = useState("NGN");
  const [receiveCurrency, setReceiveCurrency] = useState("USDT");
  const [isLoading, setIsLoading] = useState(false);
  const [prices, setPrices] = useState<any[]>([]);
  const { toast } = useToast();

  const getBalance = (currency: string) => {
    if (!balancesData) return 0;
    return balancesData[currency as keyof typeof balancesData] || 0;
  };

  useEffect(() => {
    const fetchPrices = async () => {
      const data = await getMarketPrices();
      setPrices(data);
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 10000);
    return () => clearInterval(interval);
  }, []);

  // Simple conversion math for preview based on general rates
  useEffect(() => {
    if (!spendAmount || isNaN(Number(spendAmount))) {
      setReceiveAmount("0.00");
      return;
    }

    const amount = Number(spendAmount);

    // NGN to USDT
    if (spendCurrency === "NGN" && receiveCurrency === "USDT") {
      setReceiveAmount((amount / 1600).toFixed(2));
    } else if (spendCurrency === "USDT" && receiveCurrency === "NGN") {
      setReceiveAmount((amount * 1600).toFixed(2));
    } else {
      setReceiveAmount((amount * 1).toFixed(4)); // Direct conversion for crypto-crypto
    }
  }, [spendAmount, spendCurrency, receiveCurrency, prices]);

  const handleSwap = () => {
    setSpendCurrency(receiveCurrency);
    setReceiveCurrency(spendCurrency);
    setSpendAmount(receiveAmount === "0.00" ? "" : receiveAmount);
  };

  const handleTransaction = async () => {
    if (!spendAmount || isNaN(Number(spendAmount))) {
      toast({ title: "Invalid Amount", description: "Please enter a valid amount.", variant: "destructive" });
      return;
    }

    const numAmount = Number(spendAmount);
    const minAmount = spendCurrency === 'NGN' ? 1000 : 5;
    if (numAmount < minAmount) {
      toast({
        title: "Amount Too Small",
        description: `Minimum swap is ${minAmount} ${spendCurrency}`,
        variant: "destructive"
      });
      return;
    }

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
          description: `Successfully swapped ${spendAmount} ${spendCurrency} for ${data.receivedAmount.toFixed(4)} ${receiveCurrency}.`,
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
      <div className="flex flex-col h-full bg-[#0b0e11] text-foreground -mt-4">

        {/* Page Header matching Bybit One-Click Buy */}
        <div className="flex items-center justify-between py-6 border-b border-border/20">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight">One-Click Buy</h1>
            <div className="hidden sm:flex items-center gap-4 text-sm font-medium text-muted-foreground ml-4">
              <span className="text-white border-b-2 border-[#F0B90B] pb-1 cursor-pointer">Express</span>
              <span className="hover:text-white cursor-pointer pb-1 border-b-2 border-transparent">P2P Trading</span>
              <span className="hover:text-white cursor-pointer pb-1 border-b-2 border-transparent">Fiat Deposit</span>
            </div>
          </div>
          <Button variant="outline" className="border-border/30 h-8 text-xs font-semibold gap-2">
            <History className="w-4 h-4" /> Orders
          </Button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 py-12 flex justify-center">
          <Card className="w-full max-w-[480px] bg-[#1e2329] border-border/20 p-6 shadow-2xl relative overflow-hidden">
            <Tabs value={tab} onValueChange={setTab} className="w-full mb-6">
              <TabsList className="bg-[#0b0e11] w-full p-1 rounded-lg">
                <TabsTrigger value="buy" className="w-1/2 data-[state=active]:bg-[#2b3139] data-[state=active]:text-green-500 rounded-md">Buy</TabsTrigger>
                <TabsTrigger value="sell" className="w-1/2 data-[state=active]:bg-[#2b3139] data-[state=active]:text-red-500 rounded-md">Sell</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-4 relative">
              {/* Spend Input */}
              <div className="bg-[#0b0e11] rounded-xl p-4 border border-border/10 focus-within:border-[#F0B90B]/50 transition-colors">
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
                  <div className="bg-[#1e2329] rounded-md px-1 py-0.5 whitespace-nowrap">
                    <Select value={spendCurrency} onValueChange={setSpendCurrency}>
                      <SelectTrigger className="w-24 h-8 border-0 bg-transparent focus:ring-0 shadow-none font-bold text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1e2329] border-border/20 text-white">
                        <SelectItem value="NGN">NGN</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="USDT">USDT</SelectItem>
                        <SelectItem value="BTC">BTC</SelectItem>
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
                  className="h-8 w-8 rounded-full bg-[#1e2329] border-border/20 hover:bg-[#2b3139] hover:text-[#F0B90B] text-muted-foreground shadow-md"
                  onClick={handleSwap}
                >
                  <ArrowDownUp className="w-4 h-4" />
                </Button>
              </div>

              {/* Receive Input */}
              <div className="bg-[#0b0e11] rounded-xl p-4 border border-border/10 focus-within:border-[#F0B90B]/50 transition-colors">
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span>Receive</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    readOnly
                    value={receiveAmount}
                    className="bg-transparent border-0 h-10 text-2xl font-semibold p-0 focus-visible:ring-0 shadow-none text-white/90 flex-1"
                  />
                  <div className="bg-[#1e2329] rounded-md px-1 py-0.5 whitespace-nowrap">
                    <Select value={receiveCurrency} onValueChange={setReceiveCurrency}>
                      <SelectTrigger className="w-24 h-8 border-0 bg-transparent focus:ring-0 shadow-none font-bold text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1e2329] border-border/20 text-white">
                        <SelectItem value="USDT">USDT</SelectItem>
                        <SelectItem value="BTC">BTC</SelectItem>
                        <SelectItem value="ETH">ETH</SelectItem>
                        <SelectItem value="SOL">SOL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

            </div>

            {/* Info Panel */}
            {spendAmount && Number(spendAmount) > 0 && (
              <div className="mt-6 space-y-3 bg-[#0b0e11]/50 p-3 rounded-lg border border-border/10">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">Exchange Rate <Info className="w-3 h-3" /></span>
                  <span className="font-medium text-white">1 {receiveCurrency} ≈ {spendCurrency === 'NGN' ? '1,600' : '1.00'} {spendCurrency}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Transaction Fee</span>
                  <span className="font-medium text-green-500">Included in rate</span>
                </div>
              </div>
            )}

            {/* Call to Action */}
            <Button
              className={`w-full h-12 mt-6 text-base font-bold rounded-lg ${tab === 'buy' ? 'bg-[#22c55e] hover:bg-[#22c55e]/90 text-white' : 'bg-[#ef4444] hover:bg-[#ef4444]/90 text-white'}`}
              disabled={!spendAmount || Number(spendAmount) <= 0 || isLoading}
              onClick={handleTransaction}
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
    </WebLayout>
  );
}
