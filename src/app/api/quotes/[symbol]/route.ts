import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CACHE_MINUTES = 10;

/* ====== MAPA DE CRYPTOS (Coingecko) ======
   Soportamos "ADA" y "ADA-USD" (igual para XRP, BTC, ETH).
*/
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  "BTC-USD": "bitcoin",

  ETH: "ethereum",
  "ETH-USD": "ethereum",

  ADA: "cardano",
  "ADA-USD": "cardano",

  XRP: "ripple",
  "XRP-USD": "ripple",
};

function normalizeSymbol(raw: string): string {
  return decodeURIComponent(raw || "").trim().toUpperCase();
}

function isCryptoSymbol(symbol: string): boolean {
  return Boolean(COINGECKO_IDS[symbol]);
}

/* ====== FETCH CRYPTO ====== */
async function fetchCryptoPrice(symbol: string): Promise<number> {
  const id = COINGECKO_IDS[symbol];
  if (!id) throw new Error(`Crypto no soportada: ${symbol}`);

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
    id
  )}&vs_currencies=usd`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Error Coingecko (${res.status})`);

  const data = await res.json();
  const price = data?.[id]?.usd;

  if (typeof price !== "number" || !Number.isFinite(price)) {
    throw new Error(`Respuesta inválida de Coingecko para ${symbol}`);
  }

  return price;
}

/* ====== FETCH STOCK/ETF (Yahoo V8) ====== */
async function fetchStockEtfPrice(symbol: string): Promise<number> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=1d&interval=1d`;

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
    },
  });

  if (!res.ok) {
    throw new Error(`Fallo Yahoo Finance (${res.status}) para ${symbol}`);
  }

  const json = await res.json();
  const result = json?.chart?.result?.[0];

  const metaPrice = result?.meta?.regularMarketPrice;
  if (typeof metaPrice === "number" && Number.isFinite(metaPrice)) {
    return metaPrice;
  }

  // fallback por si meta no viene
  const closes: unknown = result?.indicators?.quote?.[0]?.close;
  if (Array.isArray(closes)) {
    const last = [...closes].reverse().find((x) => typeof x === "number");
    if (typeof last === "number" && Number.isFinite(last)) return last;
  }

  throw new Error(`Respuesta inválida de Yahoo para ${symbol}`);
}

/* ====== HANDLER GET ====== */
export async function GET(
  _req: Request,
  context: { params: { symbol: string } | Promise<{ symbol: string }> }
) {
  try {
    // ✅ Next (según versión/config) puede entregar params como Promise
    const params = await Promise.resolve(context.params);
    const rawSymbol = params?.symbol;

    if (!rawSymbol) {
      return NextResponse.json({ error: "Missing symbol param" }, { status: 400 });
    }

    const symbol = normalizeSymbol(String(rawSymbol));
    const supabase = await createApiClient();

    // 1) Leer cache
    const { data: cached, error: cacheError } = await supabase
      .from("price_cache")
      .select("*")
      .eq("symbol", symbol)
      .single();

    // PGRST116 = no rows
    if (cacheError && (cacheError as any).code !== "PGRST116") {
      console.error("[quotes] Error leyendo cache:", cacheError);
    }

    if (cached) {
      const diffMin =
        (Date.now() - new Date(cached.updated_at).getTime()) / 1000 / 60;

      if (diffMin < CACHE_MINUTES) {
        return NextResponse.json({
          symbol,
          price: Number(cached.price),
          cached: true,
          updated_at: cached.updated_at,
        });
      }
    }

    // 2) Fetch real
    let price: number;

    if (isCryptoSymbol(symbol)) {
      price = await fetchCryptoPrice(symbol);
    } else {
      price = await fetchStockEtfPrice(symbol);
    }

    // 3) Actualizar cache (sin romper si falla)
    const { error: upsertError } = await supabase.from("price_cache").upsert({
      symbol,
      price,
      updated_at: new Date().toISOString(),
    });

    if (upsertError) {
      console.error("[quotes] Error actualizando cache:", upsertError);
    }

    return NextResponse.json({
      symbol,
      price,
      cached: false,
      updated_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[quotes] Error en handler:", err);

    // ✅ no tires 500: devolvemos price null para que la UI no se caiga
    return NextResponse.json(
      {
        price: null,
        cached: false,
        error:
          err?.message ??
          "Error desconocido en /api/quotes/[symbol]. Revisa la consola.",
      },
      { status: 200 }
    );
  }
}
