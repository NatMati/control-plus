// src/lib/market-data/service.ts
import { createAdminClient } from "@/lib/supabase/admin";
import type { AssetCatalogRow, HistoryResult, QuoteResult, RangeKey } from "./types";
import { cacheGet, cacheSet } from "./cache/supabase";
import { ttlSecondsForHistory, ttlSecondsForQuote } from "./ranges";
import { normalizeSymbol } from "./symbol";
import { CoinGeckoProvider, isCoinGeckoRateLimitError } from "./providers/coingecko";
import { YahooProvider, yahooQuotesBatch } from "./providers/yahoo";

/**
 * Lee catálogo por símbolo (admin client).
 */
export async function getAssetCatalogRow(symbol: string): Promise<AssetCatalogRow | null> {
  const supabase = createAdminClient();
  const sym = normalizeSymbol(symbol);

  const { data, error } = await supabase
    .from("asset_catalog")
    .select("*")
    .eq("symbol", sym)
    .maybeSingle<AssetCatalogRow>();

  if (error) throw error;
  return data ?? null;
}

/**
 * Quote single con cache + fallback a stale si hay rate-limit.
 */
export async function getQuote(symbol: string): Promise<QuoteResult> {
  const sym = normalizeSymbol(symbol);
  const cacheKey = `quote:${sym}`;

  const cached = await cacheGet<{ price: number | null }>(cacheKey);
  if (cached.found && cached.fresh) {
    return {
      symbol: sym,
      price: typeof cached.value?.price === "number" ? cached.value.price : null,
      currency: "USD",
      source: cached.source,
      cached: true,
      updated_at: cached.updated_at,
    };
  }

  // decidir proveedor por catálogo
  const cat = await getAssetCatalogRow(sym);

  const isCrypto = cat?.asset_type === "crypto";
  const provider = isCrypto ? CoinGeckoProvider : YahooProvider;

  try {
    const price = await provider.quote({
      symbol: cat?.yahoo_symbol ? normalizeSymbol(cat.yahoo_symbol) : sym,
      coinId: cat?.coingecko_id ?? null,
    });

    await cacheSet(cacheKey, { price }, ttlSecondsForQuote() * 1000, provider.name);

    return {
      symbol: sym,
      price,
      currency: "USD",
      source: provider.name,
      cached: false,
      updated_at: new Date().toISOString(),
    };
  } catch (e: any) {
    // Fallback: si hay cache viejo, devolvémoslo como stale
    if (cached.found) {
      return {
        symbol: sym,
        price: typeof cached.value?.price === "number" ? cached.value.price : null,
        currency: "USD",
        source: cached.source,
        cached: true,
        updated_at: cached.updated_at,
        stale: true,
        error: isCoinGeckoRateLimitError(e) ? "rate_limit" : "provider_error",
      };
    }

    return {
      symbol: sym,
      price: null,
      currency: "USD",
      source: provider.name,
      cached: false,
      updated_at: new Date().toISOString(),
      stale: true,
      error: isCoinGeckoRateLimitError(e) ? "rate_limit" : String(e?.message || "provider_error"),
    };
  }
}

/**
 * Quotes batch (1 request Yahoo, N crypto en 1 request CoinGecko simple/price).
 * También cachea cada símbolo individual.
 */
export async function getQuotesBatch(symbols: string[]): Promise<Record<string, QuoteResult>> {
  const inputSyms = Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean)));
  const out: Record<string, QuoteResult> = {};

  if (!inputSyms.length) return out;

  // 1) traer catálogo (1 query)
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("asset_catalog").select("*").in("symbol", inputSyms);
  if (error) throw error;

  const catalogMap = new Map<string, AssetCatalogRow>();
  for (const r of (Array.isArray(data) ? (data as any[]) : []) as AssetCatalogRow[]) {
    catalogMap.set(normalizeSymbol(r.symbol), r);
  }

  // 2) separar crypto vs stock
  const crypto: { symbol: string; coinId: string }[] = [];
  const stocksYahooSyms: string[] = [];
  const stockReverse = new Map<string, string>(); // yahooSym -> original sym

  for (const sym of inputSyms) {
    const cat = catalogMap.get(sym);
    if (cat?.asset_type === "crypto" && cat.coingecko_id) {
      crypto.push({ symbol: sym, coinId: cat.coingecko_id });
    } else {
      const yahooSym = cat?.yahoo_symbol ? normalizeSymbol(cat.yahoo_symbol) : sym;
      stocksYahooSyms.push(yahooSym);
      stockReverse.set(yahooSym, sym);
    }
  }

  // 3) crypto en 1 request (simple price)
  if (crypto.length) {
    const { coingeckoSimplePrice } = await import("./providers/coingecko");
    let prices: Record<string, number | null> = {};
    try {
      prices = await coingeckoSimplePrice(crypto.map((c) => c.coinId));
    } catch (e: any) {
      // si rate-limit, no rompemos todo; devolvemos null o cache stale por símbolo.
      prices = {};
    }

    for (const c of crypto) {
      const cacheKey = `quote:${c.symbol}`;
      const price = prices?.[c.coinId] ?? null;

      // cacheamos si tenemos price, si no intentamos fallback
      if (typeof price === "number") {
        await cacheSet(cacheKey, { price }, ttlSecondsForQuote() * 1000, "coingecko");
        out[c.symbol] = {
          symbol: c.symbol,
          price,
          currency: "USD",
          source: "coingecko",
          cached: false,
          updated_at: new Date().toISOString(),
        };
      } else {
        const cached = await cacheGet<{ price: number | null }>(cacheKey);
        out[c.symbol] = {
          symbol: c.symbol,
          price: cached.found ? (typeof cached.value?.price === "number" ? cached.value.price : null) : null,
          currency: "USD",
          source: cached.found ? cached.source : "coingecko",
          cached: cached.found,
          updated_at: cached.found ? cached.updated_at : new Date().toISOString(),
          stale: cached.found ? true : true,
          error: "rate_limit",
        };
      }
    }
  }

  // 4) stocks en 1 request Yahoo
  if (stocksYahooSyms.length) {
    const prices = await yahooQuotesBatch(stocksYahooSyms);

    for (const yahooSym of stocksYahooSyms) {
      const sym = stockReverse.get(yahooSym) ?? yahooSym;
      const cacheKey = `quote:${sym}`;

      const price = prices?.[yahooSym] ?? null;

      await cacheSet(cacheKey, { price }, ttlSecondsForQuote() * 1000, "yahoo");

      out[sym] = {
        symbol: sym,
        price,
        currency: "USD",
        source: "yahoo",
        cached: false,
        updated_at: new Date().toISOString(),
      };
    }
  }

  // asegurar que todo símbolo pedido tenga salida
  for (const sym of inputSyms) {
    if (!out[sym]) {
      out[sym] = {
        symbol: sym,
        price: null,
        currency: "USD",
        source: "yahoo",
        cached: false,
        updated_at: new Date().toISOString(),
        stale: true,
        error: "missing",
      };
    }
  }

  return out;
}

/**
 * History con cache + stale fallback
 */
export async function getHistory(symbol: string, range: RangeKey): Promise<HistoryResult> {
  const sym = normalizeSymbol(symbol);
  const cacheKey = `history:${sym}:${range}`;

  const cached = await cacheGet<{ points: { date: string; price: number }[] }>(cacheKey);
  if (cached.found && cached.fresh) {
    return {
      symbol: sym,
      range,
      points: Array.isArray(cached.value?.points) ? cached.value.points : [],
      source: cached.source,
      cached: true,
      updated_at: cached.updated_at,
    };
  }

  const cat = await getAssetCatalogRow(sym);
  const isCrypto = cat?.asset_type === "crypto";
  const provider = isCrypto ? CoinGeckoProvider : YahooProvider;

  try {
    const points = await provider.history({
      symbol: cat?.yahoo_symbol ? normalizeSymbol(cat.yahoo_symbol) : sym,
      coinId: cat?.coingecko_id ?? null,
      range,
    });

    await cacheSet(cacheKey, { points }, ttlSecondsForHistory(range) * 1000, provider.name);

    return {
      symbol: sym,
      range,
      points,
      source: provider.name,
      cached: false,
      updated_at: new Date().toISOString(),
    };
  } catch (e: any) {
    if (cached.found) {
      return {
        symbol: sym,
        range,
        points: Array.isArray(cached.value?.points) ? cached.value.points : [],
        source: cached.source,
        cached: true,
        updated_at: cached.updated_at,
        stale: true,
        error: isCoinGeckoRateLimitError(e) ? "rate_limit" : "provider_error",
      };
    }

    return {
      symbol: sym,
      range,
      points: [],
      source: provider.name,
      cached: false,
      updated_at: new Date().toISOString(),
      stale: true,
      error: isCoinGeckoRateLimitError(e) ? "rate_limit" : String(e?.message || "provider_error"),
    };
  }
}
