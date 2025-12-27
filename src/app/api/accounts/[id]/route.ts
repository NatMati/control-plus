// src/app/api/accounts/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = new Set(["CHECKING", "SAVINGS", "INVESTMENT"]);
const ALLOWED_TYPES = new Set(["BANK", "CASH", "WALLET", "BROKER", "OTHER"]);
const ALLOWED_CURRENCIES = new Set(["UYU", "USD"]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PatchBody = Partial<{
  name: string;
  currency: string;
  type: string;
  role: string;
  balance: number;
}>;

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> } // Next 15/16
) {
  try {
    const { id } = await ctx.params;

    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    let body: PatchBody | null = null;
    try {
      body = (await req.json()) as PatchBody;
    } catch {
      return NextResponse.json(
        { error: "Body inválido (JSON requerido)" },
        { status: 400 }
      );
    }

    const update: Record<string, any> = {};

    // name
    if (body.name !== undefined) {
      const name = String(body.name ?? "").trim();
      if (!name) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
      update.name = name;
    }

    // currency
    if (body.currency !== undefined) {
      const currency = String(body.currency ?? "").trim().toUpperCase();
      if (!ALLOWED_CURRENCIES.has(currency)) {
        return NextResponse.json({ error: "Moneda inválida" }, { status: 400 });
      }
      update.currency = currency;
    }

    // type
    if (body.type !== undefined) {
      const type = String(body.type ?? "").trim().toUpperCase();
      if (!ALLOWED_TYPES.has(type)) {
        return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
      }
      update.type = type;
    }

    // role
    if (body.role !== undefined) {
      const role = String(body.role ?? "").trim().toUpperCase();
      if (!ALLOWED_ROLES.has(role)) {
        return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
      }
      update.role = role;
    }

    // balance
    if (body.balance !== undefined) {
      const balance = Number(body.balance);
      if (!Number.isFinite(balance)) {
        return NextResponse.json({ error: "Saldo inválido" }, { status: 400 });
      }
      update.balance = balance;
      update.balance_updated_at = new Date().toISOString();
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "No hay campos para actualizar" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("accounts")
      .update(update)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, name, currency, type, role, balance, balance_updated_at, created_at")
      .single();

    if (error) {
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

    return NextResponse.json({ ok: true, account: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Error inesperado", details: e?.message },
      { status: 500 }
    );
  }
}

// (Opcional) DELETE si después querés borrar cuentas desde UI
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { error } = await supabase
      .from("accounts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Error inesperado", details: e?.message },
      { status: 500 }
    );
  }
}
