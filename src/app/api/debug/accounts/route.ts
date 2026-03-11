import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("accounts") // 👈 NO "public.accounts"
    .select("id,user_id,name,currency,created_at")
    .order("created_at", { ascending: true });

  return NextResponse.json({
    ok: !error,
    user: { id: user.id, email: user.email },
    count: data?.length ?? 0,
    accounts: data ?? [],
    error: error
      ? { message: error.message, details: error.details, hint: error.hint, code: error.code }
      : null,
  });
}
