// src/lib/market-data/providers/yahoo.ts
import type { HistoryPoint, MarketProvider, RangeKey } from "../types";
import { yahooRangeInterval } from "../ranges";

async function fetchJson(url: string, timeoutMs = 12_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "ControlPlus/1.0",
        Accept: "application/json,text/plain,*/*",
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
      throw new Error(`Yahoo error ${res.status}: ${txt?.slice(0, 200)}`);
    }

    return json;
  } finally {
    clearTimeout(t);
  }
}

export async function yahooQuote(symbol: string): Promise<number | null> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  const json = await fetchJson(url);

  const r = json?.quoteResponse?.result?.[0];
  const price = r?.regularMarketPrice;

  return typeof price === "number" ? price : null;
}

export async function yahooQuotesBatch(symbols: string[]): Promise<Record<string, number | null>> {
  if (!symbols.length) return {};

  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}`;
  const json = await fetchJson(url);

  const out: Record<string, number | null> = {};
  for (const s of symbols) out[s] = null;

  const arr = Array.isArray(json?.quoteResponse?.result) ? json.quoteResponse.result : [];
  for (const r of arr) {
    const sym = r?.symbol;
    const price = r?.regularMarketPrice;
    if (typeof sym === "string") out[sym] = typeof price === "number" ? price : null;
  }

  return out;
}

export async function yahooHistory(symbol: string, range: RangeKey): Promise<HistoryPoint[]> {
  const { range: rangeParam, interval: intervalParam } = yahooRangeInterval(range);

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${encodeURIComponent(rangeParam)}&interval=${encodeURIComponent(intervalParam)}`;

  const json = await fetchJson(url);

  const result = json?.chart?.result?.[0];
  const timestamps: number[] = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const closesRaw = result?.indicators?.quote?.[0]?.close;
  const closes: any[] = Array.isArray(closesRaw) ? closesRaw : [];

  const points: HistoryPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const price = closes[i];
    if (typeof ts !== "number" || typeof price !== "number") continue;

    const iso = new Date(ts * 1000).toISOString().slice(0, 10);
    points.push({ date: iso, price });
  }

  // dedupe por date
  const map = new Map<string, number>();
  for (const pt of points) map.set(pt.date, pt.price);
  return Array.from(map.entries()).map(([date, price]) => ({ date, price }));
}

/**
 * Provider object export
 */
export const YahooProvider: MarketProvider = {
  name: "yahoo",

  quote: async ({ symbol }) => yahooQuote(symbol),

  history: async ({ symbol, range }) => yahooHistory(symbol, range),
};
