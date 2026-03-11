// src/app/api/debug/whoami/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ??
      process.env.SUPABASE_URL ??
      null;

    // Usuario actual (si hay cookie de sesión)
    const { data: userRes, error: userErr } = await supabase.auth.getUser();

    // Healthcheck DB con la misma sesión/cookies
    const { data: dbRes, error: dbErr } = await supabase
      .from("accounts")
      .select("id")
      .limit(1);

    return NextResponse.json(
      {
        ok: true,
        supabaseUrl,
        user: userRes?.user
          ? {
              id: userRes.user.id,
              email: userRes.user.email,
              role: userRes.user.role,
            }
          : null,
        authError: userErr ? { message: userErr.message } : null,
        dbOk: !dbErr,
        dbError: dbErr
          ? { message: dbErr.message, details: dbErr.details, hint: dbErr.hint, code: dbErr.code }
          : null,
        sampleAccountId: Array.isArray(dbRes) && dbRes.length > 0 ? dbRes[0].id : null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
