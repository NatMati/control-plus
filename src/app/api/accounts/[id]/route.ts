// src/app/api/accounts/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Ctx =
  | { params: { id: string } }
  | { params: Promise<{ id: string }> };

async function getIdFromCtx(ctx: Ctx): Promise<string> {
  const p: any = (ctx as any).params;
  const resolved = typeof p?.then === "function" ? await p : p;
  return resolved?.id;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

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

function parseIsoDateOrNull(v: unknown): string | null | "INVALID" {
  if (v === null) return null;
  if (typeof v !== "string") return "INVALID";
  const s = v.trim();
  if (!s) return "INVALID";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "INVALID";
  // guardamos el string original; supabase lo castea
  return s;
}

/**
 * DELETE = soft delete (archivar)
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const supabase = await createClient();

  const id = await getIdFromCtx(ctx);
  if (!id) return jsonError("Falta id de cuenta.", 400);

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) return jsonError("No autorizado.", 401);

  const { data: account, error: accErr } = await supabase
    .from("accounts")
    .select("id,user_id,is_archived")
    .eq("id", id)
    .maybeSingle();

  if (accErr) return jsonError(accErr.message, 500);
  if (!account || account.user_id !== auth.user.id) return jsonError("Cuenta no encontrada.", 404);

  const { error: updErr } = await supabase
    .from("accounts")
    .update({ is_archived: true })
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (updErr) return jsonError(updErr.message, 500);

  return NextResponse.json({ ok: true });
}

/**
 * PATCH = editar campos permitidos (name/type/role/currency/snapshot)
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const supabase = await createClient();

  const id = await getIdFromCtx(ctx);
  if (!id) return jsonError("Falta id de cuenta.", 400);

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) return jsonError("No autorizado.", 401);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Body inválido.", 400);

  // Leemos cuenta actual (ownership + reglas)
  const { data: current, error: curErr } = await supabase
    .from("accounts")
    .select("id,user_id,currency")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (curErr) return jsonError(curErr.message, 500);
  if (!current) return jsonError("Cuenta no encontrada.", 404);

  const patch: Record<string, any> = {};

  // name
  if ("name" in body) {
    const name = typeof (body as any).name === "string" ? (body as any).name.trim() : "";
    if (!name) return jsonError("Nombre inválido.", 400);
    patch.name = name;
  }

  // type
  if ("type" in body) {
    const type = toUpperStr((body as any).type);
    if (!ACCOUNT_TYPES.has(type)) return jsonError("Tipo inválido.", 400);
    patch.type = type;
  }

  // role
  if ("role" in body) {
    const role = toUpperStr((body as any).role);
    if (!ACCOUNT_ROLES.has(role)) return jsonError("Rol inválido.", 400);
    patch.role = role;
  }

  // currency: bloquear si hay movimientos
  if ("currency" in body) {
    const nextCurrency = toUpperStr((body as any).currency);
    if (!nextCurrency) return jsonError("Moneda inválida.", 400);

    if (nextCurrency !== toUpperStr(current.currency)) {
      const { count, error: cntErr } = await supabase
        .from("movements")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.user.id)
        .eq("account_id", id);

      if (cntErr) return jsonError(cntErr.message, 500);
      if ((count ?? 0) > 0) {
        return jsonError("No podés cambiar la moneda de una cuenta con movimientos. Creá otra cuenta.", 409);
      }
    }

    patch.currency = nextCurrency;
  }

  // snapshot: balance + balance_updated_at
  if ("balance" in body) {
    const n = parseNumber((body as any).balance);
    if (n === null) return jsonError("Saldo base inválido.", 400);
    patch.balance = n;
  }

  if ("balance_updated_at" in body) {
    const parsed = parseIsoDateOrNull((body as any).balance_updated_at);
    if (parsed === "INVALID") return jsonError("Fecha de saldo base inválida.", 400);
    patch.balance_updated_at = parsed; // string ISO o null
  }

  // Seguridad: no permitimos patch de archivado desde UI
  if ("is_archived" in body) {
    return jsonError("Operación no permitida.", 400);
  }

  if (Object.keys(patch).length === 0) return jsonError("Nada para actualizar.", 400);

  const { data: updated, error: updErr } = await supabase
    .from("accounts")
    .update(patch)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("*")
    .maybeSingle();

  if (updErr) return jsonError(updErr.message, 500);
  if (!updated) return jsonError("Cuenta no encontrada.", 404);

  return NextResponse.json({ ok: true, account: updated });
}
