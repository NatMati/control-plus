// src/app/upgrade/UpgradeClient.tsx
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSubscription, type Plan } from "@/hooks/useSubscription";
import AccessCodeInput from "@/components/AccessCodeInput";

// ── Datos de planes ───────────────────────────────────────────────────────────

type PlanDef = {
  key: Plan;
  name: string;
  price: number | null;
  priceLabel: string;
  tagline: string;
  color: string;
  accent: string;
  gradient: string;
  icon: string;
  badge?: string;
  features: { text: string; included: boolean; highlight?: boolean }[];
};

const PLANS: PlanDef[] = [
  {
    key: "FREE",
    name: "Free",
    price: 0,
    priceLabel: "Gratis",
    tagline: "Para empezar a ordenarte",
    color: "text-slate-300",
    accent: "rgba(148,163,184,0.15)",
    gradient: "from-slate-700 to-slate-800",
    icon: "○",
    features: [
      { text: "Hasta 50 movimientos / mes", included: true },
      { text: "Múltiples cuentas", included: true },
      { text: "Módulo de deudas", included: true },
      { text: "Transferencias entre cuentas", included: true },
      { text: "Nito ✦ asistente IA", included: false },
      { text: "Importador IA de estados de cuenta", included: false },
      { text: "Movimientos ilimitados", included: false },
      { text: "Inversiones y seguros", included: false },
    ],
  },
  {
    key: "PRO",
    name: "Pro",
    price: 8,
    priceLabel: "U$S 8",
    tagline: "Para tomar control total",
    color: "text-blue-400",
    accent: "rgba(59,130,246,0.12)",
    gradient: "from-blue-600 to-blue-800",
    icon: "⚡",
    badge: "Más popular",
    features: [
      { text: "Movimientos ilimitados", included: true, highlight: true },
      { text: "Múltiples cuentas", included: true },
      { text: "Módulo de deudas", included: true },
      { text: "Transferencias entre cuentas", included: true },
      { text: "Nito ✦ completo (con adjuntar archivos)", included: true, highlight: true },
      { text: "Importador IA de estados de cuenta", included: true, highlight: true },
      { text: "Inversiones y seguros", included: false },
      { text: "Patrimonio neto avanzado", included: false },
    ],
  },
  {
    key: "DELUXE",
    name: "Deluxe",
    price: 15,
    priceLabel: "U$S 15",
    tagline: "Para patrimonios complejos",
    color: "text-amber-400",
    accent: "rgba(245,158,11,0.1)",
    gradient: "from-amber-500 to-orange-700",
    icon: "✦",
    badge: "High ticket",
    features: [
      { text: "Todo lo de Pro", included: true, highlight: true },
      { text: "Módulo de inversiones (acciones, ETFs, cripto)", included: true, highlight: true },
      { text: "Seguros y coberturas", included: true, highlight: true },
      { text: "Patrimonio neto avanzado", included: true, highlight: true },
      { text: "Nito con contexto de inversiones", included: true, highlight: true },
      { text: "Reportes avanzados", included: true },
      { text: "Soporte prioritario", included: true },
      { text: "Acceso anticipado a nuevas features", included: true },
    ],
  },
];

// ── Componente ────────────────────────────────────────────────────────────────

export default function UpgradeClient() {
  const { plan: currentPlan, loading, status, current_period_end, cancel_at_period_end } = useSubscription();
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  const [checkoutLoading, setCheckoutLoading] = useState<Plan | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  async function handleCheckout(plan: Plan) {
    if (plan === "FREE") return;
    setCheckoutLoading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setPortalLoading(false);
    }
  }

  function periodEndLabel() {
    if (!current_period_end) return null;
    return new Date(current_period_end).toLocaleDateString("es-UY", { day: "numeric", month: "long", year: "numeric" });
  }

  return (
    <div className="min-h-screen px-4 py-10"
      style={{ background: "linear-gradient(160deg,#040916 0%,#060d1f 60%,#050b18 100%)" }}>

      {/* Fondo decorativo */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full opacity-[0.05]"
          style={{ background: "radial-gradient(ellipse,#2dd4bf 0%,transparent 70%)" }} />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(ellipse,#f59e0b 0%,transparent 70%)" }} />
        <div className="absolute inset-0 opacity-[0.015]"
          style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
      </div>

      <div className="relative max-w-5xl mx-auto">

        {/* Banner éxito / cancelado */}
        {success && (
          <div className="mb-8 px-5 py-4 rounded-2xl text-sm text-emerald-300 flex items-center gap-3"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <span className="text-lg">✓</span>
            <span><strong>¡Suscripción activada!</strong> Ya tenés acceso a todas las features de tu plan.</span>
          </div>
        )}
        {canceled && (
          <div className="mb-8 px-5 py-4 rounded-2xl text-sm text-amber-300 flex items-center gap-3"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <span className="text-lg">○</span>
            <span>Cancelaste el proceso de pago. Podés intentarlo cuando quieras.</span>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-teal-400 mb-4"
            style={{ border: "1px solid rgba(13,148,136,0.3)", background: "rgba(13,148,136,0.08)" }}>
            <span>✦</span> Control+ Planes
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Elegí tu plan</h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Desde ordenar tus finanzas hasta gestionar inversiones y patrimonio. Escalá cuando estés listo.
          </p>
        </div>

        {/* Plan actual */}
        {!loading && currentPlan !== "FREE" && (
          <div className="mb-8 px-5 py-4 rounded-2xl flex items-center justify-between gap-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div>
              <div className="text-xs text-slate-500 mb-0.5">Tu plan actual</div>
              <div className={`text-sm font-bold ${PLANS.find(p => p.key === currentPlan)?.color}`}>
                Control+ {currentPlan}
                {cancel_at_period_end && (
                  <span className="ml-2 text-xs text-amber-400 font-normal">
                    · Cancela el {periodEndLabel()}
                  </span>
                )}
              </div>
            </div>
            <button onClick={handlePortal} disabled={portalLoading}
              className="text-xs px-4 py-2 rounded-xl text-slate-300 hover:text-white transition-colors disabled:opacity-50"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
              {portalLoading ? "Cargando..." : "Gestionar suscripción →"}
            </button>
          </div>
        )}

        {/* Cards de planes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((p) => {
            const isCurrent = currentPlan === p.key;
            const isDowngrade = currentPlan !== "FREE" &&
              (currentPlan === "DELUXE" && p.key === "PRO") ||
              (currentPlan !== "FREE" && p.key === "FREE");

            return (
              <div key={p.key}
                className="relative rounded-2xl overflow-hidden flex flex-col transition-all hover:-translate-y-0.5"
                style={{
                  border: isCurrent
                    ? `1px solid rgba(${p.key === "PRO" ? "59,130,246" : p.key === "DELUXE" ? "245,158,11" : "148,163,184"},0.4)`
                    : "1px solid rgba(255,255,255,0.07)",
                  background: `rgba(255,255,255,0.02)`,
                  boxShadow: isCurrent ? `0 0 40px ${p.accent}` : "none",
                }}>

                {/* Badge */}
                {p.badge && (
                  <div className={`absolute top-4 right-4 text-[10px] font-bold px-2.5 py-1 rounded-full bg-gradient-to-r ${p.gradient} text-white`}>
                    {p.badge}
                  </div>
                )}

                {/* Header de la card */}
                <div className="px-6 pt-6 pb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className={`text-2xl mb-2 ${p.color}`}>{p.icon}</div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-2xl font-bold text-white">{p.priceLabel}</span>
                    {p.price !== null && p.price > 0 && (
                      <span className="text-xs text-slate-500">/ mes</span>
                    )}
                  </div>
                  <div className={`text-sm font-semibold mb-1 ${p.color}`}>{p.name}</div>
                  <div className="text-xs text-slate-500">{p.tagline}</div>
                </div>

                {/* Features */}
                <div className="px-6 py-5 flex-1 space-y-2.5">
                  {p.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className={`mt-0.5 text-xs shrink-0 ${f.included ? (f.highlight ? p.color : "text-emerald-400") : "text-slate-700"}`}>
                        {f.included ? "✓" : "×"}
                      </span>
                      <span className={`text-xs ${f.included ? (f.highlight ? "text-slate-200 font-medium" : "text-slate-300") : "text-slate-600"}`}>
                        {f.text}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="px-6 pb-6">
                  {isCurrent ? (
                    <div className="w-full py-2.5 rounded-xl text-xs font-bold text-center"
                      style={{ border: `1px solid rgba(${p.key === "PRO" ? "59,130,246" : p.key === "DELUXE" ? "245,158,11" : "148,163,184"},0.3)`, color: p.key === "FREE" ? "#94a3b8" : p.key === "PRO" ? "#60a5fa" : "#fbbf24" }}>
                      Plan actual ✓
                    </div>
                  ) : p.key === "FREE" ? (
                    <div className="w-full py-2.5 rounded-xl text-xs text-center text-slate-600">
                      {currentPlan !== "FREE" ? "Cancelar suscripción en portal →" : "Plan gratuito"}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleCheckout(p.key)}
                      disabled={checkoutLoading !== null || loading}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r ${p.gradient}`}
                      style={{ boxShadow: `0 4px 20px ${p.accent}` }}>
                      {checkoutLoading === p.key
                        ? "Redirigiendo..."
                        : isDowngrade
                        ? `Cambiar a ${p.name}`
                        : `Suscribirse a ${p.name} →`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Código de acceso */}
        <div className="mt-8 max-w-lg mx-auto">
          <AccessCodeInput />
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-slate-600 space-y-1">
          <div>Pagos procesados por Stripe · Cancelá cuando quieras sin penalidades</div>
          <div>Los precios son en dólares americanos (USD)</div>
        </div>
      </div>
    </div>
  );
}
