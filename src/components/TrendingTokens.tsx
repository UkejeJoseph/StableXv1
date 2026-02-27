import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getMarketPrices, type CryptoPrice } from "@/lib/marketData";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export function TrendingTokens() {
  const [tokens, setTokens] = useState<CryptoPrice[]>([]);
  const [activeTab, setActiveTab] = useState("hot");

  useEffect(() => {
    const fetchPrices = async () => {
      const data = await getMarketPrices();
      setTokens(data);
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 5000); // 5s refresh for live feel
    return () => clearInterval(interval);
  }, []);

  // Organize tokens based on tabs (mocking categories using the limited dataset)
  const getTabTokens = () => {
    if (!tokens.length) return [];

    let sorted = [...tokens];
    if (activeTab === "gainers") {
      sorted.sort((a, b) => b.priceChange24h - a.priceChange24h);
    } else if (activeTab === "volume") {
      sorted.sort((a, b) => b.volume24h - a.volume24h);
    }
    // "hot" just uses default order

    return sorted.slice(0, 5); // Show top 5 rows
  };

  const displayTokens = getTabTokens();

  return (
    <Card className="bg-[#1e2329] border-border/10 overflow-hidden shadow-lg mt-6">
      <div className="p-0">

        {/* Binance Style Top Header Tabs */}
        <div className="flex items-center gap-6 px-6 pt-6 pb-2 border-b border-border/10">
          <button
            onClick={() => setActiveTab("hot")}
            className={`text-base font-bold pb-2 border-b-2 transition-colors ${activeTab === 'hot' ? 'text-white border-[#F0B90B]' : 'text-muted-foreground border-transparent hover:text-white'}`}
          >
            Hot
          </button>
          <button
            onClick={() => setActiveTab("gainers")}
            className={`text-base font-bold pb-2 border-b-2 transition-colors ${activeTab === 'gainers' ? 'text-white border-[#F0B90B]' : 'text-muted-foreground border-transparent hover:text-white'}`}
          >
            Top Gainers
          </button>
          <button
            onClick={() => setActiveTab("volume")}
            className={`text-base font-bold pb-2 border-b-2 transition-colors ${activeTab === 'volume' ? 'text-white border-[#F0B90B]' : 'text-muted-foreground border-transparent hover:text-white'}`}
          >
            Top Volume
          </button>
        </div>

        {/* Binance Style Wide Data Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground font-medium border-b border-border/10 bg-[#0b0e11]/30">
              <tr>
                <th className="pl-6 py-4 font-normal">Name</th>
                <th className="px-4 py-4 font-normal text-right">Price</th>
                <th className="px-4 py-4 font-normal text-right">24h Change</th>
                <th className="px-4 py-4 font-normal text-right hidden lg:table-cell">Market Cap</th>
                <th className="pr-6 py-4 font-normal text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {displayTokens.length > 0 ? displayTokens.map((token) => (
                <tr key={token.id} className="group hover:bg-white/5 transition-colors cursor-pointer border-b border-border/5 last:border-0">

                  {/* Coin Name & Icon */}
                  <td className="pl-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {token.image ? (
                        <img src={token.image} alt={token.name} className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground">
                          {token.symbol.slice(0, 2)}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground text-base flex items-center gap-2">
                          {token.symbol}
                          <span className="text-[10px] px-1.5 py-0.5 bg-muted/50 text-muted-foreground rounded font-medium">Vol {(token.volume24h / 1e6).toFixed(1)}M</span>
                        </span>
                        <span className="text-xs text-muted-foreground">{token.name}</span>
                      </div>
                    </div>
                  </td>

                  {/* Price */}
                  <td className="px-4 py-4 text-right whitespace-nowrap">
                    <span className="font-medium text-foreground text-base">
                      ${token.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    </span>
                  </td>

                  {/* 24h Change Pill */}
                  <td className="px-4 py-4 text-right whitespace-nowrap">
                    <div className="flex justify-end">
                      <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-md font-medium text-sm w-[80px] ${token.priceChange24h >= 0
                        ? 'bg-green-500/10 text-green-500'
                        : 'bg-red-500/10 text-red-500'
                        }`}>
                        {token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%
                      </span>
                    </div>
                  </td>

                  {/* Market Cap (Hidden on mobile) */}
                  <td className="px-4 py-4 text-right text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                    ${(token.marketCap / 1e9).toFixed(2)}B
                  </td>

                  {/* Trade Action */}
                  <td className="pr-6 py-4 text-right whitespace-nowrap">
                    <Button variant="link" className="text-[#F0B90B] hover:text-[#F0B90B]/80 font-semibold p-0 h-auto" asChild>
                      <Link to={window.location.pathname.startsWith('/web')
                        ? `/web/trade?symbol=${token.symbol}`
                        : `/trade?symbol=${token.symbol}`
                      }>
                        Trade
                      </Link>
                    </Button>
                  </td>

                </tr>
              )) : (
                /* Loading State Fallback */
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    Loading market data...
                  </td>
                </tr>
              )}

            </tbody>
          </table>
        </div>

        {/* View All Footer */}
        <div className="p-4 flex justify-center border-t border-border/10">
          <Button variant="ghost" className="text-muted-foreground hover:text-white gap-1 text-sm">
            View All Markets <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

      </div>
    </Card>
  );
}
