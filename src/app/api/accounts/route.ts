import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, currency")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("GET /api/accounts error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ accounts: data }, { status: 200 });
}

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { name, currency } = await req.json();

  if (!name || !currency) {
    return NextResponse.json(
      { error: "Nombre y moneda son obligatorios" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,   // 👈 se asocia al usuario logueado
      name,
      currency,
    })
    .select("id, name, currency")
    .single();

  if (error) {
    console.error("POST /api/accounts error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ account: data }, { status: 201 });
}
