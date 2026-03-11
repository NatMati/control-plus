// src/app/planes/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PLANS = [
  {
    key: "FREE",
    name: "Free",
    priceLabel: "Gratis",
    price: 0,
    tagline: "Para empezar a ordenarte",
    icon: "○",
    color: "#94a3b8",
    border: "rgba(148,163,184,0.2)",
    glow: "rgba(148,163,184,0.05)",
    gradient: "linear-gradient(135deg,#475569,#334155)",
    features: [
      "Hasta 50 movimientos / mes",
      "Múltiples cuentas",
      "Módulo de deudas",
      "Transferencias entre cuentas",
    ],
    notIncluded: [
      "Nito ✦ asistente IA",
      "Importador IA",
      "Movimientos ilimitados",
      "Inversiones y seguros",
    ],
  },
  {
    key: "PRO",
    name: "Pro",
    priceLabel: "U$S 8",
    price: 8,
    tagline: "Para tomar control total",
    icon: "⚡",
    badge: "Más popular",
    color: "#60a5fa",
    border: "rgba(59,130,246,0.35)",
    glow: "rgba(59,130,246,0.12)",
    gradient: "linear-gradient(135deg,#2563eb,#1e40af)",
    features: [
      "Movimientos ilimitados",
      "Múltiples cuentas",
      "Módulo de deudas",
      "Transferencias entre cuentas",
      "Nito ✦ completo (con archivos)",
      "Importador IA de estados de cuenta",
    ],
    notIncluded: [
      "Inversiones y seguros",
      "Patrimonio avanzado",
    ],
  },
  {
    key: "DELUXE",
    name: "Deluxe",
    priceLabel: "U$S 15",
    price: 15,
    tagline: "Para patrimonios complejos",
    icon: "✦",
    badge: "High ticket",
    color: "#fbbf24",
    border: "rgba(245,158,11,0.35)",
    glow: "rgba(245,158,11,0.1)",
    gradient: "linear-gradient(135deg,#d97706,#b45309)",
    features: [
      "Todo lo de Pro",
      "Inversiones (acciones, ETFs, cripto)",
      "Seguros y coberturas",
      "Patrimonio neto avanzado",
      "Nito con contexto de inversiones",
      "Reportes avanzados",
      "Soporte prioritario",
      "Acceso anticipado a nuevas features",
    ],
    notIncluded: [],
  },
];

export default function PlanesPage() {
  const router = useRouter();
  const [hovering, setHovering] = useState<string | null>(null);

  return (
    <div className="min-h-screen"
      style={{ background: "linear-gradient(160deg,#020810 0%,#040d1c 60%,#030a15 100%)", fontFamily: "'Inter', sans-serif" }}>

      {/* Fondo */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px]"
          style={{ background: "radial-gradient(ellipse,rgba(13,148,136,0.06) 0%,transparent 70%)" }} />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px]"
          style={{ background: "radial-gradient(ellipse,rgba(245,158,11,0.04) 0%,transparent 70%)" }} />
        <div className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
      </div>

      {/* Nav */}
      <nav className="relative flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <button onClick={() => router.push("/")} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)" }}>C+</div>
          <span className="text-white font-bold text-sm tracking-wide">Control+</span>
        </button>
        <button onClick={() => router.push("/login")}
          className="text-xs text-slate-400 hover:text-white transition-colors px-4 py-2 rounded-xl"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          Iniciar sesión →
        </button>
      </nav>

      <div className="relative max-w-6xl mx-auto px-6 pb-20">

        {/* Hero */}
        <div className="text-center py-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs text-teal-400 mb-6"
            style={{ border: "1px solid rgba(13,148,136,0.25)", background: "rgba(13,148,136,0.06)" }}>
            ✦ Finanzas personales inteligentes
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
            Un plan para cada
            <span style={{ WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", background: "linear-gradient(90deg,#0d9488,#3b82f6)" }}
              className="bg-clip-text"> momento</span>
          </h1>
          <p className="text-slate-400 text-base max-w-lg mx-auto leading-relaxed">
            Desde ordenar tus gastos hasta gestionar inversiones y patrimonio.
            Cancelá cuando quieras, sin compromisos.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((p) => (
            <div key={p.key}
              onMouseEnter={() => setHovering(p.key)}
              onMouseLeave={() => setHovering(null)}
              className="relative rounded-3xl overflow-hidden flex flex-col transition-all duration-300"
              style={{
                border: `1px solid ${hovering === p.key ? p.border : "rgba(255,255,255,0.06)"}`,
                background: "rgba(255,255,255,0.02)",
                boxShadow: hovering === p.key ? `0 20px 60px ${p.glow}` : "none",
                transform: hovering === p.key ? "translateY(-4px)" : "translateY(0)",
              }}>

              {p.badge && (
                <div className="absolute top-5 right-5 text-[10px] font-bold px-2.5 py-1 rounded-full text-white"
                  style={{ background: p.gradient }}>
                  {p.badge}
                </div>
              )}

              {/* Header */}
              <div className="px-7 pt-7 pb-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="text-3xl mb-3" style={{ color: p.color }}>{p.icon}</div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-3xl font-black text-white">{p.priceLabel}</span>
                  {p.price > 0 && <span className="text-xs text-slate-500">/ mes</span>}
                </div>
                <div className="text-sm font-bold mb-0.5" style={{ color: p.color }}>{p.name}</div>
                <div className="text-xs text-slate-500">{p.tagline}</div>
              </div>

              {/* Features */}
              <div className="px-7 py-6 flex-1 space-y-2.5">
                {p.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                    <span className="shrink-0 mt-0.5" style={{ color: p.color }}>✓</span>
                    <span>{f}</span>
                  </div>
                ))}
                {p.notIncluded.map((f, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-slate-600">
                    <span className="shrink-0 mt-0.5">×</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="px-7 pb-7">
                <button
                  onClick={() => router.push(p.key === "FREE" ? "/register" : `/register?plan=${p.key.toLowerCase()}`)}
                  className="w-full py-3 rounded-2xl text-sm font-bold transition-all hover:opacity-90 active:scale-95"
                  style={p.key === "FREE"
                    ? { border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", background: "transparent" }
                    : { background: p.gradient, color: "white", boxShadow: `0 8px 25px ${p.glow}` }}>
                  {p.key === "FREE" ? "Empezar gratis" : `Empezar con ${p.name} →`}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ / Garantías */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          {[
            { icon: "🔒", title: "Sin tarjeta para Free", desc: "El plan gratuito no requiere datos de pago." },
            { icon: "↩", title: "Cancelá cuando quieras", desc: "Sin penalidades ni períodos mínimos." },
            { icon: "🇺🇾", title: "Hecho en Uruguay", desc: "Diseñado para las necesidades del mercado local." },
          ].map((item, i) => (
            <div key={i} className="px-5 py-5 rounded-2xl"
              style={{ border: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.01)" }}>
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="text-sm font-semibold text-slate-200 mb-1">{item.title}</div>
              <div className="text-xs text-slate-500">{item.desc}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-slate-700">
          Pagos procesados por Stripe · Precios en USD · Control+ © 2025
        </div>
      </div>
    </div>
  );
}
