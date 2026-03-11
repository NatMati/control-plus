// src/app/api/access-code/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── GET — previsualizar código (sin aplicar) ──────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const code = (req.nextUrl.searchParams.get("code") ?? "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "Código requerido." }, { status: 400 });

  const service = getServiceClient();
  const { data: accessCode } = await service
    .from("access_codes")
    .select("id, plan, duration_months, max_uses, uses, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (!accessCode) {
    return NextResponse.json({ error: "Código inválido." }, { status: 404 });
  }

  const cupos_restantes = accessCode.max_uses - accessCode.uses;
  const expired = accessCode.expires_at && new Date(accessCode.expires_at) < new Date();

  if (expired) return NextResponse.json({ error: "Este código expiró." }, { status: 400 });
  if (cupos_restantes <= 0) return NextResponse.json({ error: "Este código ya alcanzó su límite de usos." }, { status: 400 });

  // Verificar si el usuario ya lo usó
  const { data: existingUse } = await service
    .from("access_code_uses")
    .select("id")
    .eq("code_id", accessCode.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingUse) return NextResponse.json({ error: "Ya usaste este código." }, { status: 400 });

  return NextResponse.json({
    valid: true,
    plan: accessCode.plan,
    duration_months: accessCode.duration_months,
    cupos_restantes,
  });
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const code: string = (body?.code ?? "").trim().toUpperCase();

  if (!code) {
    return NextResponse.json({ error: "Código requerido." }, { status: 400 });
  }

  const service = getServiceClient();

  // ── Buscar el código ──────────────────────────────────────────────────────
  const { data: accessCode, error: codeErr } = await service
    .from("access_codes")
    .select("id, plan, duration_months, max_uses, uses, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (codeErr || !accessCode) {
    return NextResponse.json({ error: "Código inválido." }, { status: 404 });
  }

  // ── Validaciones ──────────────────────────────────────────────────────────
  if (accessCode.uses >= accessCode.max_uses) {
    return NextResponse.json({ error: "Este código ya alcanzó su límite de usos." }, { status: 400 });
  }

  if (accessCode.expires_at && new Date(accessCode.expires_at) < new Date()) {
    return NextResponse.json({ error: "Este código expiró." }, { status: 400 });
  }

  // ── Verificar que el usuario no lo haya usado antes ───────────────────────
  const { data: existingUse } = await service
    .from("access_code_uses")
    .select("id")
    .eq("code_id", accessCode.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingUse) {
    return NextResponse.json({ error: "Ya usaste este código." }, { status: 400 });
  }

  // ── Calcular fecha de vencimiento del plan ────────────────────────────────
  let planExpiresAt: string | null = null;
  if (accessCode.duration_months !== null) {
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + accessCode.duration_months);
    planExpiresAt = expiry.toISOString();
  }

  // ── Aplicar plan al usuario ───────────────────────────────────────────────
  const { error: subErr } = await service
    .from("subscriptions")
    .upsert({
      user_id: user.id,
      plan: accessCode.plan,
      status: "active",
      current_period_end: planExpiresAt,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

  if (subErr) {
    console.error("[access-code] Error upserting subscription:", subErr);
    return NextResponse.json({ error: "Error al aplicar el código." }, { status: 500 });
  }

  // ── Registrar el uso ──────────────────────────────────────────────────────
  await service.from("access_code_uses").insert({
    code_id: accessCode.id,
    user_id: user.id,
  });

  // ── Incrementar contador de usos ──────────────────────────────────────────
  await service
    .from("access_codes")
    .update({ uses: accessCode.uses + 1 })
    .eq("id", accessCode.id);

  return NextResponse.json({
    ok: true,
    plan: accessCode.plan,
    duration_months: accessCode.duration_months,
    expires_at: planExpiresAt,
    cupos_restantes: accessCode.max_uses - accessCode.uses - 1,
    message: `¡Código aplicado! Plan ${accessCode.plan}${accessCode.duration_months ? ` por ${accessCode.duration_months} meses` : " para siempre"} activado.`,
  });
}
