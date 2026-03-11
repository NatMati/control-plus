import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function unwrapParams(ctx: any): Promise<{ id?: string }> {
  const p = ctx?.params;
  if (p && typeof p.then === "function") return await p;
  return p ?? {};
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeSide(v: unknown): "BUY" | "SELL" | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "BUY" || s === "COMPRA") return "BUY";
  if (s === "SELL" || s === "VENTA") return "SELL";
  return null;
}

function normalizeDate(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  // Esperamos YYYY-MM-DD (que es como lo guardás)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? s : null;
}

export async function PATCH(
  req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await unwrapParams(ctx as any);
    const tradeId = String(id ?? "").trim();
    if (!tradeId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    // Campos editables
    const patch: any = {};

    if (body.date !== undefined) {
      const d = normalizeDate(body.date);
      if (!d) return NextResponse.json({ error: "Fecha inválida (YYYY-MM-DD)" }, { status: 400 });
      patch.date = d;
    }

    if (body.side !== undefined) {
      const side = normalizeSide(body.side);
      if (!side) return NextResponse.json({ error: "Side inválido (BUY/SELL)" }, { status: 400 });
      patch.side = side;
    }

    if (body.quantity !== undefined) {
      const q = toNum(body.quantity);
      if (q === null || q <= 0) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
      patch.quantity = q;
    }

    if (body.price !== undefined) {
      const p = toNum(body.price);
      if (p === null || p <= 0) return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
      patch.price = p;
    }

    if (body.total_usd !== undefined) {
      const t = toNum(body.total_usd);
      if (t === null || t < 0) return NextResponse.json({ error: "Total USD inválido" }, { status: 400 });
      patch.total_usd = t;
    }

    if (body.fee_usd !== undefined) {
      const f = toNum(body.fee_usd);
      if (f === null || f < 0) return NextResponse.json({ error: "Fee USD inválido" }, { status: 400 });
      patch.fee_usd = f;
    }

    if (body.realized_pnl_usd !== undefined) {
      const r = toNum(body.realized_pnl_usd);
      if (r === null) return NextResponse.json({ error: "Realized PnL inválido" }, { status: 400 });
      patch.realized_pnl_usd = r;
    }

    if (body.note !== undefined) {
      patch.note = String(body.note ?? "").trim() || null;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No hay cambios para aplicar" }, { status: 400 });
    }

    // Seguridad: update solo si el trade pertenece al user
    const { data, error } = await supabase
      .from("investment_trades")
      .update(patch)
      .eq("id", tradeId)
      .eq("user_id", user.id)
      .select(
        "id, date, symbol, side, quantity, price, total_usd, fee_usd, realized_pnl_usd, note, external_id, source"
      )
      .single();

    if (error) {
      console.error("[investments/trades/by-id] DB error:", error);
      return NextResponse.json({ error: "Error al actualizar operación." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, trade: data });
  } catch (e) {
    console.error("[investments/trades/by-id] Unexpected error:", e);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}
