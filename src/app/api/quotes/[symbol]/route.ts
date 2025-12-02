import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CACHE_MINUTES = 10;

/* ====== MAPA DE CRYPTOS (Coingecko) ====== */
const COINGECKO_IDS: Record<string, string> = {
  "BTC-USD": "bitcoin",
  "ETH-USD": "ethereum",
  "ADA-USD": "cardano",
  "XRP-USD": "ripple",
};

/* ====== FETCH CRYPTO ====== */
async function fetchCryptoPrice(symbol: string): Promise<number> {
  const id = COINGECKO_IDS[symbol];
  if (!id) {
    throw new Error(`Crypto no soportada: ${symbol}`);
  }

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Error Coingecko (${res.status})`);
  }

  const data = await res.json();
  const price = data?.[id]?.usd;

  if (typeof price !== "number") {
    throw new Error(`Respuesta inválida de Coingecko para ${symbol}`);
  }

  return price;
}

/* ====== FETCH STOCK/ETF (Yahoo V8) ====== */
async function fetchStockEtfPrice(symbol: string): Promise<number> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d`;

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

  const price = result?.meta?.regularMarketPrice;
  if (typeof price !== "number") {
    throw new Error(`Respuesta inválida de Yahoo para ${symbol}`);
  }

  return price;
}

/* ====== HANDLER GET ====== */
export async function GET(req: Request, context: any) {
  try {
    // ⬇️ AQUÍ ESTÁ LA CLAVE: params es una Promise
    const { symbol: rawSymbol } = await context.params;

    if (!rawSymbol) {
      return NextResponse.json(
        { error: "Missing symbol param" },
        { status: 400 }
      );
    }

    const symbol = String(rawSymbol).toUpperCase();
    const supabase = await createApiClient();

    // 1) Leer cache
    const { data: cached, error: cacheError } = await supabase
      .from("price_cache")
      .select("*")
      .eq("symbol", symbol)
      .single();

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
    if (symbol.endsWith("-USD")) {
      price = await fetchCryptoPrice(symbol);
    } else {
      price = await fetchStockEtfPrice(symbol);
    }

    // 3) Actualizar cache (no rompemos si falla)
    const { error: upsertError } = await supabase.from("price_cache").upsert({
      symbol,
      price,
      updated_at: new Date().toISOString(),
    });

    if (upsertError) {
      console.error("[quotes] Error actualizando cache:", upsertError);
    }

    // 4) Respuesta final
    return NextResponse.json({
      symbol,
      price,
      cached: false,
      updated_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[quotes] Error en handler:", err);
    return NextResponse.json(
      {
        error:
          err?.message ??
          "Error desconocido en /api/quotes/[symbol]. Revisa la consola.",
      },
      { status: 500 }
    );
  }
}
