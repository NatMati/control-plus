// src/app/api/quotes/history/[symbol]/route.ts
import { NextResponse } from "next/server";
import { getHistory } from "@/lib/market-data/service";
import type { RangeKey } from "@/lib/market-data/types";

export const dynamic = "force-dynamic";

type Ctx = { params: { symbol: string } } | { params: Promise<{ symbol: string }> };

async function unwrapParams(ctx: Ctx) {
  return await Promise.resolve((ctx as any).params);
}

function isRangeKey(v: string): v is RangeKey {
  return ["1S", "1M", "3M", "6M", "1A", "MAX"].includes(v);
}

export async function GET(req: Request, ctx: Ctx) {
  try {
    const { symbol } = await unwrapParams(ctx);
    const sym = decodeURIComponent(String(symbol || "")).trim();
    if (!sym) return NextResponse.json({ error: "Falta symbol" }, { status: 400 });

    const url = new URL(req.url);
    const raw = (url.searchParams.get("range") ?? "6M").toUpperCase();
    const range: RangeKey = isRangeKey(raw) ? raw : "6M";

    const h = await getHistory(sym, range);

    return NextResponse.json(h, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error histórico" }, { status: 500 });
  }
}
