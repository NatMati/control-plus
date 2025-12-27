// src/app/api/movements/import-csv/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type MovementImportRow = {
  date?: string;
  amount?: number | string;
  type?: string | null;

  // por si el front manda keys en español
  Tipo?: string | null;
  tipo?: string | null;

  category?: string | null;
  description?: string | null;

  Categoria?: string | null;
  categoria?: string | null;

  Descripcion?: string | null;
  descripcion?: string | null;

  // NUEVO: por si el front manda accountId por fila
  accountId?: string | null;
};

type MovementInsert = {
  user_id: string;
  date: string;
  amount: number;
  currency: "UYU";
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  category: string | null;
  description: string | null;
  account_id: string | null;
};

function normalizeDate(input: string): string {
  const trimmed = (input ?? "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;

  // dd/mm/yyyy (típico UY)
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${day}`;
  }

  // si viene algo imposible, lo marcamos como inválido
  return "";
}

function mapType(raw?: string | null): "INCOME" | "EXPENSE" | "TRANSFER" {
  const v = (raw ?? "").toLowerCase().trim();

  if (v.startsWith("ingre")) return "INCOME"; // Ingreso
  if (v.startsWith("egre") || v.startsWith("gast")) return "EXPENSE"; // Egreso/Gasto
  if (v.startsWith("trans")) return "TRANSFER"; // Transferencia

  // fallback seguro
  return "TRANSFER";
}

function toNumberAmount(a: number | string | undefined): number {
  if (typeof a === "number") return a;
  if (!a) return 0;

  // por si viene "$3.000,00" o "3.000,00"
  const s = String(a)
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const rows = body?.rows as MovementImportRow[] | undefined;

  // fallback general (solo si una fila no trae accountId o no es válida)
  const defaultAccountIdRaw = (body?.defaultAccountId ?? null) as string | null;

  if (!rows?.length) {
    return NextResponse.json(
      { error: "No se recibieron filas para importar" },
      { status: 400 }
    );
  }

  // 1) Validar defaultAccountId: solo si pertenece al usuario
  let defaultAccountId: string | null = null;
  if (defaultAccountIdRaw) {
    const { data: acc, error: accErr } = await supabase
      .from("accounts")
      .select("id")
      .eq("id", defaultAccountIdRaw)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!accErr && acc?.id) defaultAccountId = acc.id;
  }

  // 2) Armar set de accountIds por fila y validar contra cuentas del usuario
  const uniqueAccountIds = Array.from(
    new Set(
      rows
        .map((r) => (r.accountId ?? "").trim())
        .filter((x) => !!x)
    )
  );

  let allowedAccountIds = new Set<string>();
  if (uniqueAccountIds.length > 0) {
    const { data: accounts, error: accountsErr } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", user.id)
      .in("id", uniqueAccountIds);

    if (accountsErr) {
      console.error("[import-csv] Error cargando cuentas:", accountsErr);
    } else {
      allowedAccountIds = new Set((accounts ?? []).map((a) => a.id));
    }
  }

  // 3) Construir inserts (y filtrar filas claramente inválidas)
  const inserts: MovementInsert[] = [];
  let invalid = 0;

  for (const r of rows) {
    const rawType = r.type ?? r.Tipo ?? r.tipo ?? null;
    const rawCategory = r.category ?? r.Categoria ?? r.categoria ?? null;
    const rawDesc = r.description ?? r.Descripcion ?? r.descripcion ?? null;

    const date = normalizeDate(r.date ?? "");
    const amount = toNumberAmount(r.amount);

    // validación mínima: fecha válida y monto distinto de 0
    if (!date || !Number.isFinite(amount) || amount === 0) {
      invalid++;
      continue;
    }

    // accountId por fila si es válida; si no, usar fallback; si no, null
    const rowAccountId = (r.accountId ?? "").trim() || null;
    const account_id =
      (rowAccountId && allowedAccountIds.has(rowAccountId) ? rowAccountId : null) ??
      defaultAccountId ??
      null;

    inserts.push({
      user_id: user.id,
      date,
      amount,
      currency: "UYU",
      type: mapType(rawType),
      category: rawCategory,
      description: rawDesc,
      account_id,
    });
  }

  if (inserts.length === 0) {
    return NextResponse.json(
      {
        inserted: 0,
        invalid,
        error: "No hubo filas válidas para insertar (revisá Fecha y Monto).",
      },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("movements").insert(inserts);

  if (error) {
    console.error("[import-csv] Error al insertar:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    inserted: inserts.length,
    invalid,
    usedFallbackAccountId: defaultAccountId,
  });
}
