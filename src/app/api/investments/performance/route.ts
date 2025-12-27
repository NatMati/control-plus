// src/app/api/investments/performance/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type TradeRow = {
  date: string; // YYYY-MM-DD en Supabase
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  total_usd: number;
  fee_usd: number | null;
};

const COINGECKO_IDS: Record<string, string> = {
  "BTC-USD": "bitcoin",
  "ETH-USD": "ethereum",
  "ADA-USD": "cardano",
  "XRP-USD": "ripple",
};

function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isCryptoSymbol(symbol: string) {
  return symbol.toUpperCase().endsWith("-USD");
}

function ymToStartDate(ym: string): Date {
  // ym: "2025-07"
  const [y, m] = ym.split("-").map((x) => Number(x));
  return new Date(Date.UTC(y, (m ?? 1) - 1, 1, 0, 0, 0));
}

function ymToEndDate(ym: string): Date {
  const [y, m] = ym.split("-").map((x) => Number(x));
  // último día del mes: día 0 del mes siguiente
  return new Date(Date.UTC(y, (m ?? 1), 0, 23, 59, 59));
}

function monthKeyUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function endOfMonthUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59));
}

function addMonthsUTC(d: Date, months: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1, 0, 0, 0));
}

/** Genera lista de meses [from..to] inclusive como Date fin de mes */
function buildMonthEnds(fromYM: string, toYM: string): Date[] {
  const start = ymToStartDate(fromYM);
  const end = ymToEndDate(toYM);

  const out: Date[] = [];
  let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1, 0, 0, 0));
  while (cur <= end) {
    out.push(endOfMonthUTC(cur));
    cur = addMonthsUTC(cur, 1);
  }
  return out;
}

/** === Fetch históricos Yahoo (1mo) === */
async function fetchYahooMonthlyCloses(symbol: string, from: Date, to: Date): Promise<Map<string, number>> {
  // Yahoo acepta range. Para simplificar usamos period1/period2
  const period1 = Math.floor(from.getTime() / 1000);
  const period2 = Math.floor(to.getTime() / 1000);

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=1mo&period1=${period1}&period2=${period2}&includePrePost=false&events=div%2Csplits`;

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
    },
  });

  if (!res.ok) throw new Error(`Yahoo (${res.status}) para ${symbol}`);

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp ?? [];
  const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close ?? [];

  const map = new Map<string, number>();
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const c = closes[i];
    if (typeof ts !== "number" || typeof c !== "number") continue;

    const d = new Date(ts * 1000);
    const key = monthKeyUTC(d);
    // nos quedamos con el último close del mes si vinieran varios (raro en 1mo, pero por seguridad)
    map.set(key, c);
  }
  return map;
}

/** === Fetch históricos Coingecko (range) === */
async function fetchCoingeckoMonthlyCloses(symbol: string, from: Date, to: Date): Promise<Map<string, number>> {
  const id = COINGECKO_IDS[symbol.toUpperCase()];
  if (!id) throw new Error(`Crypto no soportada: ${symbol}`);

  const fromSec = Math.floor(from.getTime() / 1000);
  const toSec = Math.floor(to.getTime() / 1000);

  const url =
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart/range` +
    `?vs_currency=usd&from=${fromSec}&to=${toSec}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Coingecko (${res.status}) para ${symbol}`);

  const json = await res.json();
  const prices: Array<[number, number]> = json?.prices ?? [];

  // Armamos el "close mensual" como el último precio observado dentro del mes
  const map = new Map<string, number>();
  for (const [ms, price] of prices) {
    if (typeof ms !== "number" || typeof price !== "number") continue;
    const d = new Date(ms);
    const key = monthKeyUTC(d);
    map.set(key, price);
  }
  return map;
}

/** === Modified Dietz mensual (aprox TWR por período) ===
 * r = (V1 - V0 - CF) / (V0 + sum(wi*CF_i))
 * wi = proporción del período restante (si el flujo entra a mitad de mes, pesa ~0.5)
 */
function modifiedDietz(
  V0: number,
  V1: number,
  cashflows: Array<{ amount: number; date: Date }>,
  periodStart: Date,
  periodEnd: Date
): number {
  const CF = cashflows.reduce((a, x) => a + x.amount, 0);

  const T = periodEnd.getTime() - periodStart.getTime();
  const denomWeighted =
    V0 +
    cashflows.reduce((a, x) => {
      const t = x.date.getTime() - periodStart.getTime();
      const w = T > 0 ? (T - t) / T : 0; // cuánto "tiempo queda"
      return a + w * x.amount;
    }, 0);

  if (!Number.isFinite(denomWeighted) || denomWeighted === 0) return 0;

  const r = (V1 - V0 - CF) / denomWeighted;
  return Number.isFinite(r) ? r : 0;
}

/** === XIRR (Newton) === */
function xirr(cashflows: Array<{ amount: number; date: Date }>, guess = 0.1): number | null {
  if (cashflows.length < 2) return null;

  // Debe haber al menos un negativo y un positivo
  const hasNeg = cashflows.some((c) => c.amount < 0);
  const hasPos = cashflows.some((c) => c.amount > 0);
  if (!hasNeg || !hasPos) return null;

  const t0 = cashflows[0].date.getTime();
  const years = (d: Date) => (d.getTime() - t0) / (365.0 * 24 * 3600 * 1000);

  const f = (rate: number) =>
    cashflows.reduce((sum, c) => sum + c.amount / Math.pow(1 + rate, years(c.date)), 0);

  const df = (rate: number) =>
    cashflows.reduce((sum, c) => {
      const y = years(c.date);
      return sum + (-y * c.amount) / Math.pow(1 + rate, y + 1);
    }, 0);

  let r = guess;
  for (let i = 0; i < 60; i++) {
    const fr = f(r);
    const dfr = df(r);
    if (!Number.isFinite(fr) || !Number.isFinite(dfr) || dfr === 0) return null;

    const next = r - fr / dfr;
    if (!Number.isFinite(next)) return null;

    if (Math.abs(next - r) < 1e-7) return next;
    r = next;

    // Evitar tasas absurdas que rompen (1+rate <= 0)
    if (r <= -0.999999) r = -0.999999;
  }
  return r;
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const url = new URL(req.url);
    const fromYM = url.searchParams.get("from") ?? "2025-07";
    const toYM = url.searchParams.get("to") ?? "2025-12";

    const monthEnds = buildMonthEnds(fromYM, toYM);
    if (!monthEnds.length) {
      return NextResponse.json({ portfolioHistory: [], stats: { twr_total: 0, xirr_annual: null } });
    }

    const rangeStart = ymToStartDate(fromYM);
    const rangeEnd = ymToEndDate(toYM);

    // 1) Trades (para holdings y cashflows)
    const { data, error } = await supabase
      .from("investment_trades")
      .select("date, symbol, side, quantity, total_usd, fee_usd")
      .eq("user_id", user.id)
      .gte("date", rangeStart.toISOString().slice(0, 10))
      .lte("date", rangeEnd.toISOString().slice(0, 10))
      .order("date", { ascending: true });

    if (error) {
      console.error("[investments/performance] DB error:", error);
      return NextResponse.json({ error: "Error al leer inversiones." }, { status: 500 });
    }

    const trades = (data ?? []) as TradeRow[];

    // Símbolos involucrados
    const symbols = Array.from(
      new Set(trades.map((t) => String(t.symbol || "").trim().toUpperCase()).filter(Boolean))
    );

    // 2) Precios históricos mensuales por símbolo (cierre mensual)
    const priceBySymbolMonth = new Map<string, Map<string, number>>();
    const fromForPrices = ymToStartDate(fromYM);
    const toForPrices = ymToEndDate(toYM);

    for (const sym of symbols) {
      try {
        const m = isCryptoSymbol(sym)
          ? await fetchCoingeckoMonthlyCloses(sym, fromForPrices, toForPrices)
          : await fetchYahooMonthlyCloses(sym, fromForPrices, toForPrices);
        priceBySymbolMonth.set(sym, m);
      } catch (e) {
        console.error("[investments/performance] price fetch failed for", sym, e);
        priceBySymbolMonth.set(sym, new Map());
      }
    }

    // 3) Recorremos meses, armamos holdings a fin de mes, valuamos, y calculamos Dietz mensual
    const holdings = new Map<string, number>(); // symbol -> qty
    const portfolioHistory: Array<{
      date: string; // YYYY-MM (fin de mes)
      total_value: number;
      net_flow: number;
      twr_month: number;
      twr_cum: number;
    }> = [];

    // Cashflows globales para XIRR (BUY negativo, SELL positivo), y terminal value al final
    const xirrFlows: Array<{ amount: number; date: Date }> = [];

    // Pre-cargamos holdings progresivamente por fecha.
    let tradeIdx = 0;

    // Valor inicial (inicio del primer mes) para Dietz: tomamos valor al cierre del mes anterior como V0.
    // Para el primer mes, V0 lo tomamos 0 y Dietz soporta flows.
    let prevMonthValue = 0;
    let twrCum = 1;

    for (let i = 0; i < monthEnds.length; i++) {
      const monthEnd = monthEnds[i];
      const monthStart = new Date(Date.UTC(monthEnd.getUTCFullYear(), monthEnd.getUTCMonth(), 1, 0, 0, 0));

      // Trades dentro del mes (para cashflows con pesos)
      const monthFlows: Array<{ amount: number; date: Date }> = [];

      while (tradeIdx < trades.length) {
        const t = trades[tradeIdx];
        const tDate = new Date(`${t.date}T00:00:00Z`);
        if (tDate > monthEnd) break;

        const sym = String(t.symbol || "").trim().toUpperCase();
        const qty = toNum(t.quantity);
        const fee = toNum(t.fee_usd);
        const total = toNum(t.total_usd);

        if (t.side === "BUY") {
          holdings.set(sym, (holdings.get(sym) ?? 0) + qty);

          const cf = -(total + fee);
          monthFlows.push({ amount: cf, date: tDate });
          xirrFlows.push({ amount: cf, date: tDate });
        } else if (t.side === "SELL") {
          holdings.set(sym, (holdings.get(sym) ?? 0) - qty);

          const cf = +(total - fee);
          monthFlows.push({ amount: cf, date: tDate });
          xirrFlows.push({ amount: cf, date: tDate });
        }

        tradeIdx++;
      }

      // Valuación a fin de mes con precios históricos
      let monthValue = 0;
      const mKey = monthKeyUTC(monthEnd);

      for (const [sym, qty] of holdings.entries()) {
        if (!Number.isFinite(qty) || qty <= 0) continue;
        const priceMap = priceBySymbolMonth.get(sym);
        const px = priceMap?.get(mKey);
        if (typeof px !== "number") continue; // si no hay precio, omitimos (mejor que inventar)
        monthValue += qty * px;
      }

      // Dietz mensual (aprox retorno del mes)
      const V0 = i === 0 ? 0 : prevMonthValue;
      const V1 = monthValue;
      const rMonth = modifiedDietz(V0, V1, monthFlows, monthStart, monthEnd);

      twrCum = twrCum * (1 + rMonth);

      portfolioHistory.push({
        date: mKey,
        total_value: Number(monthValue.toFixed(2)),
        net_flow: Number(monthFlows.reduce((a, x) => a + x.amount, 0).toFixed(2)),
        twr_month: Number(rMonth.toFixed(6)),
        twr_cum: Number((twrCum - 1).toFixed(6)), // acumulado (0.12 = +12%)
      });

      prevMonthValue = monthValue;
    }

    // 4) XIRR anualizada: agregamos terminal value al final del período
    const terminalDate = monthEnds[monthEnds.length - 1];
    const terminalValue = prevMonthValue;

    // Terminal como flujo positivo (liquidación virtual del portafolio)
    if (terminalValue > 0) {
      xirrFlows.push({ amount: terminalValue, date: terminalDate });
    }

    // Orden por fecha
    xirrFlows.sort((a, b) => a.date.getTime() - b.date.getTime());

    const irr = xirr(xirrFlows, 0.1); // anualizada
    const stats = {
      twr_total: Number((twrCum - 1).toFixed(6)),
      xirr_annual: irr === null ? null : Number(irr.toFixed(6)),
    };

    return NextResponse.json({ portfolioHistory, stats });
  } catch (e) {
    console.error("[investments/performance] Unexpected error:", e);
    return NextResponse.json({ error: "Error inesperado al calcular performance." }, { status: 500 });
  }
}
