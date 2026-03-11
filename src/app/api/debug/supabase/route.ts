// src/app/api/debug/supabase/route.ts
import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function safeUrl(u: string | undefined | null) {
  if (!u) return null;
  try {
    const url = new URL(u);
    // devuelve solo host + primer segmento ref
    return url.host;
  } catch {
    return u;
  }
}

export async function GET() {
  // 1) API client (con cookies)
  const api = await createApiClient();
  const {
    data: { user },
    error: userErr,
  } = await api.auth.getUser();

  // 2) Admin client (service role)
  let adminOk = true;
  let adminErr: any = null;

  let admin: ReturnType<typeof createAdminClient> | null = null;
  try {
    admin = createAdminClient();
  } catch (e: any) {
    adminOk = false;
    adminErr = e?.message ?? String(e);
  }

  // URLs usadas por env (para ver si están mezcladas)
  const envInfo = {
    NEXT_PUBLIC_SUPABASE_URL: safeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_URL: safeUrl(process.env.SUPABASE_URL),
    hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  // Si no hay user, devolvemos igual envInfo para diagnosticar
  if (userErr || !user) {
    return NextResponse.json(
      {
        ok: false,
        error: "No authenticated user in this request",
        userErr: userErr?.message ?? null,
        envInfo,
        adminOk,
        adminErr,
      },
      { status: 200 }
    );
  }

  // Probamos qué ve cada client
  const { data: apiAccs, error: apiAccErr } = await api
    .from("accounts")
    .select("id,name,currency,user_id")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  let adminAccs: any[] | null = null;
  let adminAccErr: any = null;

  if (admin) {
    const r = await admin
      .from("accounts")
      .select("id,name,currency,user_id")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    adminAccs = r.data ?? null;
    adminAccErr = r.error
      ? { message: r.error.message, code: r.error.code, hint: r.error.hint }
      : null;
  }

  return NextResponse.json(
    {
      ok: true,
      userId: user.id,
      envInfo,
      api: {
        count: apiAccs?.length ?? 0,
        error: apiAccErr
          ? { message: apiAccErr.message, code: apiAccErr.code, hint: apiAccErr.hint }
          : null,
        accounts: apiAccs ?? [],
      },
      admin: {
        ok: adminOk,
        error: adminAccErr ?? adminErr,
        count: adminAccs?.length ?? 0,
        accounts: adminAccs ?? [],
      },
    },
    { status: 200 }
  );
}