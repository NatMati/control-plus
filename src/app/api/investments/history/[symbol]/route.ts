import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  ADA: "cardano",
  XRP: "ripple",
  SOL: "solana",
};

function normSymbol(raw: string) {
  let s = String(raw || "").trim().toUpperCase();
  if (!s) return "";
  if (s.includes(":")) s = s.split(":").pop() || s;
  if (s.includes("/")) s = s.split("/")[0] || s;
  if (s.endsWith("-USD")) s = s.slice(0, -4);
  if (s.endsWith("USDT")) s = s.slice(0, -4);
  if (s.endsWith("USD") && s.length > 3) s = s.slice(0, -3);
  return s.trim().toUpperCase();
}

function isoDateUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

function isCrypto(symbol: string) {
  return Boolean(COINGECKO_IDS[symbol]);
}

type RangeKey = "1S" | "1M" | "3M" | "6M" | "1A" | "MAX";

function mapRange(range: string | null) {
  const r = ((range || "6M").toUpperCase() as RangeKey) || "6M";

  if (r === "1S") return { days: 7, yahooRange: "7d", yahooInterval: "60m" };
  if (r === "1M") return { days: 30, yahooRange: "1mo", yahooInterval: "1d" };
  if (r === "3M") return { days: 90, yahooRange: "3mo", yahooInterval: "1d" };
  if (r === "6M") return { days: 180, yahooRange: "6mo", yahooInterval: "1d" };
  if (r === "1A") return { days: 365, yahooRange: "1y", yahooInterval: "1d" };
  return { days: 365 * 5, yahooRange: "5y", yahooInterval: "1wk" }; // MAX (5y)
}

async function fetchYahooSeries(symbol: string, range: string, interval: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
    },
  });

  if (!res.ok) throw new Error(`Yahoo fallo (${res.status})`);

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const ts: number[] = result?.timestamp ?? [];
  const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];

  // consolidar por día (último del día)
  const map = new Map<string, number>();
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (typeof c !== "number") continue;

    const d = new Date(ts[i] * 1000);
    const key = isoDateUTC(
      new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    );
    map.set(key, c);
  }

  return Array.from(map.entries())
    .map(([date, price]) => ({ date, price }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

async function fetchCoingeckoSeries(symbol: string, days: number) {
  const id = COINGECKO_IDS[symbol];
  if (!id) throw new Error("Crypto no soportada");

  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(
    id
  )}/market_chart?vs_currency=usd&days=${days}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Coingecko fallo (${res.status})`);

  const json = await res.json();
  const prices: [number, number][] = json?.prices ?? [];

  const map = new Map<string, number>();
  for (const [ms, price] of prices) {
    if (typeof price !== "number") continue;
    const d = new Date(ms);
    const key = isoDateUTC(
      new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    );
    map.set(key, price);
  }

  return Array.from(map.entries())
    .map(([date, price]) => ({ date, price }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export async function GET(req: Request, ctx: { params: Promise<{ symbol: string }> }) {
  try {
    const { symbol: raw } = await ctx.params; // ✅ evita error "params is a Promise"
    const symbol = normSymbol(raw || "");
    if (!symbol) {
      return NextResponse.json({ error: "Símbolo inválido" }, { status: 400 });
    }

    const url = new URL(req.url);
    const cfg = mapRange(url.searchParams.get("range"));

    const points = isCrypto(symbol)
      ? await fetchCoingeckoSeries(symbol, cfg.days)
      : await fetchYahooSeries(symbol, cfg.yahooRange, cfg.yahooInterval);

    return NextResponse.json({ symbol, points });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Error histórico" },
      { status: 500 }
    );
  }
}
