import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") || "").toUpperCase().trim();
  if (!symbol) return NextResponse.json({ error: "symbol requerido" }, { status: 400 });

  const { data, error } = await supabase
    .from("investment_operations") // <-- ajustá
    .select("id, symbol, date, side, quantity, price, fee")
    .eq("user_id", user.id)
    .eq("symbol", symbol)
    .order("date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ operations: data ?? [] });
}
