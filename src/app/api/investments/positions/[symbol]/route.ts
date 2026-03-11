// src/app/api/investments/positions/[symbol]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: Request,
  { params }: { params: { symbol: string } }
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

    const symbol = decodeURIComponent(params.symbol || "").trim().toUpperCase();
    if (!symbol) {
      return NextResponse.json({ error: "Símbolo inválido." }, { status: 400 });
    }

    const { error } = await supabase
      .from("investment_trades")
      .delete()
      .eq("user_id", user.id)
      .eq("symbol", symbol);

    if (error) {
      console.error("[investments/positions] DB error:", error);
      return NextResponse.json({ error: "Error eliminando activo." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[investments/positions] Unexpected error:", e);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}
