import { ArrowUpRight, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useWallet } from "@/contexts/WalletContext";
import { useQuery } from "@tanstack/react-query";

const fetchExchangeRate = async (): Promise<number> => {
  try {
    const res = await fetch("/api/transactions/rates");
    const data = await res.json();
    if (data.success && data.rates?.USDT_NGN) {
      return data.rates.USDT_NGN;
    }
  } catch (error) {
    console.error("Failed to fetch exchange rate:", error);
  }
  return 1600; // Fallback rate
};

export const BalanceCard = () => {
  const { balance } = useWallet();

  const { data: rate } = useQuery({
    queryKey: ["exchangeRate"],
    queryFn: fetchExchangeRate,
    refetchInterval: 30000,
  });

  const ngnValue = parseFloat(balance) * (rate || 0);

  return (
    <Card className="p-6 bg-gradient-to-br from-primary to-primary-glow text-white shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          <span className="text-sm font-medium opacity-90">USDT Balance</span>
        </div>
        <div className="flex items-center gap-1 text-sm opacity-90">
          <span>1 USDT</span>
          <ArrowUpRight className="h-3 w-3" />
          <span>₦{rate?.toLocaleString()}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-4xl font-bold">
          {parseFloat(balance).toFixed(2)} USDT
        </div>
        <div className="text-lg opacity-90">
          ≈ ₦{ngnValue.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
        </div>
      </div>
    </Card>
  );
};
