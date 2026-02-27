import { useState, useEffect } from "react";
import { Eye, EyeOff, ChevronDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type WalletType = "NGN" | "USD" | "USDT";

interface BalanceDisplayProps {
  currency?: WalletType;
}

const walletLabels: Record<WalletType, string> = {
  NGN: "Naira Wallet",
  USD: "Dollar Wallet",
  USDT: "USDT Wallet",
};

import { useBalances } from "@/hooks/useBalances";

export function BalanceDisplay({ currency: initialCurrency = "NGN" }: BalanceDisplayProps) {
  const [isHidden, setIsHidden] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletType>(initialCurrency);

  const { data: balancesData, isLoading: isRefreshing } = useBalances();

  const balances = balancesData || { NGN: 0, USD: 0, USDT: 0 };
  const isLive = true;

  const formatBalance = (amount: number, wallet: WalletType) => {
    if (wallet === "NGN") {
      return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
    }
    if (wallet === "USD") {
      return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
    }
    return `${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} USDT`;
  };

  const getUsdEquivalent = (amount: number, wallet: WalletType) => {
    if (wallet === "NGN") {
      return amount * 0.00062;
    }
    if (wallet === "USDT") {
      return amount;
    }
    return amount;
  };

  const currentBalance = balances[selectedWallet] || 0;
  const usdEquivalent = getUsdEquivalent(currentBalance, selectedWallet);

  return (
    <div className="text-center py-6 px-4" data-testid="balance-display">
      <div className="flex items-center justify-center gap-2 mb-2">
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${isLive ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
          <span className="text-xs text-muted-foreground">
            {isRefreshing ? "Updating..." : "Live"}
          </span>
        </div>
        {isRefreshing && <RefreshCw className="w-3 h-3 text-muted-foreground animate-spin" />}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="mb-2 text-muted-foreground" data-testid="button-wallet-selector">
            {walletLabels[selectedWallet]}
            <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setSelectedWallet("NGN")}>
            <span className="mr-2">₦</span> Naira Wallet
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSelectedWallet("USD")}>
            <span className="mr-2">$</span> Dollar Wallet
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSelectedWallet("USDT")}>
            <span className="mr-2 text-green-500 font-bold">₮</span> USDT Wallet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex items-center justify-center gap-2">
        <h1 className="text-4xl font-bold text-foreground" data-testid="balance-amount">
          {isHidden ? "****" : formatBalance(currentBalance, selectedWallet)}
        </h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsHidden(!isHidden)}
          className="text-muted-foreground"
          data-testid="button-toggle-balance"
        >
          {isHidden ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
        </Button>
      </div>

      {selectedWallet !== "USD" && (
        <p className="text-muted-foreground text-sm mt-1" data-testid="balance-usd">
          {isHidden ? "****" : `≈ $${usdEquivalent.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD`}
        </p>
      )}
    </div>
  );
}
