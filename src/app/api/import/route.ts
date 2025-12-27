// src/app/api/movements/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

type CsvMovement = {
  date: string;
  amount: number;
  type: string;
  category?: string | null;
  description?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rows = body.rows as CsvMovement[];

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "No se recibieron filas para importar" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // TODO: cuando tengas auth real, tomar el user_id del JWT
    const userId = body.user_id ?? null;

    const payload = rows.map((r) => ({
      user_id: userId,
      date: r.date,
      amount: r.amount,
      type: r.type.toUpperCase(),
      category: r.category ?? null,
      description: r.description ?? null,
    }));

    const { error } = await supabase
      .from("movements")
      .insert(payload);

    if (error) {
      console.error("error importando movimientos:", error);
      return NextResponse.json(
        { error: "Error al insertar movimientos en Supabase" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true, inserted: payload.length },
      { status: 200 }
    );
  } catch (err) {
    console.error("import route error:", err);
    return NextResponse.json(
      { error: "Error inesperado al importar movimientos" },
      { status: 500 }
    );
  }
}
