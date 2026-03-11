// src/app/api/quotes/batch/route.ts
import { NextResponse } from "next/server";
import { getQuotesBatch } from "@/lib/market-data/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const symbolsRaw = url.searchParams.get("symbols") ?? "";
    const symbols = symbolsRaw
      .split(",")
      .map((s) => decodeURIComponent(s).trim())
      .filter(Boolean);

    if (!symbols.length) {
      return NextResponse.json({ error: "Faltan symbols" }, { status: 400 });
    }

    const out = await getQuotesBatch(symbols);
    return NextResponse.json(out, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error batch" }, { status: 500 });
  }
}
