// src/app/api/accounts/snapshots/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function parseNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseIsoDateOrNull(v: unknown): string | null | "INVALID" {
  if (v === null) return null;
  if (typeof v !== "string") return "INVALID";
  const s = v.trim();
  if (!s) return "INVALID";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "INVALID";
  return s;
}

type SnapshotItem = {
  account_id: string;
  balance: number;
  balance_updated_at: string | null;
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) return jsonError("No autorizado.", 401);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Body inválido.", 400);

  const itemsRaw = (body as any).items;
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
    return jsonError("items debe ser un array no vacío.", 400);
  }

  const items: SnapshotItem[] = [];

  for (const it of itemsRaw) {
    const account_id = typeof it?.account_id === "string" ? it.account_id : "";
    if (!account_id) return jsonError("account_id inválido.", 400);

    const balance = parseNumber(it?.balance);
    if (balance === null) return jsonError("balance inválido.", 400);

    const parsedDate = parseIsoDateOrNull(it?.balance_updated_at);
    if (parsedDate === "INVALID") return jsonError("balance_updated_at inválido.", 400);

    items.push({ account_id, balance, balance_updated_at: parsedDate });
  }

  // Validar que TODAS las cuentas pertenecen al usuario
  const accountIds = items.map((i) => i.account_id);

  const { data: owned, error: ownedErr } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", auth.user.id)
    .in("id", accountIds);

  if (ownedErr) return jsonError(ownedErr.message, 500);

  const ownedSet = new Set((owned ?? []).map((r: any) => r.id));
  for (const id of accountIds) {
    if (!ownedSet.has(id)) return jsonError("Una o más cuentas no pertenecen al usuario.", 403);
  }

  // Actualizar una por una (simple y confiable)
  const updatedIds: string[] = [];
  for (const it of items) {
    const { error: updErr } = await supabase
      .from("accounts")
      .update({
        balance: it.balance,
        balance_updated_at: it.balance_updated_at,
      })
      .eq("id", it.account_id)
      .eq("user_id", auth.user.id);

    if (updErr) return jsonError(updErr.message, 500);

    updatedIds.push(it.account_id);
  }

  return NextResponse.json({ ok: true, updated_ids: updatedIds });
}
