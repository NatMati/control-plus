// src/app/api/debts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES = new Set(["LOAN", "CREDIT_CARD", "INFORMAL", "MORTGAGE"]);
const VALID_CURRENCIES = new Set(["UYU", "USD", "EUR", "ARS", "BRL"]);

export async function GET() {
  const supabase = await createApiClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("debts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const res = NextResponse.json({ debts: data ?? [] });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function POST(req: NextRequest) {
  const supabase = await createApiClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });

  const type = typeof body.type === "string" ? body.type.toUpperCase() : "";
  if (!VALID_TYPES.has(type)) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });

  const currency = typeof body.currency === "string" ? body.currency.toUpperCase() : "UYU";
  if (!VALID_CURRENCIES.has(currency)) return NextResponse.json({ error: "Moneda inválida" }, { status: 400 });

  const total_amount = Number(body.total_amount ?? 0);
  if (!total_amount || total_amount <= 0) return NextResponse.json({ error: "Monto total inválido" }, { status: 400 });

  const remaining_amount = Number(body.remaining_amount ?? total_amount);
  const monthly_payment = body.monthly_payment ? Number(body.monthly_payment) : null;
  const interest_rate = body.interest_rate ? Number(body.interest_rate) : null;
  const first_due_date = body.first_due_date ?? null;
  const end_date = body.end_date ?? null;
  const account_id = body.account_id || null;
  const creditor = typeof body.creditor === "string" ? body.creditor.trim() : null;
  const note = typeof body.note === "string" ? body.note.trim() : null;

  const { data: debt, error: insertErr } = await supabase
    .from("debts")
    .insert({
      user_id: user.id,
      name, type, currency,
      total_amount, remaining_amount,
      monthly_payment, interest_rate,
      first_due_date,
      next_due_date: first_due_date,
      end_date, account_id, creditor, note,
      status: "ACTIVE",
    })
    .select("*")
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, debt }, { status: 201 });
}