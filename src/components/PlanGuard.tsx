// src/components/PlanGuard.tsx
"use client";

import { useRouter } from "next/navigation";
import { useSubscription, type Plan } from "@/hooks/useSubscription";

type Props = {
  /** Plan mínimo requerido para ver el contenido */
  require: Plan;
  children: React.ReactNode;
  /** Si true, muestra el contenido bloqueado con overlay en vez de ocultarlo */
  overlay?: boolean;
};

const PLAN_RANK: Record<Plan, number> = { FREE: 0, PRO: 1, DELUXE: 2 };

const PLAN_META: Record<Plan, { label: string; color: string; gradient: string }> = {
  FREE:   { label: "Free",   color: "text-slate-400",  gradient: "from-slate-600 to-slate-700" },
  PRO:    { label: "Pro",    color: "text-blue-400",   gradient: "from-blue-600 to-blue-700" },
  DELUXE: { label: "Deluxe", color: "text-amber-400",  gradient: "from-amber-500 to-orange-600" },
};

export default function PlanGuard({ require: requiredPlan, children, overlay = true }: Props) {
  const { plan, loading } = useSubscription();
  const router = useRouter();

  if (loading) return <>{children}</>;

  const hasAccess = PLAN_RANK[plan] >= PLAN_RANK[requiredPlan];
  if (hasAccess) return <>{children}</>;

  const meta = PLAN_META[requiredPlan];

  if (!overlay) return null;

  return (
    <div className="relative">
      {/* Contenido difuminado */}
      <div className="pointer-events-none select-none blur-sm opacity-40">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center rounded-2xl"
        style={{ background: "rgba(4,9,22,0.85)", backdropFilter: "blur(4px)" }}>
        <div className="text-center px-6 py-5 max-w-xs">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3 bg-gradient-to-br ${meta.gradient}`}>
            {requiredPlan === "PRO" ? "⚡" : "✦"}
          </div>
          <div className={`text-sm font-bold mb-1 ${meta.color}`}>
            Requiere plan {meta.label}
          </div>
          <div className="text-xs text-slate-400 mb-4">
            {requiredPlan === "PRO"
              ? "Nito ✦ y el importador IA están disponibles en el plan Pro y Deluxe."
              : "Las inversiones, seguros y patrimonio avanzado son exclusivos del plan Deluxe."}
          </div>
          <button
            onClick={() => router.push("/upgrade")}
            className={`w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 active:scale-95 bg-gradient-to-r ${meta.gradient}`}>
            Ver planes →
          </button>
        </div>
      </div>
    </div>
  );
}
