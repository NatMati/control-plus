// src/lib/market-data/symbol.ts
import type { AssetClass } from "./types";

export function normalizeSymbol(raw: string): string {
  const s = String(raw ?? "").trim().toUpperCase();
  if (!s) return "";
  // si viene "quote:ADA" o "ADA:USDT" normalizamos al último token
  if (s.includes(":")) return s.split(":").pop()!.trim().toUpperCase();
  return s;
}

// Heurística simple (tu catálogo manda igual)
const CRYPTO_SET = new Set(["BTC", "ETH", "SOL", "XRP", "ADA", "BNB", "DOGE", "AVAX", "MATIC", "LINK", "DOT", "LTC", "BCH", "UNI"]);

export function resolveAssetClass(symbol: string): AssetClass {
  const s = normalizeSymbol(symbol);
  return CRYPTO_SET.has(s) ? "CRYPTO" : "STOCK";
}
