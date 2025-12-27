import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type TradeRow = {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  total_usd: number;
  fee_usd: number | null;
  realized_pnl_usd?: number | null;
  date?: string;
};

type PriceCacheRow = {
  symbol: string;
  price: number;
  updated_at: string;
};

const CACHE_MINUTES = 10;

/* ====== MAPA DE CRYPTOS (Coingecko) ====== */
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  "BTC-USD": "bitcoin",

  ETH: "ethereum",
  "ETH-USD": "ethereum",

  ADA: "cardano",
  "ADA-USD": "cardano",

  XRP: "ripple",
  "XRP-USD": "ripple",

  SOL: "solana",
  "SOL-USD": "solana",
};

const METALS = new Set(["IAU", "SLV", "GLD"]);
const ETFS = new Set([
  "VOO",
  "QQQ",
  "QQQM",
  "RSP",
  "VTI",
  "SPY",
  "IVV",
  "VT",
  "VEA",
  "VWO",
]);

function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeSymbol(raw: any): string {
  let s = String(raw ?? "").trim().toUpperCase();
  if (!s) return "";

  if (s.includes(":")) s = s.split(":").pop() || s;
  if (s.includes("/")) s = s.split("/")[0] || s;

  if (s.endsWith("USDT")) s = s.slice(0, -4);
  if (s.endsWith("USD") && s.length > 3) s = s.slice(0, -3);

  return s.trim().toUpperCase();
}

function getAssetType(symbol: string): "Acción" | "ETFs" | "Cripto" | "Metales" {
  if (COINGECKO_IDS[symbol] || COINGECKO_IDS[`${symbol}-USD`]) return "Cripto";
  if (METALS.has(symbol)) return "Metales";
  if (ETFS.has(symbol)) return "ETFs";
  return "Acción";
}

function isCrypto(symbol: string): boolean {
  return Boolean(COINGECKO_IDS[symbol] || COINGECKO_IDS[`${symbol}-USD`]);
}

/* ====== FETCH CRYPTO (Coingecko) ====== */
async function fetchCryptoPrice(symbol: string): Promise<number> {
  const id = COINGECKO_IDS[symbol] || COINGECKO_IDS[`${symbol}-USD`];
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

  const closes: unknown = result?.indicators?.quote?.[0]?.close;
  if (Array.isArray(closes)) {
    const last = [...closes].reverse().find((x) => typeof x === "number");
    if (typeof last === "number" && Number.isFinite(last)) return last;
  }

  throw new Error(`Respuesta inválida de Yahoo para ${symbol}`);
}

/* ====== PRICE (cache + fetch + upsert) ====== */
async function getPriceWithCache(
  supabase: any,
  symbol: string
): Promise<number | null> {
  const { data: cached, error: cacheError } = await supabase
    .from("price_cache")
    .select("symbol, price, updated_at")
    .eq("symbol", symbol)
    .single();

  if (cacheError && (cacheError as any).code !== "PGRST116") {
    console.error("[investments/snapshot] cache read error:", cacheError);
  }

  if (cached) {
    const row = cached as PriceCacheRow;
    const diffMin =
      (Date.now() - new Date(row.updated_at).getTime()) / 1000 / 60;

    if (diffMin < CACHE_MINUTES) {
      return Number(row.price);
    }
  }

  try {
    const price = isCrypto(symbol)
      ? await fetchCryptoPrice(symbol)
      : await fetchStockEtfPrice(symbol);

    const { error: upsertError } = await supabase.from("price_cache").upsert({
      symbol,
      price,
      updated_at: new Date().toISOString(),
    });

    if (upsertError) {
      console.error("[investments/snapshot] cache upsert error:", upsertError);
    }

    return price;
  } catch (e) {
    console.error("[investments/snapshot] price fetch error:", symbol, e);
    return null;
  }
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 👇 sumamos realized_pnl_usd y date (para debug/orden)
    const { data, error } = await supabase
      .from("investment_trades")
      .select("symbol, side, quantity, price, total_usd, fee_usd, realized_pnl_usd, date")
      .eq("user_id", user.id)
      .order("date", { ascending: true });

    if (error) {
      console.error("[investments/snapshot] DB error:", error);
      return NextResponse.json(
        { error: "Error al leer inversiones." },
        { status: 500 }
      );
    }

    const trades = (data ?? []) as TradeRow[];

    /**
     * Posición por símbolo con cost basis promedio
     * - qty: cantidad abierta
     * - avgCost: costo promedio unitario (incluye fees de compra prorrateados)
     * - invested: costo base de la posición abierta (qty * avgCost)
     * - realizedPnl: acumulado (opcional)
     */
    const stateBySymbol = new Map<
      string,
      {
        symbol: string;
        qty: number;
        avgCost: number;
        invested: number;
        realizedPnl: number;
      }
    >();

    for (const t of trades) {
      const symbol = normalizeSymbol(t.symbol);
      if (!symbol) continue;

      const side = String(t.side).toUpperCase() as "BUY" | "SELL";
      const qty = toNum(t.quantity);
      const total = toNum(t.total_usd); // en BUY: costo; en SELL: proceeds (según tu CSV)
      const fee = toNum(t.fee_usd);

      const st =
        stateBySymbol.get(symbol) ?? {
          symbol,
          qty: 0,
          avgCost: 0,
          invested: 0,
          realizedPnl: 0,
        };

      if (side === "BUY") {
        // costo real de la compra (incluye fee)
        const cost = total + fee;

        const newQty = st.qty + qty;

        // recalcular avg cost ponderado
        // st.invested ya es el costo base de lo que había
        const newInvested = st.invested + cost;

        st.qty = newQty;
        st.invested = newInvested;
        st.avgCost = newQty > 0 ? newInvested / newQty : 0;
      } else if (side === "SELL") {
        if (st.qty <= 0) {
          // venta sin posición abierta; lo ignoramos para no romper
          // (si querés, acá podés trackear "short" pero no aplica)
          continue;
        }

        const sellQty = Math.min(qty, st.qty);
        const costBasisRemoved = st.avgCost * sellQty;

        // proceeds netos (si fee viene separado, lo restamos)
        const proceedsNet = total - fee;

        // si CSV trae realized_pnl_usd, lo usamos (asumimos ya neto)
        const csvRealized = t.realized_pnl_usd;
        const realized =
          csvRealized !== undefined && csvRealized !== null && Number.isFinite(Number(csvRealized))
            ? Number(csvRealized)
            : proceedsNet - costBasisRemoved;

        st.realizedPnl += realized;

        // bajar posición abierta
        st.qty -= sellQty;
        st.invested -= costBasisRemoved;

        if (st.qty <= 1e-12) {
          st.qty = 0;
          st.avgCost = 0;
          st.invested = 0;
        } else {
          // avgCost se mantiene (promedio) para el remanente
          st.avgCost = st.invested / st.qty;
        }
      }

      stateBySymbol.set(symbol, st);
    }

    // Crear posiciones base (solo abiertas)
    const basePositions = Array.from(stateBySymbol.values())
      .map((st) => {
        if (st.qty <= 0) return null;

        const type = getAssetType(st.symbol);

        return {
          symbol: st.symbol,
          type,
          quantity: st.qty,
          buyPrice: st.avgCost,   // costo promedio unitario real
          invested: st.invested,  // costo base SOLO de lo abierto
          realizedPnl: st.realizedPnl, // opcional (por ahora no lo mostrás, pero sirve)
        };
      })
      .filter(Boolean) as Array<{
      symbol: string;
      type: "Acción" | "ETFs" | "Cripto" | "Metales";
      quantity: number;
      buyPrice: number;
      invested: number;
      realizedPnl: number;
    }>;

    // Precios actuales + métricas
    const positions = await Promise.all(
      basePositions.map(async (p) => {
        const currentPrice = await getPriceWithCache(supabase, p.symbol);

        const currentValue =
          currentPrice !== null ? p.quantity * currentPrice : null;

        const pnl =
          currentValue !== null ? currentValue - p.invested : null;

        const returnPct =
          pnl !== null && p.invested > 0 ? pnl / p.invested : null;

        return {
          ...p,
          currentPrice,
          currentValue,
          pnl,
          returnPct,
        };
      })
    );

    const totalInvested = positions.reduce((acc, p) => acc + toNum(p.invested), 0);
    const totalCurrent = positions.reduce(
      (acc, p) => acc + (p.currentValue === null ? 0 : toNum(p.currentValue)),
      0
    );

    const totalPnl = totalCurrent - totalInvested;
    const totalReturnPct = totalInvested > 0 ? totalPnl / totalInvested : 0;

    const allocationMap = new Map<string, number>();
    for (const p of positions) {
      const v = p.currentValue === null ? 0 : toNum(p.currentValue);
      allocationMap.set(p.type, (allocationMap.get(p.type) ?? 0) + v);
    }

    const allocation = Array.from(allocationMap.entries()).map(([type, value]) => ({
      type,
      value,
    }));

    return NextResponse.json({
      positions,
      stats: {
        totalCurrent,
        totalInvested,
        totalPnl,
        totalReturnPct,
      },
      allocation,
    });
  } catch (e) {
    console.error("[investments/snapshot] Unexpected error:", e);
    return NextResponse.json(
      { error: "Error inesperado al leer inversiones." },
      { status: 500 }
    );
  }
}
