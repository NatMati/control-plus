// src/app/api/debts/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createApiClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  // Solo permitimos actualizar estos campos
  const allowed = [
    "name", "type", "status", "currency", "total_amount", "remaining_amount",
    "monthly_payment", "interest_rate", "first_due_date", "next_due_date",
    "end_date", "account_id", "creditor", "note",
  ];

  const update: Record<string, any> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  if (!Object.keys(update).length) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

  const { data, error } = await supabase
    .from("debts")
    .update(update)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, debt: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createApiClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { error } = await supabase
    .from("debts")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
