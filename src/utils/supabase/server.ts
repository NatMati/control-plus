// src/utils/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Crea un SupabaseClient del lado servidor usando las cookies de Next.
 * Siempre llamalo como:
 *   const supabase = await createClient();
 */
export async function createClient(): Promise<SupabaseClient> {
  // En Next 13+/14/15 los tipos de `cookies()` pueden ser asíncronos,
  // así que lo tratamos como Promise para evitar el error de TS.
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options?: CookieOptions) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options?: CookieOptions) {
          cookieStore.set(name, "", { ...options, maxAge: 0 });
        },
      },
    }
  );
}
