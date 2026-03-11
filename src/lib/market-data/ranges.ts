// src/lib/market-data/ranges.ts
import type { RangeKey } from "./types";

/**
 * Yahoo usa:
 *  - range: 5d, 1mo, 3mo, 6mo, 1y, max
 *  - interval: 5m, 1d, 1wk (etc)
 *
 * Para simplicidad y bajo costo: usamos interval 1d para casi todo.
 */
export function yahooRangeInterval(range: RangeKey): { range: string; interval: string } {
  switch (range) {
    case "1S":
      return { range: "5d", interval: "5m" };
    case "1M":
      return { range: "1mo", interval: "1d" };
    case "3M":
      return { range: "3mo", interval: "1d" };
    case "6M":
      return { range: "6mo", interval: "1d" };
    case "1A":
      return { range: "1y", interval: "1d" };
    case "MAX":
    default:
      return { range: "max", interval: "1d" };
  }
}

/**
 * CoinGecko market_chart usa `days`:
 * 1, 30, 90, 180, 365, max
 */
export function coingeckoDays(range: RangeKey): "1" | "30" | "90" | "180" | "365" | "max" {
  switch (range) {
    case "1S":
      return "1";
    case "1M":
      return "30";
    case "3M":
      return "90";
    case "6M":
      return "180";
    case "1A":
      return "365";
    case "MAX":
    default:
      return "max";
  }
}

export function ttlSecondsForQuote(): number {
  // 2 minutos: barato y suficiente para UI.
  return 120;
}

export function ttlSecondsForHistory(range: RangeKey): number {
  // histórico cambia poco, subimos TTL para ser baratos
  switch (range) {
    case "1S":
      return 60 * 10; // 10 min
    case "1M":
      return 60 * 30; // 30 min
    case "3M":
    case "6M":
      return 60 * 60; // 1h
    case "1A":
      return 60 * 60 * 3; // 3h
    case "MAX":
    default:
      return 60 * 60 * 12; // 12h
  }
}
