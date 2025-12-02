// src/app/api/crypto-quote/route.ts
import { NextResponse } from "next/server";

// Mapeamos los símbolos que usas en la app a los IDs de CoinGecko
const COINGECKO_IDS: Record<string, string> = {
  "BTC-USD": "bitcoin",
  "ETH-USD": "ethereum",
  // más adelante podés agregar otros:
  // "SOL-USD": "solana",
  // "ADA-USD": "cardano",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json(
      { error: "Missing symbol" },
      { status: 400 }
    );
  }

  const id = COINGECKO_IDS[symbol];
  if (!id) {
    return NextResponse.json(
      { error: `Unsupported crypto symbol: ${symbol}` },
      { status: 400 }
    );
  }

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
      id
    )}&vs_currencies=usd`;

    const res = await fetch(url, {
      cache: "no-store", // siempre fresco
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("CoinGecko error:", res.status, text);
      return NextResponse.json(
        { error: "Failed to fetch price from CoinGecko" },
        { status: 502 }
      );
    }

    const json = (await res.json()) as any;
    const price = json?.[id]?.usd;

    if (typeof price !== "number") {
      console.error("Unexpected CoinGecko response:", json);
      return NextResponse.json(
        { error: "Invalid data from CoinGecko" },
        { status: 500 }
      );
    }

    return NextResponse.json({ symbol, price });
  } catch (err) {
    console.error("Crypto quote error:", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
