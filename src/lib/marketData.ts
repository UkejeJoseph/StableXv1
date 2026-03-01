// Backend proxy for market data
const API_BASE = import.meta.env.VITE_API_URL || '';

export interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
}

export interface MarketPrice {
  usd: number;
  usd_24h_change: number;
  usd_24h_vol?: number;
  high_24h?: number;
  low_24h?: number;
  ngn?: number;
  source: string;
  timestamp: number;
}

export interface MarketData {
  prices: Record<string, MarketPrice>;
  ngnRates: Record<string, { ngn: number }>;
  usdToNgn: number;
  rates: {
    USDT_NGN: number;
    NGN_USDT: number;
    BTC_NGN: number;
    ETH_NGN: number;
    SOL_NGN: number;
  };
  source: string;
  stale: boolean;
  timestamp: string;
}

// Single fetch function - calls backend only
export async function fetchMarketData(): Promise<MarketData> {
  console.log('[MARKET-DATA] Fetching from backend proxy...');

  const res = await fetch(`${API_BASE}/api/prices/markets`, {
    credentials: 'include',
  });

  if (!res.ok) {
    console.error('[MARKET-DATA] ❌ Backend price fetch failed:', res.status);
    throw new Error('Failed to fetch market data');
  }

  const data = await res.json();
  console.log('[MARKET-DATA] ✅ Prices received from:', data.source);

  if (data.stale) {
    console.warn('[MARKET-DATA] ⚠️ Prices may be delayed');
  }

  return data;
}

// Get specific swap rate
export async function fetchSwapRate(
  from: string,
  to: string
): Promise<number> {
  console.log('[MARKET-DATA] Fetching swap rate:', from, '→', to);

  const res = await fetch(
    `${API_BASE}/api/prices/rate?from=${from}&to=${to}`,
    { credentials: 'include' }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch rate for ${from}/${to}`);
  }

  const data = await res.json();
  console.log('[MARKET-DATA] Rate:', from, '→', to, '=', data.rate);

  return data.rate;
}

// Compatibility layer for existing components (fallback)
export async function getMarketPrices(): Promise<any[]> {
  const data = await fetchMarketData();
  // Map back to old format if needed, but better to update components
  return Object.entries(data.prices).map(([symbol, price]: [string, any]) => ({
    id: symbol.toLowerCase(),
    symbol,
    name: symbol, // Placeholder
    price: price.usd,
    priceChange24h: price.usd_24h_change,
    marketCap: 0,
    volume24h: price.usd_24h_vol || 0,
  }));
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
