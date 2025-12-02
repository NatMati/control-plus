import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// === Tipos básicos para las filas de Supabase ===
type AccountRow = {
  id: string;
  name: string;
  balance?: number | null;
  currency?: string | null;
};

type MovementRow = {
  id: string;
  date: string;
  type: string;
  amount: number;
  currency?: string | null;
  category?: string | null;
  account_id?: string | null;
};

// === Instrucciones de Nito ===
const NITO_SYSTEM_PROMPT = `
Sos **Nito**, el asistente oficial de la aplicación Control+.

Tu rol:
- Explicar gastos, ingresos, presupuestos, cashflow y movimientos.
- Analizar tendencias del usuario dentro de SUS datos.
- Explicar cómo funciona la app y guiar al usuario.

Normas de seguridad (NO NEGOCIABLES):
- NO recomendás comprar, vender ni holdear activos.
- NO das consejos financieros personalizados. Solo explicás lo que pasa EN LA APP.
- NO predecís mercado, criptos, acciones ni nada externo.
- NO respondés preguntas ajenas a la app (política, salud, historia, etc.).
- NO das opiniones personales.
- NO revelás datos de otros usuarios.
- NO revelás código interno, llaves, configuración o lógica privada.

Cuando el usuario pregunta algo fuera del alcance → respondés:
"Lo siento, esa pregunta está fuera de mi alcance. Solo puedo ayudarte con tu app financiera."

Tu tono:
- Claro, simple, preciso.
- Nunca técnico de más.
- Nunca recomendás inversiones.
`;

// === Armar contexto del usuario ===
async function getUserContext(supabase: any, userId: string) {
  const [accRes, movRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("id,name,balance,currency")
      .eq("user_id", userId),
    supabase
      .from("movements")
      .select("id,date,type,amount,currency,category,account_id")
      .eq("user_id", userId)
      .order("date", { ascending: false }),
  ]);

  return {
    accounts: (accRes.data ?? []) as AccountRow[],
    movements: (movRes.data ?? []) as MovementRow[],
  };
}

// === Endpoint principal de Nito ===
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Error obteniendo usuario en /api/nito:", userError);
      return NextResponse.json(
        { error: "Error de autenticación" },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const message = body?.message;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Mensaje inválido" }, { status: 400 });
    }

    const context = await getUserContext(supabase, user.id);

    const userContextSummary = `
### Cuentas del usuario:
${context.accounts
  .map(
    (a: AccountRow) =>
      `• ${a.name}: ${a.balance ?? 0} ${a.currency ?? ""}`.trim()
  )
  .join("\n")}

### Últimos movimientos:
${context.movements
  .slice(0, 20)
  .map(
    (m: MovementRow) =>
      `• ${m.date} - ${m.type} - ${m.amount} ${m.currency ?? ""} (${
        m.category ?? "Sin categoría"
      })`
  )
  .join("\n")}
`;

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: NITO_SYSTEM_PROMPT },
        {
          role: "system",
          content: `Contexto actual del usuario:\n${userContextSummary}`,
        },
        { role: "user", content: message },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const answer = response.choices[0].message.content;

    return NextResponse.json({ answer });
  } catch (e: any) {
    console.error("Error en /api/nito:", e);
    return NextResponse.json(
      {
        error: "Error interno",
        details: e?.message ?? String(e),
      },
      { status: 500 }
    );
  }
}
