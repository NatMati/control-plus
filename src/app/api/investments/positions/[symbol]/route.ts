import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: Request,
  { params }: { params: { symbol: string } }
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const symbol = String(params.symbol || "").trim().toUpperCase();
  if (!symbol) {
    return NextResponse.json({ error: "Símbolo inválido" }, { status: 400 });
  }

  // borra todas las operaciones de ese símbolo
  const { error } = await supabase
    .from("investment_trades")
    .delete()
    .eq("user_id", user.id)
    .eq("symbol", symbol);

  if (error) {
    return NextResponse.json(
      { error: "No se pudo eliminar el activo.", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
