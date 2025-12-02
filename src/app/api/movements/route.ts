// src/app/api/movements/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  // 1) Usuario actual
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("No hay usuario autenticado", userError);
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();

    const {
      date,
      type,        // "INGRESO" | "GASTO"
      category,
      amount,
      currency,
      accountId,   // de momento lo ignoramos en BD
      description,
    } = body;

    // 2) Mapear tipo del front → BD
    const dbType =
      type === "INGRESO" ? "INCOME" :
      type === "GASTO"   ? "EXPENSE" :
      type; // fallback por si acaso

    // 3) Insert en movements
    const { data, error } = await supabase
      .from("movements")
      .insert({
        user_id: user.id,              // 🔴 clave
        date,
        type: dbType,                  // "INCOME" | "EXPENSE"
        category: category || null,
        amount,
        currency,
        // por ahora dejamos la FK sin usar para no romper nada:
        account_id: null,
        description: description || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
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

    return NextResponse.json({ ok: true, movement: data }, { status: 201 });
  } catch (e: any) {
    console.error("Error interno al crear movimiento:", e);
    return NextResponse.json(
      {
        error: "Error interno al crear movimiento",
        details: e?.message,
      },
      { status: 500 }
    );
  }
}
