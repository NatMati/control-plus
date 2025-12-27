// src/app/api/movements/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function normalizeCategory(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  return trimmed.length ? trimmed : null;
}

export async function GET() {
  const supabase = await createClient();

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

  return NextResponse.json({ movements: data ?? [] }, { status: 200 });
}

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("POST /api/movements → no hay usuario autenticado", userError);
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const {
      date,
      type, // "INGRESO" | "GASTO" | "TRANSFER" | "INCOME" | "EXPENSE"
      amount,
      currency,
      accountId,
      fromAccountId,
      toAccountId,
      description,
    } = body ?? {};

    // 👇 tolerancia a distintos nombres del front
    const category =
      normalizeCategory(body?.category) ??
      normalizeCategory(body?.categoria) ??
      normalizeCategory(body?.categoryName);

    const amountNumber = Number(amount);

    if (!date || !type || !currency || Number.isNaN(amountNumber)) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios (date, type, currency, amount)" },
        { status: 400 }
      );
    }

    // Caso 1: TRANSFER
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
            description: description || null,
          },
          {
            user_id: user.id,
            date,
            type: "TRANSFER",
            category: "TRANSFER_IN",
            amount: Math.abs(amountNumber),
            currency,
            account_id: toAccountId,
            description: description || null,
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

    // Caso 2: INCOME / EXPENSE
    if (!accountId) {
      return NextResponse.json(
        { error: "accountId es obligatorio para ingresos/gastos" },
        { status: 400 }
      );
    }

    // Normalizar type a DB
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
      category, // 👈 ya normalizada
      amount: amountNumber,
      currency,
      account_id: accountId,
      description: description || null,
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
