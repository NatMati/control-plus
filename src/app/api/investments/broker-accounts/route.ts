// src/app/api/investments/broker-accounts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/server";

// GET — listar brokers del usuario
export async function GET() {
  try {
    const supabase = await createApiClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data, error } = await supabase
      .from("broker_accounts")
      .select("id, name, currency, created_at")
      .eq("user_id", user.id)
      .order("name");

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ brokers: data ?? [] });

  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error interno" }, { status: 500 });
  }
}

// POST — crear un broker nuevo
export async function POST(req: NextRequest) {
  try {
    const supabase = await createApiClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body     = await req.json();
    const name     = String(body.name     || "").trim();
    const currency = String(body.currency || "USD").trim().toUpperCase();

    if (!name) return NextResponse.json({ error: "Nombre del broker requerido." }, { status: 400 });

    // Verificar que no exista ya
    const { data: existing } = await supabase
      .from("broker_accounts")
      .select("id")
      .eq("user_id", user.id)
      .ilike("name", name)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, id: existing.id, alreadyExisted: true });
    }

    const { data, error } = await supabase
      .from("broker_accounts")
      .insert({ user_id: user.id, name, currency })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, id: data.id, alreadyExisted: false });

  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error interno" }, { status: 500 });
  }
}
