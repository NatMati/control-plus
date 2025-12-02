// src/app/api/reports/cashflow/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

type MovementRow = {
  date: string; // YYYY-MM-DD
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  category: string | null;
};

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

export const dynamic = "force-dynamic";

/**
 * Devuelve el primer string dentro de `value` que tenga pinta de JWT:
 * - 3 partes separadas por '.'
 */
function findJwtInValue(value: string): string | undefined {
  // Caso 1: el propio value ya es un JWT
  const parts = value.split(".");
  if (parts.length === 3) {
    return value;
  }

  // Caso 2: value es JSON (objeto o array) que contiene el JWT
  try {
    const parsed = JSON.parse(value);

    const scan = (obj: any): string | undefined => {
      if (typeof obj === "string") {
        const p = obj.split(".");
        if (p.length === 3) return obj;
      } else if (Array.isArray(obj)) {
        for (const item of obj) {
          const found = scan(item);
          if (found) return found;
        }
      } else if (obj && typeof obj === "object") {
        for (const val of Object.values(obj)) {
          const found = scan(val);
          if (found) return found;
        }
      }
      return undefined;
    };

    return scan(parsed);
  } catch {
    // no era JSON
    return undefined;
  }
}

/**
 * Busca el access token de Supabase en las cookies del request.
 * Soporta:
 * - "sb-access-token"
 * - "supabase-auth-token"
 * - "sb-<project-ref>-auth-token"
 * en formatos string, JSON objeto, JSON array, etc.
 */
async function extractSupabaseAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();

  const directNames = ["sb-access-token", "supabase-auth-token"];

  // 1) nombres directos
  for (const name of directNames) {
    const c = cookieStore.get(name);
    if (c?.value) {
      const jwt = findJwtInValue(c.value);
      if (jwt) return jwt;
    }
  }

  // 2) formato típico sb-<project>-auth-token
  const all = cookieStore.getAll();
  for (const c of all) {
    if (c.name.startsWith("sb-") && c.name.endsWith("-auth-token")) {
      const jwt = findJwtInValue(c.value);
      if (jwt) return jwt;
    }
  }

  return undefined;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const fromParam = searchParams.get("from"); // ej: "2025-11"
    const toParam = searchParams.get("to");     // ej: "2025-11"

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const fromMonthStr = fromParam ?? `${currentYear}-${pad2(currentMonth)}`;
    const toMonthStr = toParam ?? fromMonthStr;

    const [fromYear, fromMonth] = fromMonthStr.split("-").map(Number);
    const [toYear, toMonth] = toMonthStr.split("-").map(Number);

    const fromDateStr = `${fromYear}-${pad2(fromMonth)}-01`;
    const lastDay = new Date(toYear, toMonth, 0).getDate();
    const toDateStr = `${toYear}-${pad2(toMonth)}-${pad2(lastDay)}`;

    // 🔐 token del usuario desde cookies (buscando JWT real)
    const accessToken = await extractSupabaseAccessToken();

    if (!accessToken) {
      console.error("[cashflow] No se encontró JWT de Supabase en cookies");
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const apiKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.SUPABASE_ANON_KEY;

    if (!baseUrl || !apiKey) {
      console.error("[cashflow] Faltan variables de entorno de Supabase");
      return NextResponse.json(
        { error: "Config Supabase incompleta" },
        { status: 500 }
      );
    }

    const params = new URLSearchParams();
    params.set("select", "date,type,amount,category");
    params.append("date", `gte.${fromDateStr}`);
    params.append("date", `lte.${toDateStr}`);
    params.set("order", "date.asc");

    const url = `${baseUrl}/rest/v1/movements?${params.toString()}`;

    const res = await fetch(url, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(
        `[cashflow] Error REST Supabase: ${res.status} - ${text}`
      );
      return NextResponse.json(
        { error: `Supabase REST error: ${res.status}` },
        { status: 500 }
      );
    }

    const data = (await res.json()) as MovementRow[];

    return NextResponse.json({ movements: data });
  } catch (e: any) {
    console.error("Error inesperado en /api/reports/cashflow:", e);
    return NextResponse.json(
      { error: "Error interno en cashflow" },
      { status: 500 }
    );
  }
}
