import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Mapa crypto -> Coingecko id
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  ADA: "cardano",
  XRP: "ripple",
};

// Helpers
function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function utcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Fin de mes (UTC)
function endOfMonthUTC(year: number, month0: number) {
  // month0: 0-11
  return new Date(Date.UTC(year, month0 + 1, 0, 0, 0, 0));
}

// ✅ Puntos: fines de mes SOLO hasta el último mes cerrado + HOY (UTC day)
function monthEndsPlusToday(start: Date, end: Date) {
  const points: Date[] = [];

  const startDay = utcDay(start);
  const endDay = utcDay(end);

  // ultimo fin de mes "válido" es el del mes anterior si todavía no terminó el mes actual
  const yEnd = endDay.getUTCFullYear();
  const mEnd = endDay.getUTCMonth();
  const endOfCurrentMonth = endOfMonthUTC(yEnd, mEnd);

  // si hoy todavía no es fin de mes, el último mes cerrado es el mes anterior
  const lastClosedMonth =
    endDay.getTime() < endOfCurrentMonth.getTime()
      ? new Date(Date.UTC(yEnd, mEnd - 1, 1))
      : new Date(Date.UTC(yEnd, mEnd, 1));

  const y0 = startDay.getUTCFullYear();
  const m0 = startDay.getUTCMonth();

  let y = y0;
  let m = m0;

  // agregamos fines de mes desde el mes inicial hasta el último mes cerrado
  while (
    y < lastClosedMonth.getUTCFullYear() ||
    (y === lastClosedMonth.getUTCFullYear() && m <= lastClosedMonth.getUTCMonth())
  ) {
    points.push(endOfMonthUTC(y, m));
    m += 1;
    if (m >= 12) {
      m = 0;
      y += 1;
    }
  }

  // ✅ punto final = HOY
  points.push(endDay);

  // eliminar duplicados (si justo hoy es fin de mes)
  const uniq: Date[] = [];
  const seen = new Set<string>();
  for (const d of points) {
    const k = isoDate(d);
    if (!seen.has(k)) {
      uniq.push(d);
      seen.add(k);
    }
  }
  return uniq;
}

// Detecta si es crypto (en tu app estás usando símbolos tipo "ADA" o "XRP")
function isCryptoSymbol(symbol: string) {
  return Boolean(COINGECKO_IDS[symbol]);
}

/* ===========================
   HISTÓRICOS (daily closes)
=========================== */

// Yahoo: retorna mapa date(YYYY-MM-DD) -> close
async function fetchYahooDailyCloses(
  symbol: string,
  start: Date,
  end: Date
): Promise<Record<string, number>> {
  const period1 = Math.floor(start.getTime() / 1000);
  const period2 = Math.floor(end.getTime() / 1000);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=1d&period1=${period1}&period2=${period2}`;

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
    },
  });

  if (!res.ok) throw new Error(`Yahoo fallo (${res.status}) para ${symbol}`);

  const json = await res.json();
  const result = json?.chart?.result?.[0];

  const timestamps: number[] = result?.timestamp ?? [];
  const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];

  const map: Record<string, number> = {};
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const c = closes[i];
    if (typeof c !== "number") continue;

    const d = new Date(ts * 1000);
    const key = isoDate(
      new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    );
    map[key] = c;
  }

  return map;
}

// Coingecko range: retorna mapa date -> price (usd)
async function fetchCoingeckoDailyPrices(
  symbol: string,
  start: Date,
  end: Date
): Promise<Record<string, number>> {
  const id = COINGECKO_IDS[symbol];
  if (!id) throw new Error(`Crypto no soportada: ${symbol}`);

  const from = Math.floor(start.getTime() / 1000);
  const to = Math.floor(end.getTime() / 1000);

  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Coingecko fallo (${res.status}) para ${symbol}`);

  const json = await res.json();
  const prices: [number, number][] = json?.prices ?? [];

  const map: Record<string, number> = {};
  for (const [ms, price] of prices) {
    if (typeof price !== "number") continue;
    const d = new Date(ms);
    const key = isoDate(
      new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    );
    map[key] = price; // último del día
  }

  return map;
}

/* ===========================
   PRECIOS ACTUALES (Opción A)
=========================== */

async function fetchCryptoCurrent(symbol: string): Promise<number | null> {
  const id = COINGECKO_IDS[symbol];
  if (!id) return null;

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
    id
  )}&vs_currencies=usd`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const data = await res.json();
  const price = data?.[id]?.usd;
  return typeof price === "number" && Number.isFinite(price) ? price : null;
}

async function fetchYahooCurrent(symbol: string): Promise<number | null> {
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

  if (!res.ok) return null;

  const json = await res.json();
  const result = json?.chart?.result?.[0];

  const metaPrice = result?.meta?.regularMarketPrice;
  if (typeof metaPrice === "number" && Number.isFinite(metaPrice)) return metaPrice;

  const closes: unknown = result?.indicators?.quote?.[0]?.close;
  if (Array.isArray(closes)) {
    const last = [...closes].reverse().find((x) => typeof x === "number");
    if (typeof last === "number" && Number.isFinite(last)) return last;
  }

  return null;
}

type TradeRow = {
  date: string; // YYYY-MM-DD (date)
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  total_usd: number;
  fee_usd: number | null;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: u } = await supabase.auth.getUser();
    const user = u.user;

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("investment_trades")
      .select("date, symbol, side, quantity, total_usd, fee_usd")
      .eq("user_id", user.id)
      .order("date", { ascending: true });

    if (error) {
      console.error("[investments/history] DB error:", error);
      return NextResponse.json(
        { error: "Error al leer inversiones." },
        { status: 500 }
      );
    }

    const trades = (data ?? []) as TradeRow[];
    if (trades.length === 0) return NextResponse.json({ points: [] });

    const start = new Date(trades[0].date + "T00:00:00Z");
    const end = new Date(); // hoy
    const endDay = utcDay(end);

    // ✅ Puntos: mes cerrado + HOY
    const pointsDates = monthEndsPlusToday(start, end);

    // Símbolos únicos
    const symbols = Array.from(
      new Set(
        trades
          .map((t) => String(t.symbol || "").trim().toUpperCase())
          .filter(Boolean)
      )
    );

    // Históricos por símbolo hasta HOY (no fin de mes futuro)
    const priceHistory: Record<string, Record<string, number>> = {};
    await Promise.all(
      symbols.map(async (sym) => {
        try {
          if (isCryptoSymbol(sym)) {
            priceHistory[sym] = await fetchCoingeckoDailyPrices(sym, start, end);
          } else {
            priceHistory[sym] = await fetchYahooDailyCloses(sym, start, end);
          }
        } catch (e) {
          console.error("[investments/history] price fetch failed:", sym, e);
          priceHistory[sym] = {};
        }
      })
    );

    // ✅ Precios actuales para el punto final (Opción A)
    const currentPrices: Record<string, number | null> = {};
    await Promise.all(
      symbols.map(async (sym) => {
        try {
          currentPrices[sym] = isCryptoSymbol(sym)
            ? await fetchCryptoCurrent(sym)
            : await fetchYahooCurrent(sym);
        } catch {
          currentPrices[sym] = null;
        }
      })
    );

    // Simulación
    const holdings: Record<string, number> = {};
    for (const s of symbols) holdings[s] = 0;

    let netContrib = 0;
    let ti = 0;

    const out: { date: string; value: number; contributed: number; performance: number }[] =
      [];

    for (let idx = 0; idx < pointsDates.length; idx++) {
      const d = pointsDates[idx];
      const pointDay = isoDate(d);
      const isLast = isoDate(d) === isoDate(endDay);

      // Aplicar trades hasta esa fecha (inclusive)
      while (ti < trades.length) {
        const t = trades[ti];
        const td = String(t.date);
        if (td > pointDay) break;

        const sym = String(t.symbol || "").trim().toUpperCase();
        const qty = toNum(t.quantity);
        const total = toNum(t.total_usd);
        const fee = toNum(t.fee_usd);

        if (!sym || qty <= 0) {
          ti++;
          continue;
        }

        if (t.side === "BUY") {
          holdings[sym] = (holdings[sym] ?? 0) + qty;
          netContrib += total + fee;
        } else if (t.side === "SELL") {
          holdings[sym] = (holdings[sym] ?? 0) - qty;
          // ventas como “retiro neto”
          netContrib -= Math.max(0, total - fee);
        }

        ti++;
      }

      // Valuar portfolio
      let value = 0;

      for (const sym of symbols) {
        const q = toNum(holdings[sym]);
        if (q <= 0) continue;

        // ✅ Opción A: en el último punto usamos precio actual sí o sí
        if (isLast) {
          const pxNow = currentPrices[sym];
          if (typeof pxNow === "number") {
            value += q * pxNow;
          }
          continue;
        }

        // Históricos: si ese día no hay precio, buscamos hacia atrás (hasta 30 días)
        const hist = priceHistory[sym] ?? {};
        let px = hist[pointDay];

        if (typeof px !== "number") {
          let back = new Date(d);
          for (let k = 0; k < 30; k++) {
            back = new Date(
              Date.UTC(
                back.getUTCFullYear(),
                back.getUTCMonth(),
                back.getUTCDate() - 1
              )
            );
            const key = isoDate(back);
            const p2 = hist[key];
            if (typeof p2 === "number") {
              px = p2;
              break;
            }
          }
        }

        if (typeof px === "number") value += q * px;
      }

      const contributed = netContrib;
      const performance = value - contributed;

      out.push({
        date: pointDay,
        value: Number(value.toFixed(2)),
        contributed: Number(contributed.toFixed(2)),
        performance: Number(performance.toFixed(2)),
      });
    }

    return NextResponse.json({ points: out });
  } catch (e) {
    console.error("[investments/history] Unexpected error:", e);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}
