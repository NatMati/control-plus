// src/app/api/movements/import-ai/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserPlan, canUseImporter, PLAN_UPGRADE_MSG } from "@/lib/plan";

export const runtime = "nodejs";

export type ExtractedMovement = {
  date: string;
  amount: number;
  type: "INCOME" | "EXPENSE" | "TRANSFER_PENDING";
  transferDirection?: "IN" | "OUT";
  category: string | null;
  description: string;
  raw: string;
  accountId?: string | null;
  counterpartyAccountId?: string | null;
  // Detección
  isDuplicate: boolean;
  duplicateOf: string | null;       // id del movimiento existente
  duplicateDesc?: string | null;    // descripción del existente para mostrar al usuario
};

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // ── Plan guard ────────────────────────────────────────────────────────────
  const plan = await getUserPlan(supabase, user.id);
  if (!canUseImporter(plan)) {
    return NextResponse.json(
      { error: PLAN_UPGRADE_MSG.importer, upgrade: true, requiredPlan: "PRO" },
      { status: 403 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY no configurada." }, { status: 500 });
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => null);

  const isPdf   = !!body?.pdfBase64   && typeof body.pdfBase64 === "string";
  const isImage = !!body?.imageBase64 && typeof body.imageBase64 === "string";

  if (!isPdf && !isImage) {
    return NextResponse.json({ error: "Se requiere pdfBase64 o imageBase64." }, { status: 400 });
  }

  const mediaType: string = body.mediaType ?? (isPdf ? "application/pdf" : "image/jpeg");
  const base64: string    = isPdf ? body.pdfBase64 : body.imageBase64;
  const sourceAccountId: string | null = body.accountId ?? null;

  const fileContentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: mediaType, data: base64 } }
    : { type: "image",    source: { type: "base64", media_type: mediaType, data: base64 } };

  // ── Prompt ────────────────────────────────────────────────────────────────
  const SYSTEM_PROMPT = `Sos un asistente experto en extracción de datos financieros de estados de cuenta bancarios uruguayos.

Tu tarea es extraer TODOS los movimientos del estado de cuenta y devolverlos en formato JSON estricto.

REGLAS:
1. Extraé SOLO movimientos reales (no encabezados, saldos, totales ni notas).
2. Ignorá las líneas REDIVA 17934 y REDIVA 19210 (son reembolsos de IVA automáticos).
3. Para cada movimiento:
   - date: YYYY-MM-DD (el año viene del encabezado)
   - amount: número positivo siempre
   - type: "INCOME" | "EXPENSE" | "TRANSFER_PENDING" (para traspasos entre cuentas propias)
   - transferDirection: "IN" o "OUT" si type es TRANSFER_PENDING
   - category: Comida | Transporte | Supermercado | Servicios | Entretenimiento | Salud | Educación | Regalos | Suscripciones | Inversiones | Transferencia | Cambio de moneda | Otro
   - description: descripción limpia sin códigos internos
   - raw: línea original exacta

4. Reglas por tipo de línea:
   - COMPRA → EXPENSE
   - TRASPASO DE (recibís) → TRANSFER_PENDING, transferDirection: "IN"
   - TRASPASO A (enviás) → TRANSFER_PENDING, transferDirection: "OUT"
   - DEB. CAMBIOS → EXPENSE, category: "Cambio de moneda"
   - CRE. CAMBIOS → INCOME, category: "Cambio de moneda"

RESPONDÉ ÚNICAMENTE con JSON válido sin markdown:
{
  "movements": [{"date":"YYYY-MM-DD","amount":0,"type":"EXPENSE","transferDirection":null,"category":"Otro","description":"","raw":""}],
  "period": "YYYY-MM",
  "bank": "nombre",
  "currency": "UYU",
  "opening_balance": 0,
  "closing_balance": 0
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: [
            fileContentBlock,
            { type: "text", text: "Extraé todos los movimientos y devolvé el JSON." },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[import-ai] Anthropic error:", errText);
      return NextResponse.json({ error: `Error Anthropic: ${response.status}` }, { status: 502 });
    }

    const aiResponse = await response.json();
    const rawText = aiResponse?.content?.[0]?.text ?? "";

    let parsed: any;
    try {
      parsed = JSON.parse(rawText.replace(/```json|```/g, "").trim());
    } catch {
      console.error("[import-ai] JSON parse error:", rawText.slice(0, 300));
      return NextResponse.json({ error: "No se pudo parsear la respuesta de la IA." }, { status: 500 });
    }

    function sanitizeType(raw: string): "INCOME" | "EXPENSE" | "TRANSFER_PENDING" {
      const t = (raw ?? "").toUpperCase();
      if (t === "INCOME") return "INCOME";
      if (t === "TRANSFER_PENDING") return "TRANSFER_PENDING";
      return "EXPENSE";
    }

    const movements: ExtractedMovement[] = (parsed.movements ?? []).map((m: any) => ({
      date: m.date ?? "",
      amount: Number(m.amount ?? 0),
      type: sanitizeType(m.type),
      transferDirection: m.transferDirection ?? undefined,
      category: m.category ?? null,
      description: m.description ?? "",
      raw: m.raw ?? "",
      accountId: sourceAccountId,
      counterpartyAccountId: null,
      isDuplicate: false,
      duplicateOf: null,
      duplicateDesc: null,
    }));

    // ── Cargar cuentas del usuario ────────────────────────────────────────
    const { data: allAccounts } = await supabase
      .from("accounts")
      .select("id, name, currency")
      .eq("user_id", user.id);

    // ── Cargar movimientos existentes en el rango del extracto ────────────
    const dates = movements.map(m => m.date).filter(Boolean).sort();
    const minDate = dates[0] ?? "";
    const maxDate = dates[dates.length - 1] ?? "";

    let existingMovements: any[] = [];
    if (minDate && maxDate) {
      const expand = (d: string, days: number) =>
        new Date(new Date(d).getTime() + days * 86400000).toISOString().slice(0, 10);

      const { data } = await supabase
        .from("movements")
        .select("id, date, amount, type, description, account_id, currency")
        .eq("user_id", user.id)
        .gte("date", expand(minDate, -2))
        .lte("date", expand(maxDate, 2));

      existingMovements = data ?? [];
    }

    // ── DETECCIÓN DE DUPLICADOS ───────────────────────────────────────────
    // Criterio: mismo monto + misma cuenta origen + fecha ±1 día
    for (const m of movements) {
      const mTime = new Date(m.date).getTime();
      const match = existingMovements.find(ex => {
        const dayDiff = Math.abs(new Date(ex.date).getTime() - mTime) / 86400000;
        const sameAmount = Math.abs(ex.amount - m.amount) < 0.01;
        const sameAccount = !sourceAccountId || ex.account_id === sourceAccountId;
        return dayDiff <= 1 && sameAmount && sameAccount;
      });
      if (match) {
        m.isDuplicate = true;
        m.duplicateOf = match.id;
        m.duplicateDesc = match.description ?? null;
      }
    }

    // ── DETECCIÓN DE TRANSFERENCIAS CRUZADAS ─────────────────────────────
    // Para cada TRANSFER_PENDING sin contraparte, buscamos en existingMovements
    // un movimiento en cuenta DISTINTA con mismo monto y fecha ±2 días
    for (const m of movements) {
      if (m.type !== "TRANSFER_PENDING") continue;
      if (m.counterpartyAccountId) continue;

      const mTime = new Date(m.date).getTime();

      const mirror = existingMovements.find(ex => {
        const dayDiff = Math.abs(new Date(ex.date).getTime() - mTime) / 86400000;
        const sameAmount = Math.abs(ex.amount - m.amount) < 0.01;
        const diffAccount = !sourceAccountId || ex.account_id !== sourceAccountId;
        return dayDiff <= 2 && sameAmount && diffAccount;
      });

      if (mirror) {
        m.counterpartyAccountId = mirror.account_id;
      }
    }

    const duplicatesFound   = movements.filter(m => m.isDuplicate).length;
    const transfersDetected = movements.filter(m => m.type === "TRANSFER_PENDING" && m.counterpartyAccountId).length;

    return NextResponse.json({
      ok: true,
      movements,
      meta: {
        period: parsed.period ?? null,
        bank: parsed.bank ?? null,
        currency: parsed.currency ?? "UYU",
        opening_balance: parsed.opening_balance ?? null,
        closing_balance: parsed.closing_balance ?? null,
        total_extracted: movements.length,
        duplicates_found: duplicatesFound,
        transfers_detected: transfersDetected,
      },
      accounts: allAccounts ?? [],
    });

  } catch (e: any) {
    console.error("[import-ai] Unexpected error:", e);
    return NextResponse.json({ error: "Error inesperado al procesar el archivo." }, { status: 500 });
  }
}
