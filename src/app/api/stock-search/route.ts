// src/app/api/stock-search/route.ts
import { NextResponse } from "next/server";

const YAHOO_SEARCH_ENDPOINT =
  "https://query1.finance.yahoo.com/v1/finance/search";

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
    const url = `${YAHOO_SEARCH_ENDPOINT}?q=${encodeURIComponent(
      q
    )}&quotesCount=15&newsCount=0`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    });

    if (!res.ok) {
      console.error("[stock-search] Bad response", res.status);
      return NextResponse.json(
        { error: "Upstream error" },
        { status: 502 }
      );
    }

    const json = (await res.json()) as {
      quotes?: Array<{
        symbol?: string;
        shortname?: string;
        longname?: string;
        exchDisp?: string;
        quoteType?: string;
      }>;
    };

    const quotes = json.quotes ?? [];

    const results = quotes
      .filter((q) => q.symbol)
      .slice(0, 15)
      .map((q) => ({
        source: "stock" as const,
        symbol: q.symbol!,
        name: q.shortname || q.longname || q.symbol!,
        exchange: q.exchDisp || null,
        type: q.quoteType || null,
      }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[stock-search] Error", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
