// src/lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

function cookieOptionsFromSSR(options?: CookieOptions) {
  return {
    path: options?.path,
    domain: options?.domain,
    maxAge: options?.maxAge,
    expires: options?.expires,
    httpOnly: options?.httpOnly,
    secure: options?.secure,
    sameSite: options?.sameSite,
  } as const;
}

/* ============================================================
   1) CLIENTE PARA API ROUTES (NO necesitamos escribir cookies)
   ============================================================ */
export async function createApiClient(): Promise<SupabaseClient> {
  const store = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll() {
          // En API routes normalmente no hace falta setear cookies.
          // Lo dejamos como no-op para no romper.
        },
      },
    }
  );
}

/* ============================================================
   2) CLIENTE NORMAL PARA SERVER COMPONENTS / SERVER ACTIONS
   ============================================================ */
export async function createClient(): Promise<SupabaseClient> {
  const store = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              store.set(name, value, cookieOptionsFromSSR(options));
            });
          } catch {
            // En algunos contextos Next no permite setear cookies. OK.
          }
        },
      },
    }
  );
}
