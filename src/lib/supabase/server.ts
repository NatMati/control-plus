import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/* ============================================================
   1) CLIENTE PARA API ROUTES (SOLO LECTURA DE COOKIES)
   ============================================================ */
export async function createApiClient(): Promise<SupabaseClient> {
  // En tu Next, cookies() devuelve una Promise -> usamos await + cast a any
  const cookieStore = (await cookies()) as any;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // ?. por si en algún contexto no existe get
          return cookieStore?.get?.(name)?.value ?? null;
        },
        // En API routes NO modificamos cookies
        set() {},
        remove() {},
      },
    }
  );
}

/* ============================================================
   2) CLIENTE NORMAL PARA SERVER COMPONENTS / SERVER ACTIONS
   ============================================================ */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = (await cookies()) as any;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore?.get?.(name)?.value ?? null;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Solo debería usarse en Server Actions; protegemos con try/catch
          try {
            cookieStore?.set?.({ name, value, ...options });
          } catch {
            // Si estamos en un contexto donde no se puede escribir cookies,
            // no rompemos la app.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore?.set?.({ name, value: "", ...options });
          } catch {
            // Igual que arriba: ignorar errores de escritura de cookies
          }
        },
      },
    }
  );
}
