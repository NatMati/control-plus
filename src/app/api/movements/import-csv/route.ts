// src/app/api/movements/import-csv/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type MovementImportRow = {
  date?: string;
  amount?: number | string;
  type?: string | null;
  Tipo?: string | null;
  tipo?: string | null;
  category?: string | null;
  description?: string | null;
  Categoria?: string | null;
  categoria?: string | null;
  Descripcion?: string | null;
  descripcion?: string | null;
  accountId?: string | null;
  // TRANSFER real
  counterpartyAccountId?: string | null;
  transferLeg?: "IN" | "OUT" | null;
};

type MovementInsert = {
  user_id: string;
  date: string;
  amount: number;
  currency: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  category: string | null;
  description: string | null;
  account_id: string | null;
  counterparty_account_id?: string | null;
  transfer_group_id?: string;
  transfer_leg?: string;
};

function normalizeDate(input: string): string {
  const trimmed = (input ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return "";
}

function mapType(raw?: string | null): "INCOME" | "EXPENSE" | "TRANSFER" {
  const v = (raw ?? "").toLowerCase().trim();
  if (v.startsWith("ingre")) return "INCOME";
  if (v.startsWith("egre") || v.startsWith("gast")) return "EXPENSE";
  if (v.startsWith("trans")) return "TRANSFER";
  return "EXPENSE";
}

function toNumberAmount(a: number | string | undefined): number {
  if (typeof a === "number") return a;
  if (!a) return 0;
  const s = String(a).replace(/\$/g, "").replace(/\s/g, "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const rows = body?.rows as MovementImportRow[] | undefined;
  const defaultAccountIdRaw = (body?.defaultAccountId ?? null) as string | null;

  if (!rows?.length) {
    return NextResponse.json({ error: "No se recibieron filas para importar" }, { status: 400 });
  }

  // Validar defaultAccountId
  let defaultAccountId: string | null = null;
  if (defaultAccountIdRaw) {
    const { data: acc } = await supabase
      .from("accounts").select("id").eq("id", defaultAccountIdRaw).eq("user_id", user.id).maybeSingle();
    if (acc?.id) defaultAccountId = acc.id;
  }

  // Validar todos los accountIds únicos del payload
  const uniqueAccountIds = Array.from(new Set(
    rows.flatMap((r) => [r.accountId, r.counterpartyAccountId]).filter((x): x is string => !!x?.trim())
  ));

  let allowedAccountIds = new Set<string>();
  if (uniqueAccountIds.length > 0) {
    const { data: accounts } = await supabase
      .from("accounts").select("id, currency").eq("user_id", user.id).in("id", uniqueAccountIds);
    allowedAccountIds = new Set((accounts ?? []).map((a) => a.id));
  }

  // Construir inserts
  const inserts: MovementInsert[] = [];
  let invalid = 0;

  for (const r of rows) {
    const rawType = r.type ?? r.Tipo ?? r.tipo ?? null;
    const rawCategory = r.category ?? r.Categoria ?? r.categoria ?? null;
    const rawDesc = r.description ?? r.Descripcion ?? r.descripcion ?? null;

    const date = normalizeDate(r.date ?? "");
    const amount = toNumberAmount(r.amount);

    if (!date || !Number.isFinite(amount) || amount === 0) { invalid++; continue; }

    const resolvedType = mapType(rawType);
    const rowAccountId = (r.accountId ?? "").trim() || null;
    const account_id = (rowAccountId && allowedAccountIds.has(rowAccountId) ? rowAccountId : null) ?? defaultAccountId ?? null;

    // Obtener moneda de la cuenta
    const { data: accData } = await supabase
      .from("accounts").select("currency").eq("id", account_id ?? "").maybeSingle();
    const currency = accData?.currency ?? "UYU";

    if (resolvedType === "TRANSFER") {
      const counterpartyRaw = (r.counterpartyAccountId ?? "").trim() || null;
      const counterparty_account_id = counterpartyRaw && allowedAccountIds.has(counterpartyRaw)
        ? counterpartyRaw : null;

      if (!counterparty_account_id) {
        // Sin contraparte válida → degradar a INCOME/EXPENSE
        const fallbackType = (r.transferLeg === "IN") ? "INCOME" : "EXPENSE";
        inserts.push({ user_id: user.id, date, amount, currency, type: fallbackType, category: rawCategory, description: rawDesc, account_id });
        continue;
      }

      const transfer_group_id = crypto.randomUUID();
      const transfer_leg = r.transferLeg ?? "OUT";

      inserts.push({
        user_id: user.id, date, amount, currency,
        type: "TRANSFER",
        category: rawCategory,
        description: rawDesc,
        account_id,
        counterparty_account_id,
        transfer_group_id,
        transfer_leg,
      });
    } else {
      inserts.push({ user_id: user.id, date, amount, currency, type: resolvedType, category: rawCategory, description: rawDesc, account_id });
    }
  }

  if (inserts.length === 0) {
    return NextResponse.json({ inserted: 0, invalid, error: "No hubo filas válidas para insertar." }, { status: 400 });
  }

  const { error } = await supabase.from("movements").insert(inserts);

  if (error) {
    console.error("[import-csv] Error al insertar:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: inserts.length, invalid, usedFallbackAccountId: defaultAccountId });
}
