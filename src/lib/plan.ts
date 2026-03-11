// src/lib/plan.ts
// Helper server-side para verificar el plan del usuario
// Usar en API routes y server components

import type { SupabaseClient } from "@supabase/supabase-js";

export type Plan = "FREE" | "PRO" | "DELUXE";

export async function getUserPlan(supabase: SupabaseClient, userId: string): Promise<Plan> {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .maybeSingle();

  return (data?.plan as Plan) ?? "FREE";
}

export function canUseNito(plan: Plan)     { return plan === "PRO" || plan === "DELUXE"; }
export function canUseImporter(plan: Plan) { return plan === "PRO" || plan === "DELUXE"; }
export function canUseInvestments(plan: Plan) { return plan === "DELUXE"; }
export function movementsLimit(plan: Plan): number | null {
  return plan === "FREE" ? 50 : null;
}

export const PLAN_UPGRADE_MSG: Record<string, string> = {
  nito:      "Nito ✦ está disponible en el plan Pro y Deluxe.",
  importer:  "El importador IA está disponible en el plan Pro y Deluxe.",
  movements: "Alcanzaste el límite de 50 movimientos del plan Free.",
  investments: "Las inversiones y seguros son exclusivos del plan Deluxe.",
};
