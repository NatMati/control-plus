import { NextRequest, NextResponse } from "next/server";

// Mapeo simple de símbolos cripto → id de CoinGecko
function mapCryptoId(symbol: string): string | null {
  const s = symbol.toUpperCase();
  if (s === "BTC-USD" || s === "BTC") return "bitcoin";
  if (s === "ETH-USD" || s === "ETH") return "ethereum";
  if (s === "ADA-USD" || s === "ADA") return "cardano";
  if (s === "XRP-USD" || s === "XRP") return "ripple";
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json(
      { error: "Missing symbol" },
      { status: 400 }
    );
  }

  try {
    let price: number | null = null;

    // 👇 Si tiene "-USD" lo tratamos como cripto (BTC-USD, ETH-USD, etc.)
    const maybeCryptoId = mapCryptoId(symbol);
    if (maybeCryptoId) {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${maybeCryptoId}&vs_currencies=usd`;
      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) {
        throw new Error(`CoinGecko error: ${res.status}`);
      }

      const json = await res.json();
      price = json?.[maybeCryptoId]?.usd ?? null;
    } else {
      // 👇 Acciones / ETFs → Yahoo Finance (no oficial pero funciona)
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
        symbol
      )}`;
      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) {
        throw new Error(`Yahoo error: ${res.status}`);
      }

      const json = await res.json();
      const result = json?.quoteResponse?.result?.[0];
      price = result?.regularMarketPrice ?? null;
    }

    if (price == null) {
      return NextResponse.json(
        { error: "Price not found", symbol },
        { status: 404 }
      );
    }

    return NextResponse.json({ symbol, price });
  } catch (err) {
    console.error("Error fetching quote", err);
    return NextResponse.json(
      { error: "Failed to fetch quote", symbol },
      { status: 500 }
    );
  }
}
