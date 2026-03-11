// src/lib/supabase/route.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Si NO tenés Database types generados, dejalo así (sin types).
// Si los tenés, después lo tipamos.
export async function createRouteClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // En algunos contextos (edge/stream) set puede fallar; lo ignoramos.
          }
        },
      },
    }
  );
}
