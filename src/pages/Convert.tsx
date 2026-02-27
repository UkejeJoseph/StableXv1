import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
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
import { ArrowDownUp, Info } from "lucide-react";
import { SiBitcoin, SiEthereum, SiSolana, SiTether } from "react-icons/si";
import { useBalances } from "@/hooks/useBalances";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";

const EXCHANGE_RATES = {
  NGN_USDT: 0.00062,
  USDT_NGN: 1600,
  USDT_BTC: 0.000016,
  USDT_ETH: 0.00032,
  USDT_SOL: 0.0067,
  BTC_USDT: 62500,
  ETH_USDT: 3125,
  SOL_USDT: 150,
};

const currencies = [
  { id: "NGN", name: "Nigerian Naira", symbol: "₦", icon: null, network: "INTERNAL" },
  { id: "USDT", name: "USDT (TRC20)", symbol: "₮", icon: <SiTether className="w-5 h-5 text-green-500" />, network: "TRC20" },
  { id: "USDT_ERC20", name: "USDT (ERC20)", symbol: "₮", icon: <SiTether className="w-5 h-5 text-blue-500" />, network: "ERC20" },
  { id: "BTC", name: "Bitcoin", symbol: "₿", icon: <SiBitcoin className="w-5 h-5 text-orange-500" />, network: "BTC" },
  { id: "ETH", name: "Ethereum (ERC20)", symbol: "Ξ", icon: <SiEthereum className="w-5 h-5 text-blue-500" />, network: "ERC20" },
  { id: "SOL", name: "Solana", symbol: "◎", icon: <SiSolana className="w-5 h-5 text-purple-500" />, network: "SOL" },
  { id: "TRX", name: "Tron (TRX)", symbol: "TRX", icon: null, network: "TRC20" },
  { id: "ETH_TRC20", name: "ETH (TRC20)", symbol: "Ξ", icon: <SiEthereum className="w-5 h-5 text-green-500" />, network: "TRC20" },
  { id: "SOL_TRC20", name: "SOL (TRC20)", symbol: "◎", icon: <SiSolana className="w-5 h-5 text-green-600" />, network: "TRC20" },
];

export default function Convert() {
  const queryClient = useQueryClient();
  const { data: balancesData } = useBalances();

  const { toast } = useToast();
  const [fromCurrency, setFromCurrency] = useState("NGN");
  const [toCurrency, setToCurrency] = useState("USDT");
  const [amount, setAmount] = useState("");
  const [convertedAmount, setConvertedAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [rates, setRates] = useState<Record<string, number>>({});
  const [marketRate, setMarketRate] = useState<number>(0);
  const [spread, setSpread] = useState<number>(0);

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      const res = await fetch("/api/transactions/rates");
      const data = await res.json();
      if (data.success) {
        setRates(data.rates);
        setMarketRate(data.marketRate);
        setSpread(data.spread);
      }
    } catch (error) {
      console.error("Failed to fetch rates:", error);
    }
  };

  const getRate = (from: string, to: string): number => {
    const pair = `${from}_${to}`;
    return rates[pair] || 0;
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    if (value) {
      const rate = getRate(fromCurrency, toCurrency);
      if (rate === 0) {
        setConvertedAmount("Loading...");
      } else {
        const converted = parseFloat(value) * rate;
        const displayDecimals = toCurrency === 'NGN' ? 2 : 6;
        setConvertedAmount(converted.toFixed(displayDecimals));
      }
    } else {
      setConvertedAmount("");
    }
  };

  const swapCurrencies = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
    setAmount("");
    setConvertedAmount("");
  };

  const handleConvert = async () => {
    setIsProcessing(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
      const token = userInfo.token;

      if (!token) {
        setErrorMessage("Please login to swap.");
        setIsProcessing(false);
        return;
      }

      const res = await fetch("/api/transactions/swap", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromCurrency,
          toCurrency,
          amount: parseFloat(amount)
        })
      });

      const data = await res.json();

      if (data.success) {
        const toCurr = currencies.find(c => c.id === toCurrency);
        const displayDecimals = toCurrency === 'NGN' ? 2 : 6;

        toast({
          title: "Swap Successful",
          description: `Successfully swapped ${amount} ${fromCurrency} to ${data.receivedAmount.toFixed(displayDecimals)} ${toCurrency}`
        });

        await queryClient.invalidateQueries({ queryKey: ["userBalances"] });

        setAmount("");
        setConvertedAmount("");
        fetchRates(); // Refresh rates
      } else {
        toast({
          title: "Swap Failed",
          description: data.error || "Swap failed",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Network Error",
        description: "Network error",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const currentRate = getRate(fromCurrency, toCurrency);

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-background">
      <Header />

      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Convert</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Exchange between Naira and crypto at the best rates
        </p>

        <Card className="p-4 mb-4">
          <Label className="text-sm text-muted-foreground mb-2 block">From</Label>
          <div className="flex gap-3">
            <Select value={fromCurrency} onValueChange={(v) => { setFromCurrency(v); setAmount(""); setConvertedAmount(""); }}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      {c.icon}
                      <span>{c.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="flex-1"
            />
          </div>
        </Card>

        <div className="flex justify-center -my-2 z-10 relative">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full bg-card"
            onClick={swapCurrencies}
          >
            <ArrowDownUp className="w-4 h-4" />
          </Button>
        </div>

        <Card className="p-4 mb-6">
          <Label className="text-sm text-muted-foreground mb-2 block">To</Label>
          <div className="flex gap-3">
            <Select value={toCurrency} onValueChange={(v) => { setToCurrency(v); setAmount(""); setConvertedAmount(""); }}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map(c => {
                  const fromCurr = currencies.find(curr => curr.id === fromCurrency);
                  const isAllowed = c.id === "NGN" || fromCurrency === "NGN" || c.network === fromCurr?.network;

                  return (
                    <SelectItem key={c.id} value={c.id} disabled={!isAllowed}>
                      <div className="flex items-center gap-2">
                        {c.icon}
                        <span className={!isAllowed ? "opacity-50" : ""}>{c.name}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="0.00"
              value={convertedAmount}
              readOnly
              className="flex-1 bg-muted"
            />
          </div>
        </Card>

        <div className="text-center text-sm text-muted-foreground mb-4">
          Rate: 1 {fromCurrency} = {currentRate.toFixed(6)} {toCurrency}
        </div>

        <Button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          size="lg"
          disabled={!amount || isProcessing || !rates['USDT_NGN']}
          onClick={handleConvert}
        >
          {isProcessing ? "Swapping..." : (rates['USDT_NGN'] ? "Convert Now" : "Loading Rates...")}
        </Button>
      </div>
    </div>
  );
}
