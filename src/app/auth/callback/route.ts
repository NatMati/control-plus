import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  // Si entran a /auth/callback sin code -> mandamos al login con mensaje
  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", requestUrl.origin)
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Error al intercambiar el código:", error.message);
    return NextResponse.redirect(
      new URL("/login?error=auth_callback_failed", requestUrl.origin)
    );
  }

  // Sesión OK -> home (o /resumen, lo que uses)
  return NextResponse.redirect(new URL("/", requestUrl.origin));
}
