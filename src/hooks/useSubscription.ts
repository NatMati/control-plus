// src/hooks/useSubscription.ts
"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export type Plan = "FREE" | "PRO" | "DELUXE";

export type Subscription = {
  plan: Plan;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  loading: boolean;
};

const INITIAL: Subscription = {
  plan: "FREE",
  status: "active",
  current_period_end: null,
  cancel_at_period_end: false,
  loading: true,
};

export function useSubscription(): Subscription {
  const [sub, setSub] = useState<Subscription>(INITIAL);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    async function load() {
      const { data } = await supabase
        .from("subscriptions")
        .select("plan, status, current_period_end, cancel_at_period_end")
        .maybeSingle();

      setSub({
        plan: (data?.plan as Plan) ?? "FREE",
        status: data?.status ?? "active",
        current_period_end: data?.current_period_end ?? null,
        cancel_at_period_end: data?.cancel_at_period_end ?? false,
        loading: false,
      });
    }

    load();
  }, []);

  return sub;
}

// Helpers
export function canUseNito(plan: Plan) { return plan === "PRO" || plan === "DELUXE"; }
export function canUseImporter(plan: Plan) { return plan === "PRO" || plan === "DELUXE"; }
export function canUseInvestments(plan: Plan) { return plan === "DELUXE"; }
export function movementsLimit(plan: Plan): number | null {
  if (plan === "FREE") return 50;
  return null; // ilimitado
}
