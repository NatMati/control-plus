// src/app/api/investments/trades/[symbol]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function normSymbol(raw: string) {
  let s = String(raw || "").trim().toUpperCase();
  if (!s) return "";
  if (s.includes(":")) s = s.split(":").pop() || s;
  return s;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ symbol: string }> } // ✅ Next 15: params es Promise
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 401 });
    }
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { symbol: rawSymbol } = await ctx.params;
    const symbol = normSymbol(decodeURIComponent(rawSymbol || ""));
    if (!symbol) {
      return NextResponse.json({ error: "Símbolo inválido" }, { status: 400 });
    }

    // ✅ Tabla correcta: investment_trades (NO investments_trades)
    const { data, error } = await supabase
      .from("investment_trades")
      .select(
        "id,date,symbol,side,quantity,price,total_usd,fee_usd,realized_pnl_usd,note,source,external_id,created_at"
      )
      .eq("user_id", user.id)
      .eq("symbol", symbol)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code, hint: error.hint ?? null },
        { status: 500 }
      );
    }

    return NextResponse.json({ symbol, trades: data ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Error inesperado." },
      { status: 500 }
    );
  }
}
