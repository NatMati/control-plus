import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { error } = await supabase
      .from("investment_trades")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      console.error("[investments/clear] DB error:", error);
      return NextResponse.json(
        { error: "No se pudo limpiar inversiones." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[investments/clear] Unexpected error:", e);
    return NextResponse.json(
      { error: "Error inesperado al limpiar inversiones." },
      { status: 500 }
    );
  }
}
