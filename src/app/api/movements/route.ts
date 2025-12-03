// src/app/api/movements/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/movements
 * Devuelve todos los movimientos del usuario autenticado.
 */
export async function GET() {
  const supabase = await createClient();

  // 1) Usuario actual
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("GET /movements → no hay usuario autenticado", userError);
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  // 2) Traer movimientos del usuario
  const { data, error } = await supabase
    .from("movements")
    .select(
      "id, date, account_id, type, category, amount, currency, description, created_at"
    )
    .eq("user_id", user.id) // redundante con RLS, pero explícito
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GET /movements → error en Supabase:", error);
    return NextResponse.json(
      {
        error: "Error al obtener movimientos",
        details: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { movements: data ?? [] },
    { status: 200 }
  );
}

/**
 * POST /api/movements
 * Crea un nuevo movimiento para el usuario autenticado.
 */
export async function POST(req: Request) {
  const supabase = await createClient();

  // 1) Usuario actual
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("POST /movements → no hay usuario autenticado", userError);
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();

    const {
      date,
      type, // "INGRESO" | "GASTO" desde el front
      category,
      amount,
      currency,
      accountId, // por ahora no lo usamos en BD
      description,
    } = body;

    // Validación mínima
    const amountNumber = Number(amount);
    if (!date || !type || !currency || Number.isNaN(amountNumber)) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }

    // 2) Mapear tipo del front → BD
    const dbType =
      type === "INGRESO"
        ? "INCOME"
        : type === "GASTO"
        ? "EXPENSE"
        : type; // fallback por si acaso

    // 3) Insert en movements
    const { data, error } = await supabase
      .from("movements")
      .insert({
        user_id: user.id, // 🔴 clave
        date,
        type: dbType, // "INCOME" | "EXPENSE"
        category: category || null,
        amount: amountNumber,
        currency,
        // por ahora dejamos la FK sin usar para no romper nada
        account_id: null, // más adelante podemos usar accountId
        description: description || null,
      })
      .select()
      .single();

    if (error) {
      console.error("POST /movements → Supabase insert error:", error);
      return NextResponse.json(
        {
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { ok: true, movement: data },
      { status: 201 }
    );
  } catch (e: any) {
    console.error("POST /movements → error interno:", e);
    return NextResponse.json(
      {
        error: "Error interno al crear movimiento",
        details: e?.message,
      },
      { status: 500 }
    );
  }
}
