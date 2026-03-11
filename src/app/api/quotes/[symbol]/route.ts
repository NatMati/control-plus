// src/app/api/quotes/[symbol]/route.ts
import { NextResponse } from "next/server";
import { getQuote } from "@/lib/market-data/service";

export const dynamic = "force-dynamic";

type Ctx = { params: { symbol: string } } | { params: Promise<{ symbol: string }> };

async function unwrapParams(ctx: Ctx) {
  return await Promise.resolve((ctx as any).params);
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { symbol } = await unwrapParams(ctx);
    const sym = decodeURIComponent(String(symbol || "")).trim();

    if (!sym) return NextResponse.json({ error: "Falta symbol" }, { status: 400 });

    const q = await getQuote(sym);
    return NextResponse.json(q, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error quote" }, { status: 500 });
  }
}
