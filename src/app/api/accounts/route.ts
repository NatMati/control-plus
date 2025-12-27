// src/app/api/accounts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = new Set(["CHECKING", "SAVINGS", "INVESTMENT"]);
const ALLOWED_TYPES = new Set(["BANK", "CASH", "WALLET", "BROKER", "OTHER"]);
const ALLOWED_CURRENCIES = new Set(["UYU", "USD"]);

// Normaliza el efecto en balance por movimiento
function movementSignedAmount(m: { type: string; amount: any }) {
  const raw = Number(m.amount ?? 0);
  if (!Number.isFinite(raw)) return 0;

  const t = String(m.type ?? "").toUpperCase();

  // INCOME: +abs
  if (t === "INCOME") return Math.abs(raw);

  // EXPENSE: -abs (porque a veces guardás gastos en positivo)
  if (t === "EXPENSE") return -Math.abs(raw);

  // TRANSFER: respetar el signo guardado (tu sistema guarda - y +)
  if (t === "TRANSFER") return raw;

  // fallback: respetar raw
  return raw;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") || "stored").toLowerCase();
  // mode:
  // - "stored" (default): devuelve accounts.balance guardado (lo que cargaste manualmente)
  // - "computed": calcula balance desde movements (incluye transferencias bien)

  // 1) Traer cuentas
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id, name, currency, type, role, balance, balance_updated_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (accountsError) {
    console.error("GET /api/accounts → error cuentas:", accountsError);
    return NextResponse.json({ error: accountsError.message }, { status: 400 });
  }

  // Modo normal: lo que usa la pantalla de Cuentas
  if (mode !== "computed") {
    return NextResponse.json({ accounts: accounts ?? [] }, { status: 200 });
  }

  // 2) (Opcional) Traer movimientos para calcular balances
  const { data: movements, error: movError } = await supabase
    .from("movements")
    .select("account_id, type, amount")
    .eq("user_id", user.id);

  if (movError) {
    console.error("GET /api/accounts → error movimientos:", movError);
    return NextResponse.json({ error: movError.message }, { status: 400 });
  }

  // 3) Calcular balance por cuenta (incluye transfer)
  const balances = new Map<string, number>();

  (movements ?? []).forEach((m: any) => {
    if (!m.account_id) return;
    const prev = balances.get(m.account_id) ?? 0;
    balances.set(m.account_id, prev + movementSignedAmount(m));
  });

  // 4) Combinar cuentas + balances calculados
  const accountsWithComputedBalance = (accounts ?? []).map((acc: any) => ({
    ...acc,
    computed_balance: balances.get(acc.id) ?? 0,
  }));

  return NextResponse.json(
    { accounts: accountsWithComputedBalance },
    { status: 200 }
  );
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

  const body = await req.json().catch(() => null);

  const name = String(body?.name ?? "").trim();
  const currency = String(body?.currency ?? "UYU").toUpperCase();
  const type = String(body?.type ?? "BANK").toUpperCase();
  const role = String(body?.role ?? "CHECKING").toUpperCase();
  const balance = Number(body?.balance ?? 0);

  if (!name) {
    return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  }
  if (!ALLOWED_CURRENCIES.has(currency)) {
    return NextResponse.json({ error: "Moneda inválida" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }
  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }
  if (!Number.isFinite(balance)) {
    return NextResponse.json({ error: "Saldo inválido" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,
      name,
      currency,
      type,
      role,
      balance,
      balance_updated_at: new Date().toISOString(),
    })
    .select("id, name, currency, type, role, balance, balance_updated_at, created_at")
    .single();

  if (error) {
    console.error("POST /api/accounts error:", error);
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

  return NextResponse.json({ account: data }, { status: 201 });
}
