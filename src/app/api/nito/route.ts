// src/app/api/nito/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserPlan, canUseNito, PLAN_UPGRADE_MSG } from "@/lib/plan";

export const runtime = "nodejs";

type Message = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // ── Plan guard ────────────────────────────────────────────────────────────
  const plan = await getUserPlan(supabase, user.id);
  if (!canUseNito(plan)) {
    return NextResponse.json(
      { error: PLAN_UPGRADE_MSG.nito, upgrade: true, requiredPlan: "PRO" },
      { status: 403 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY no configurada." }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const messages: Message[] = body?.messages ?? [];
  const userCurrency: string = body?.currency ?? "UYU";

  if (!messages.length) {
    return NextResponse.json({ error: "Se requieren messages." }, { status: 400 });
  }

  // ── Contexto financiero del usuario ──────────────────────────────────────
  const [accountsRes, movementsRes, debtsRes] = await Promise.all([
    supabase
      .from("v_account_balances")
      .select("id, name, currency, balance_real, type")
      .eq("user_id", user.id),

    supabase
      .from("movements")
      .select("id, date, amount, type, category, description, currency, account_id")
      .eq("user_id", user.id)
      .in("type", ["INCOME", "EXPENSE"])
      .gte("date", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .order("date", { ascending: false })
      .limit(200),

    supabase
      .from("debts")
      .select("id, name, type, status, currency, total_amount, remaining_amount, monthly_payment, next_due_date, creditor")
      .eq("user_id", user.id)
      .neq("status", "PAID"),
  ]);

  const accounts = accountsRes.data ?? [];
  const movements = movementsRes.data ?? [];
  const debts = debtsRes.data ?? [];

  // ── Resumen de gastos por categoría (últimos 30 días) ────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recentExpenses = movements.filter(m => m.type === "EXPENSE" && m.date >= thirtyDaysAgo);
  const byCategory: Record<string, number> = {};
  for (const m of recentExpenses) {
    const cat = m.category ?? "Sin categoría";
    byCategory[cat] = (byCategory[cat] ?? 0) + m.amount;
  }

  const totalIncome30 = movements
    .filter(m => m.type === "INCOME" && m.date >= thirtyDaysAgo)
    .reduce((s, m) => s + m.amount, 0);
  const totalExpense30 = recentExpenses.reduce((s, m) => s + m.amount, 0);

  // ── Construir contexto para el system prompt ──────────────────────────────
  const accountsSummary = accounts.map(a =>
    `- ${a.name} (${a.currency}): saldo ${Number(a.balance_real ?? 0).toLocaleString("es-UY", { minimumFractionDigits: 2 })} ${a.currency}`
  ).join("\n");

  const categorySummary = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([cat, amt]) => `  · ${cat}: ${amt.toLocaleString("es-UY", { minimumFractionDigits: 2 })} ${userCurrency}`)
    .join("\n");

  const debtsSummary = debts.length
    ? debts.map(d =>
        `- ${d.name} (${d.creditor ?? d.type}): resta ${Number(d.remaining_amount).toLocaleString("es-UY", { minimumFractionDigits: 2 })} ${d.currency}${d.monthly_payment ? `, cuota ${Number(d.monthly_payment).toLocaleString("es-UY", { minimumFractionDigits: 2 })}` : ""}${d.next_due_date ? `, próx. venc. ${d.next_due_date}` : ""}`
      ).join("\n")
    : "Sin deudas activas";

  const today = new Date().toLocaleDateString("es-UY", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const SYSTEM_PROMPT = `Sos Nito ✦, el asistente financiero personal de Control+. Sos directo, claro y útil — como un amigo que sabe de finanzas personales.

HOY ES: ${today}
MONEDA BASE DEL USUARIO: ${userCurrency}

═══ CONTEXTO FINANCIERO REAL DEL USUARIO ═══

CUENTAS Y SALDOS:
${accountsSummary || "Sin cuentas registradas"}

ACTIVIDAD ÚLTIMOS 30 DÍAS:
- Ingresos: ${totalIncome30.toLocaleString("es-UY", { minimumFractionDigits: 2 })} ${userCurrency}
- Gastos: ${totalExpense30.toLocaleString("es-UY", { minimumFractionDigits: 2 })} ${userCurrency}
- Balance: ${(totalIncome30 - totalExpense30).toLocaleString("es-UY", { minimumFractionDigits: 2 })} ${userCurrency}

GASTOS POR CATEGORÍA (últimos 30 días):
${categorySummary || "  Sin datos"}

DEUDAS ACTIVAS:
${debtsSummary}

ÚLTIMOS MOVIMIENTOS (máx. 10):
${movements.slice(0, 10).map(m =>
  `  ${m.date} | ${m.type === "INCOME" ? "+" : "-"}${Number(m.amount).toLocaleString("es-UY", { minimumFractionDigits: 2 })} ${m.currency} | ${m.description ?? ""} [${m.category ?? "sin categoría"}]`
).join("\n") || "  Sin movimientos recientes"}

═══ TUS CAPACIDADES ═══

PODÉS:
1. Analizar gastos y dar insights concretos ("tu mayor gasto fue X, representa Y% del total")
2. Responder preguntas sobre saldos, deudas y situación financiera
3. Sugerir ajustes para mejorar el ahorro o llegar a metas
4. Registrar movimientos — cuando el usuario te diga algo como "gasté 500 en comida" o "cobré el sueldo", respondé con un JSON especial al FINAL de tu mensaje en este formato exacto:
   [NITO_ACTION:{"action":"register_movement","data":{"date":"YYYY-MM-DD","amount":500,"type":"EXPENSE","category":"Comida","description":"Comida","accountId":null}}]
5. Detectar patrones de gasto y alertar si algo parece fuera de lo normal

NO PODÉS:
- Recomendar acciones, criptomonedas o inversiones específicas
- Opinar sobre el mercado financiero
- Prometer rendimientos

ESTILO:
- Respondé en español rioplatense (tuteo, "vos", "te")
- Sé conciso pero completo — no des respuestas de una línea si el usuario pregunta algo importante
- Usá números reales del contexto cuando puedas
- Si no tenés datos suficientes, decilo claramente
- Podés usar emojis con moderación para hacer el chat más amigable
- Cuando registres un movimiento, confirmá al usuario qué registraste`;

  // ── Llamada a Claude ──────────────────────────────────────────────────────
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
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[nito] Anthropic error:", errText);
      return NextResponse.json({ error: `Error Anthropic: ${response.status}` }, { status: 502 });
    }

    const aiResponse = await response.json();
    const rawText: string = aiResponse?.content?.[0]?.text ?? "";

    // Detectar si hay una acción a ejecutar
    const actionMatch = rawText.match(/\[NITO_ACTION:(.+?)\]/s);
    let action: any = null;
    let cleanText = rawText;

    if (actionMatch) {
      try {
        action = JSON.parse(actionMatch[1]);
        cleanText = rawText.replace(actionMatch[0], "").trim();
      } catch {
        // Si no parsea, ignorar
      }
    }

    return NextResponse.json({ reply: cleanText, action });
  } catch (e: any) {
    console.error("[nito] Unexpected error:", e);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}
