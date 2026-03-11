import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/server";
import { getUserPlan, movementsLimit, PLAN_UPGRADE_MSG } from "@/lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeCategory(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeText(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const t = input.trim();
  return t.length ? t : null;
}

export async function GET() {
  const supabase = await createApiClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("GET /api/movements → no hay usuario autenticado", userError);
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("movements")
    .select("id, date, account_id, type, category, amount, currency, description, created_at")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GET /api/movements → error en Supabase:", error);
    return NextResponse.json(
      { error: "Error al obtener movimientos", details: error.message },
      { status: 500 }
    );
  }

  const res = NextResponse.json({ movements: data ?? [] }, { status: 200 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function POST(req: Request) {
  const supabase = await createApiClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("POST /api/movements → no hay usuario autenticado", userError);
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // ── Plan guard — límite de movimientos FREE ───────────────────────────────
  const plan = await getUserPlan(supabase, user.id);
  const limit = movementsLimit(plan);
  if (limit !== null) {
    const now = new Date();
    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const { count } = await supabase
      .from("movements")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", firstOfMonth);

    if ((count ?? 0) >= limit) {
      return NextResponse.json(
        { error: PLAN_UPGRADE_MSG.movements, upgrade: true, requiredPlan: "PRO" },
        { status: 403 }
      );
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const body = await req.json();

    const date = body?.date;
    const type = body?.type;
    const amountNumber = Number(body?.amount);
    const currency = body?.currency;

    const accountId = body?.accountId ?? body?.account_id ?? null;

    const fromAccountId = body?.fromAccountId ?? null;
    const toAccountId = body?.toAccountId ?? null;

    const category =
      normalizeCategory(body?.category) ??
      normalizeCategory(body?.categoria) ??
      normalizeCategory(body?.categoryName);

    const description =
      normalizeText(body?.description) ??
      normalizeText(body?.note) ??
      normalizeText(body?.nota);

    if (!date || !type || !currency || Number.isNaN(amountNumber)) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios (date, type, currency, amount)" },
        { status: 400 }
      );
    }

    if (type === "TRANSFER") {
      if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
        return NextResponse.json(
          { error: "Transferencia inválida (fromAccountId/toAccountId requeridos y distintos)" },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("movements")
        .insert([
          {
            user_id: user.id,
            date,
            type: "TRANSFER",
            category: "TRANSFER_OUT",
            amount: -Math.abs(amountNumber),
            currency,
            account_id: fromAccountId,
            description,
          },
          {
            user_id: user.id,
            date,
            type: "TRANSFER",
            category: "TRANSFER_IN",
            amount: Math.abs(amountNumber),
            currency,
            account_id: toAccountId,
            description,
          },
        ])
        .select();

      if (error) {
        console.error("POST /api/movements (TRANSFER) → Supabase insert error:", error);
        return NextResponse.json(
          { error: error.message, details: error.details, hint: error.hint, code: error.code },
          { status: 400 }
        );
      }

      return NextResponse.json({ ok: true, movements: data }, { status: 201 });
    }

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId es obligatorio para ingresos/gastos" },
        { status: 400 }
      );
    }

    let dbType: "INCOME" | "EXPENSE";
    if (type === "INGRESO" || type === "INCOME") dbType = "INCOME";
    else if (type === "GASTO" || type === "EXPENSE") dbType = "EXPENSE";
    else {
      return NextResponse.json(
        { error: `type inválido para este endpoint: "${type}"` },
        { status: 400 }
      );
    }

    const payload = {
      user_id: user.id,
      date,
      type: dbType,
      category,
      amount: amountNumber,
      currency,
      account_id: accountId,
      description,
    };

    const { data, error } = await supabase
      .from("movements")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("POST /api/movements → Supabase insert error:", error, { payload });
      return NextResponse.json(
        { error: error.message, details: error.details, hint: error.hint, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, movement: data }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/movements → error interno:", e);
    return NextResponse.json(
      { error: "Error interno al crear movimiento", details: e?.message },
      { status: 500 }
    );
  }
}
