// src/lib/market-data/types.ts

export type ProviderName = "yahoo" | "coingecko";
export type AssetClass = "CRYPTO" | "STOCK";

export type RangeKey = "1S" | "1M" | "3M" | "6M" | "1A" | "MAX";

export type HistoryPoint = {
  date: string; // YYYY-MM-DD
  price: number;
};

export type QuoteResult = {
  symbol: string;
  price: number | null;
  currency: "USD";
  source: ProviderName;
  cached: boolean;
  updated_at?: string;
  stale?: boolean; // si vino de cache expirado por rate-limit / error proveedor
  error?: string; // texto corto si hubo rate-limit / error proveedor
};

export type HistoryResult = {
  symbol: string;
  range: RangeKey;
  points: HistoryPoint[];
  source: ProviderName;
  cached: boolean;
  updated_at?: string;
  stale?: boolean;
  error?: string;
};

export type CacheGetResult<T> =
  | {
      found: false;
      fresh: false;
      value: null;
      updated_at?: undefined;
      source?: undefined;
      expires_at?: undefined;
    }
  | {
      found: true;
      fresh: boolean;
      value: T;
      updated_at: string;
      source: ProviderName;
      expires_at: string;
    };

export type AssetCatalogRow = {
  symbol: string;
  asset_type: "crypto" | "stock";
  coingecko_id: string | null;
  yahoo_symbol: string | null;
  binance_symbol: string | null;
  is_active: boolean | null;
  updated_at: string | null;
};

export type MarketProvider = {
  name: ProviderName;

  // Quote devuelve solo precio (USD). El service arma QuoteResult + cache.
  quote: (input: { symbol: string; coinId?: string | null }) => Promise<number | null>;

  // History devuelve puntos (YYYY-MM-DD, price). El service arma HistoryResult + cache.
  history: (input: { symbol: string; coinId?: string | null; range: RangeKey }) => Promise<HistoryPoint[]>;
};
