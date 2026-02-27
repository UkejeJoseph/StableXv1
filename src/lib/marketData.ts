export interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  image?: string;
}

const COINGECKO_API = import.meta.env.VITE_COINGECKO_API || "https://api.coingecko.com/api/v3";
const BINANCE_API = import.meta.env.VITE_BINANCE_API || "https://api.binance.com/api/v3";

export async function getMarketPrices(): Promise<CryptoPrice[]> {
  try {
    // 1. Try CoinGecko first (more tokens, richer data)
    const response = await fetch(
      `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,tron,binancecoin&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h`
    );

    if (response.ok) {
      const data = await response.json();
      return data.map((coin: any) => ({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        price: coin.current_price,
        priceChange24h: coin.price_change_percentage_24h || 0,
        marketCap: coin.market_cap,
        volume24h: coin.total_volume,
        image: coin.image,
      }));
    }

    console.warn("CoinGecko rate limited or down, falling back to Binance...");
    throw new Error("CoinGecko fail");

  } catch (error) {
    // 2. Fallback to Binance (Reliable, high rate limits, but limited to USDT pairs)
    try {
      const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "TRXUSDT", "BNBUSDT"];
      const response = await fetch(`${BINANCE_API}/ticker/24hr?symbols=${JSON.stringify(symbols)}`);

      if (!response.ok) throw new Error("Binance fail");

      const data = await response.json();
      const symbolMap: Record<string, string> = {
        BTCUSDT: "BTC", ETHUSDT: "ETH", SOLUSDT: "SOL", TRXUSDT: "TRX", BNBUSDT: "BNB"
      };
      const nameMap: Record<string, string> = {
        BTCUSDT: "Bitcoin", ETHUSDT: "Ethereum", SOLUSDT: "Solana", TRXUSDT: "Tron", BNBUSDT: "Binance Coin"
      };

      return data.map((item: any) => ({
        id: item.symbol.toLowerCase(),
        symbol: symbolMap[item.symbol],
        name: nameMap[item.symbol],
        price: parseFloat(item.lastPrice),
        priceChange24h: parseFloat(item.priceChangePercent),
        marketCap: 0, // Binance ticker doesn't provide market cap easily
        volume24h: parseFloat(item.quoteVolume),
      }));
    } catch (binanceError) {
      console.error("Critical market data failure:", binanceError);
      return [];
    }
  }
}

export async function getTrendingCoins(): Promise<CryptoPrice[]> {
  try {
    const response = await fetch(`${COINGECKO_API}/search/trending`);

    if (!response.ok) {
      throw new Error(`Failed to fetch trending coins: ${response.statusText}`);
    }

    const data = await response.json();

    return data.coins.slice(0, 5).map((item: any) => ({
      id: item.item.id,
      symbol: item.item.symbol.toUpperCase(),
      name: item.item.name,
      price: item.item.data?.price || 0,
      priceChange24h: item.item.data?.price_change_percentage_24h?.usd || 0,
      marketCap: item.item.data?.market_cap || 0,
      volume24h: item.item.data?.total_volume || 0,
      image: item.item.thumb,
    }));
  } catch (error) {
    console.error("Error fetching trending coins:", error);
    return [];
  }
}

export function formatPrice(price: number): string {
  if (price >= 1000) {
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (price >= 1) {
    return `$${price.toFixed(2)}`;
  }
  if (price >= 0.01) {
    return `$${price.toFixed(4)}`;
  }
  return `$${price.toFixed(6)}`;
}

export function formatMarketCap(marketCap: number): string {
  if (marketCap >= 1e12) {
    return `$${(marketCap / 1e12).toFixed(2)}T`;
  }
  if (marketCap >= 1e9) {
    return `$${(marketCap / 1e9).toFixed(2)}B`;
  }
  if (marketCap >= 1e6) {
    return `$${(marketCap / 1e6).toFixed(2)}M`;
  }
  return `$${marketCap.toLocaleString()}`;
}

export function formatVolume(volume: number): string {
  if (volume >= 1e9) {
    return `$${(volume / 1e9).toFixed(2)}B`;
  }
  if (volume >= 1e6) {
    return `$${(volume / 1e6).toFixed(2)}M`;
  }
  return `$${volume.toLocaleString()}`;
}
