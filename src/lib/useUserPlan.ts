// src/lib/useUserPlan.ts
"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "./supabaseBrowser";

type UserPlan = "free" | "pro";

type UserPlanState = {
  loading: boolean;
  error: string | null;
  plan: UserPlan;
  isPro: boolean;
  isFree: boolean;
};

const initialState: UserPlanState = {
  loading: true,
  error: null,
  plan: "free",
  isPro: false,
  isFree: true,
};

export function useUserPlan() {
  const [state, setState] = useState<UserPlanState>(initialState);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const supabase = supabaseBrowser();

      // 1) Traemos el usuario actual
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("Error cargando usuario:", userError);
      }

      // 👉 Si no hay sesión
      if (!user) {
        // En desarrollo te tratamos como PRO para poder trabajar tranquilo
        if (process.env.NODE_ENV === "development") {
          if (!cancelled) {
            setState({
              loading: false,
              error: null,
              plan: "pro",
              isPro: true,
              isFree: false,
            });
          }
          return;
        }

        // En producción, usuario sin sesión = plan FREE
        if (!cancelled) {
          setState({
            loading: false,
            error: null,
            plan: "free",
            isPro: false,
            isFree: true,
          });
        }
        return;
      }

      // 2) Buscamos su fila en user_plans
      const { data, error } = await supabase
        .from("user_plans")
        .select("plan, lifetime, pro_expires_at")
        .eq("user_id", user.id)
        .maybeSingle(); // devuelve 0 o 1 fila

      if (error) {
        console.error("Error cargando plan:", error);
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: "No se pudo cargar tu plan",
          }));
        }
        return;
      }

      // 👉 Le damos un tipo explícito para que TS no lo infiera como never
      const row =
        (data as {
          plan: string | null;
          lifetime: boolean | null;
          pro_expires_at: string | null;
        } | null) ?? null;

      let effectivePlan: UserPlan = "free";
      const now = new Date();

      if (row?.plan === "pro") {
        if (row.lifetime) {
          effectivePlan = "pro";
        } else if (row.pro_expires_at) {
          const expiresAt = new Date(row.pro_expires_at);
          if (expiresAt > now) {
            effectivePlan = "pro";
          }
        }
      }

      if (!cancelled) {
        setState({
          loading: false,
          error: null,
          plan: effectivePlan,
          isPro: effectivePlan === "pro",
          isFree: effectivePlan === "free",
        });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
