// src/app/api/crypto-search/route.ts
import { NextResponse } from "next/server";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json(
      { error: "Missing search query" },
      { status: 400 }
    );
  }

  try {
    const url = `${COINGECKO_BASE}/search?query=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      // Evita cachear resultados viejos
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    });

    if (!res.ok) {
      console.error("[crypto-search] Bad response", res.status);
      return NextResponse.json(
        { error: "Upstream error" },
        { status: 502 }
      );
    }

    const json = (await res.json()) as {
      coins?: Array<{
        id: string;
        symbol: string;
        name: string;
        market_cap_rank: number | null;
      }>;
    };

    const coins = json.coins ?? [];

    const results = coins.slice(0, 15).map((c) => ({
      source: "crypto" as const,
      id: c.id,
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      rank: c.market_cap_rank ?? null,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[crypto-search] Error", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
