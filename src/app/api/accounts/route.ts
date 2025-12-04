// src/app/api/accounts/route.ts
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

  // 1) Traer cuentas
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id, name, currency")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (accountsError) {
    console.error("GET /api/accounts → error cuentas:", accountsError);
    return NextResponse.json(
      { error: accountsError.message },
      { status: 400 }
    );
  }

  // 2) Traer movimientos (para calcular balances)
  const { data: movements, error: movError } = await supabase
    .from("movements")
    .select("account_id, type, amount")
    .eq("user_id", user.id);

  if (movError) {
    console.error("GET /api/accounts → error movimientos:", movError);
    return NextResponse.json(
      { error: movError.message },
      { status: 400 }
    );
  }

  // 3) Calcular balance por cuenta
  const balances = new Map<string, number>();

  (movements ?? []).forEach((m) => {
    if (!m.account_id) return;

    const rawAmount = Number(m.amount ?? 0);
    if (Number.isNaN(rawAmount)) return;

    const sign =
      m.type === "INCOME" ? 1 : m.type === "EXPENSE" ? -1 : 0;

    const prev = balances.get(m.account_id) ?? 0;
    balances.set(m.account_id, prev + sign * rawAmount);
  });

  // 4) Combinar cuentas + balances
  const accountsWithBalance = (accounts ?? []).map((acc) => ({
    ...acc,
    balance: balances.get(acc.id) ?? 0,
  }));

  return NextResponse.json({ accounts: accountsWithBalance }, { status: 200 });
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

  // Tipo por defecto para nuevas cuentas
  const accountType = "BANK"; // cambialo si en tu schema usás otro valor

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,
      name,
      currency,
      type: accountType,
    })
    .select("id, name, currency")
    .single();

  if (error) {
    console.error("POST /api/accounts error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ account: data }, { status: 201 });
}
