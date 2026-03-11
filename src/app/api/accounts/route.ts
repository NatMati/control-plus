// src/app/api/accounts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ACCOUNT_TYPES = new Set(["BANK", "CASH", "WALLET", "BROKER"]);
const ACCOUNT_ROLES = new Set(["CHECKING", "SAVINGS", "INVESTMENT"]);

function toUpperStr(v: unknown) {
  return typeof v === "string" ? v.trim().toUpperCase() : "";
}

function parseNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createApiClient();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("accounts")
    .select(
      "id, name, currency, type, role, balance, balance_updated_at, created_at, is_archived"
    )
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const res = NextResponse.json({ accounts: data ?? [] }, { status: 200 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createApiClient();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  // name
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  }

  // type
  const type = toUpperStr(body.type) || "BANK";
  if (!ACCOUNT_TYPES.has(type)) {
    return NextResponse.json({ error: "Tipo inválido. Valores: BANK, CASH, WALLET, BROKER." }, { status: 400 });
  }

  // role
  const role = toUpperStr(body.role) || "CHECKING";
  if (!ACCOUNT_ROLES.has(role)) {
    return NextResponse.json({ error: "Rol inválido. Valores: CHECKING, SAVINGS, INVESTMENT." }, { status: 400 });
  }

  // currency
  const currency = toUpperStr(body.currency) || "UYU";
  if (!currency) {
    return NextResponse.json({ error: "Moneda inválida." }, { status: 400 });
  }

  // balance inicial (opcional, default 0)
  const balanceRaw = parseNumber(body.balance);
  const balance = balanceRaw !== null ? balanceRaw : 0;

  // Insertar
  const { data: account, error: insertErr } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,
      name,
      type,
      role,
      currency,
      balance,
      balance_updated_at: balance !== 0 ? new Date().toISOString() : null,
      is_archived: false,
    })
    .select("*")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, account }, { status: 201 });
}