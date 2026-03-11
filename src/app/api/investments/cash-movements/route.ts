// src/app/api/investments/cash-movements/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/server";

const VALID_TYPES = ["deposit", "withdrawal", "dividend", "fee", "other"] as const;
type CashType = typeof VALID_TYPES[number];

// GET — liquidez por broker (usa la vista v_broker_liquidity)
export async function GET() {
  try {
    const supabase = await createApiClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data, error } = await supabase
      .from("v_broker_liquidity")
      .select("broker_account_id, broker_name, currency, liquidity_usd")
      .eq("user_id", user.id)
      .order("broker_name");

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ liquidity: data ?? [] });

  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error interno" }, { status: 500 });
  }
}

// POST — insertar uno o varios cash movements
export async function POST(req: NextRequest) {
  try {
    const supabase = await createApiClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await req.json();

    // Acepta un objeto solo o un array
    const items: unknown[] = Array.isArray(body) ? body : [body];

    const toInsert = [];
    const errors: string[] = [];

    for (const item of items) {
      const m = item as Record<string, unknown>;

      const broker_account_id = String(m.broker_account_id || "").trim();
      const date              = String(m.date              || "").trim();
      const rawType           = String(m.type              || "other").toLowerCase();
      const amount_usd        = Number(m.amount_usd);
      const note              = m.note ? String(m.note) : null;

      if (!broker_account_id) { errors.push("broker_account_id requerido");  continue; }
      if (!date)              { errors.push("date requerido");                continue; }
      if (!Number.isFinite(amount_usd) || amount_usd <= 0) { errors.push(`amount_usd inválido: ${amount_usd}`); continue; }

      const type: CashType = VALID_TYPES.includes(rawType as CashType)
        ? (rawType as CashType)
        : "other";

      toInsert.push({ user_id: user.id, broker_account_id, date, type, amount_usd, note });
    }

    if (!toInsert.length) {
      return NextResponse.json({ error: "Sin movimientos válidos.", details: errors }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("broker_cash_movements")
      .insert(toInsert)
      .select("id");

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, inserted: data?.length ?? 0, skipped: errors.length, errors });

  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error interno" }, { status: 500 });
  }
}
