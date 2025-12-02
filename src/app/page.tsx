// src/app/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const supabase = supabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        // Sin sesión → al login
        router.replace("/login");
      } else {
        // Con sesión → al dashboard principal
        router.replace("/resumen");
      }
    };

    checkSession();
  }, [router]);

  // Mientras chequea, no mostramos nada (podríamos poner un loader si querés)
  return null;
}
