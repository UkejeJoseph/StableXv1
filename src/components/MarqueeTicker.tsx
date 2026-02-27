import { useState, useEffect } from "react";
import { getMarketPrices, formatPrice, type CryptoPrice } from "@/lib/marketData";
import { SiBitcoin, SiEthereum, SiSolana } from "react-icons/si";
import "../marquee.css";

const cryptoIcons: Record<string, JSX.Element> = {
  BTC: <SiBitcoin className="w-4 h-4 text-orange-500" />,
  ETH: <SiEthereum className="w-4 h-4 text-blue-400" />,
  SOL: <SiSolana className="w-4 h-4 text-purple-500" />,
  TRX: <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white text-[8px] font-bold">T</div>,
  BNB: <div className="w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center text-white text-[8px] font-bold">B</div>,
};

export function MarqueeTicker() {
  const [tokens, setTokens] = useState<CryptoPrice[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getMarketPrices();
        setTokens(data);
      } catch (error) {
        console.error("Failed to fetch market data:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (tokens.length === 0) {
    return (
      <div className="px-4 mt-4">
        <div className="bg-card border rounded-lg py-2 px-4">
          <div className="flex items-center gap-4 animate-pulse">
            <div className="w-4 h-4 bg-muted rounded-full" />
            <div className="w-20 h-4 bg-muted rounded" />
            <div className="w-4 h-4 bg-muted rounded-full" />
            <div className="w-20 h-4 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  const tickerItems = [...tokens, ...tokens];

  return (
    <div className="px-4 mt-4">
      <div className="marquee-container bg-card border rounded-lg py-2">
        <div className="marquee-content">
          {tickerItems.map((token, index) => (
            <div key={`${token.id}-${index}`} className="marquee-item">
              {token.image ? (
                <img src={token.image} alt={token.name} className="w-4 h-4 rounded-full" />
              ) : (
                cryptoIcons[token.symbol] || (
                  <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold">
                    {token.symbol.slice(0, 2)}
                  </div>
                )
              )}
              <span className="font-medium text-xs">{token.symbol}</span>
              <span className="text-xs text-muted-foreground">{formatPrice(token.price)}</span>
              <span className={`text-[10px] font-medium ${
                token.priceChange24h >= 0 ? "text-green-500" : "text-red-500"
              }`}>
                {token.priceChange24h >= 0 ? "+" : ""}{token.priceChange24h.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
