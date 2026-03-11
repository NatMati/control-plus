// src/lib/market-data/providers/coingecko.ts
import type { HistoryPoint, MarketProvider, RangeKey } from "../types";
import { coingeckoDays } from "../ranges";

class RateLimitError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "RateLimitError";
    this.status = status;
  }
}

async function fetchJson(url: string, timeoutMs = 12_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "ControlPlus/1.0",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const txt = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(txt);
    } catch {
      json = null;
    }

    if (!res.ok) {
      if (res.status === 429) throw new RateLimitError("Rate limit del proveedor (coingecko).", 429);
      throw new Error(`CoinGecko error ${res.status}: ${txt?.slice(0, 200)}`);
    }

    return json;
  } finally {
    clearTimeout(t);
  }
}

export async function coingeckoSimplePrice(ids: string[]): Promise<Record<string, number | null>> {
  if (!ids.length) return {};

  const url =
    "https://api.coingecko.com/api/v3/simple/price" +
    `?ids=${encodeURIComponent(ids.join(","))}&vs_currencies=usd`;

  const json = await fetchJson(url);
  const out: Record<string, number | null> = {};

  for (const id of ids) {
    const v = json?.[id]?.usd;
    out[id] = typeof v === "number" ? v : null;
  }
  return out;
}

export async function coingeckoHistoryDaily(coinId: string, range: RangeKey): Promise<HistoryPoint[]> {
  const days = coingeckoDays(range);

  const url =
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/market_chart` +
    `?vs_currency=usd&days=${days}`;

  const json = await fetchJson(url);

  // json.prices = [[timestampMs, price], ...]
  const prices: any[] = Array.isArray(json?.prices) ? json.prices : [];
  const points: HistoryPoint[] = prices
    .map((p) => {
      const ts = Array.isArray(p) ? p[0] : null;
      const price = Array.isArray(p) ? p[1] : null;
      if (typeof ts !== "number" || typeof price !== "number") return null;

      const d = new Date(ts);
      const iso = d.toISOString().slice(0, 10);
      return { date: iso, price };
    })
    .filter(Boolean) as HistoryPoint[];

  // dedupe por fecha (si viene repetido)
  const map = new Map<string, number>();
  for (const pt of points) map.set(pt.date, pt.price);
  return Array.from(map.entries()).map(([date, price]) => ({ date, price }));
}

/**
 * Provider object export
 */
export const CoinGeckoProvider: MarketProvider = {
  name: "coingecko",

  quote: async ({ coinId }) => {
    if (!coinId) return null;
    const r = await coingeckoSimplePrice([coinId]);
    return r[coinId] ?? null;
  },

  history: async ({ coinId, range }) => {
    if (!coinId) return [];
    return coingeckoHistoryDaily(coinId, range);
  },
};

export function isCoinGeckoRateLimitError(e: any): boolean {
  return e?.name === "RateLimitError" || e?.status === 429 || String(e?.message || "").includes("Rate limit");
}
