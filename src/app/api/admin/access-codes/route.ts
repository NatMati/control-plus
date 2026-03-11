// src/app/api/admin/access-codes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ADMIN_USER_ID = process.env.ADMIN_USER_ID!;

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function checkAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user && user.id === ADMIN_USER_ID;
}

// ── GET — listar todos los códigos ────────────────────────────────────────────
export async function GET() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const service = getServiceClient();

  const { data, error } = await service
    .from("access_codes")
    .select("id, code, plan, duration_months, max_uses, uses, expires_at, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ codes: data ?? [] });
}

// ── POST — crear nuevo código ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const code     = (body?.code ?? "").trim().toUpperCase();
  const plan     = body?.plan;
  const maxUses  = Number(body?.max_uses ?? 1);
  const duration = body?.duration_months ? Number(body.duration_months) : null;
  const expiresAt = body?.expires_at ?? null;

  if (!code || !plan || !["PRO", "DELUXE"].includes(plan)) {
    return NextResponse.json({ error: "code y plan (PRO|DELUXE) son requeridos." }, { status: 400 });
  }

  if (!Number.isFinite(maxUses) || maxUses < 1) {
    return NextResponse.json({ error: "max_uses debe ser >= 1." }, { status: 400 });
  }

  const service = getServiceClient();

  const { data, error } = await service
    .from("access_codes")
    .insert({ code, plan, max_uses: maxUses, duration_months: duration, expires_at: expiresAt })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ese código ya existe." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, code: data }, { status: 201 });
}

// ── DELETE — eliminar código ──────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id requerido." }, { status: 400 });

  const service = getServiceClient();
  const { error } = await service.from("access_codes").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
