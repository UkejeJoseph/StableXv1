import { useState } from "react";
import { WebLayout } from "@/components/WebSidebar";
import { Search, TrendingUp, TrendingDown, Circle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SiBitcoin, SiEthereum, SiSolana, SiTether } from "react-icons/si";
import { PriceChart } from "@/components/PriceChart";

interface Coin {
  id: string;
  name: string;
  symbol: string;
  network?: string;
  price: number;
  change: number;
  IconComponent: typeof SiBitcoin | typeof Circle;
  iconColor: string;
}

const coins: Coin[] = [
  { id: "btc", name: "Bitcoin", symbol: "BTC", price: 88701, change: -2.59, IconComponent: SiBitcoin, iconColor: "text-orange-500" },
  { id: "eth", name: "Ethereum", symbol: "ETH", network: "ERC20", price: 2939, change: -5.18, IconComponent: SiEthereum, iconColor: "text-slate-600" },
  { id: "sol", name: "SOL", symbol: "SOL", price: 127, change: -0.98, IconComponent: SiSolana, iconColor: "text-purple-500" },
  { id: "usdt-erc20", name: "USD Tether", symbol: "USDT", network: "ERC20", price: 1, change: 0.01, IconComponent: SiTether, iconColor: "text-green-500" },
  { id: "usdt-trc20", name: "USD Tether", symbol: "USDT", network: "TRC20", price: 1, change: 0.01, IconComponent: SiTether, iconColor: "text-red-500" },
];

export default function WebTrade() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);
  const [showChart, setShowChart] = useState(false);

  const filteredCoins = coins.filter(
    (coin) =>
      coin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coin.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <WebLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1" data-testid="trade-title">Trade Coins</h1>
          <p className="text-sm text-muted-foreground">Click any coin to start trading</p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for a coin"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary border-0"
            data-testid="input-search-coin"
          />
        </div>

        <h2 className="text-lg font-semibold text-foreground mb-4">All</h2>

        <div className="space-y-2">
          {filteredCoins.map((coin) => {
            const IconComponent = coin.IconComponent;
            return (
              <Card
                key={coin.id}
                className="p-4 flex items-center justify-between cursor-pointer"
                data-testid={`coin-${coin.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                    <IconComponent className={`w-5 h-5 ${coin.iconColor}`} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{coin.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {coin.symbol} {coin.network && `(${coin.network})`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-medium text-foreground">
                      {coin.price.toLocaleString()} USD
                    </p>
                    <div className={`flex items-center gap-1 text-xs justify-end ${coin.change >= 0 ? "text-success" : "text-destructive"
                      }`}>
                      {coin.change >= 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {Math.abs(coin.change)}%
                    </div>
                  </div>
                  {coin.symbol !== "USDT" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCoin(coin);
                        setShowChart(true);
                      }}
                    >
                      <TrendingUp className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        <Dialog open={showChart} onOpenChange={setShowChart}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedCoin && (
                  <>
                    <selectedCoin.IconComponent className={`w-5 h-5 ${selectedCoin.iconColor}`} />
                    {selectedCoin.name} ({selectedCoin.symbol}) Price Chart
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            {selectedCoin && <PriceChart symbol={selectedCoin.symbol} />}
          </DialogContent>
        </Dialog>
      </div>
    </WebLayout>
  );
}
