"use client";

import { useState, useRef, useEffect } from "react";
import { useSettings } from "@/context/SettingsContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  Globe2, Coins, ArrowLeftRight, Copy, Check,
  LogOut, Settings, ChevronDown, User, Shield,
  Zap, Star, RefreshCw,
} from "lucide-react";

const PLAN_META = {
  FREE:   { label: "Free",   icon: null, color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.15)" },
  PRO:    { label: "Pro",    icon: Zap,  color: "#60a5fa", bg: "rgba(59,130,246,0.10)",  border: "rgba(59,130,246,0.25)" },
  DELUXE: { label: "Deluxe", icon: Star, color: "#fbbf24", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.25)" },
};

type Tab = "cuenta" | "moneda" | "fx";

export default function TopNav() {
  const router   = useRouter();
  const { currency, setCurrency, lang, setLang, convert, ratesLoading, ratesUpdatedAt } = useSettings();
  const { plan } = useSubscription();
  const planMeta = PLAN_META[plan] ?? PLAN_META.FREE;

  const [open,       setOpen]       = useState(false);
  const [tab,        setTab]        = useState<Tab>("cuenta");
  const [copied,     setCopied]     = useState(false);
  const [email,      setEmail]      = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function handleCopyFx() {
    const targets = ["EUR", "UYU", "ARS", "BRL"] as const;
    const lines = targets.map(c => `1 USD = ${convert(1, { from: "USD", to: c }).toFixed(2)} ${c}`);
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const fxTargets = [
    { from: "USD", to: "UYU" },
    { from: "USD", to: "EUR" },
    { from: "USD", to: "ARS" },
    { from: "USD", to: "BRL" },
    { from: "EUR", to: "UYU" },
  ] as const;

  const initials = email ? email[0].toUpperCase() : "U";

  // Formato legible de la fecha de actualización
  const ratesDateLabel = ratesUpdatedAt
    ? new Date(ratesUpdatedAt + "T12:00:00").toLocaleDateString("es-UY", { day: "2-digit", month: "short" })
    : null;

  return (
    <header style={{ background: "#020617", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 md:px-6">

        <div className="flex items-center gap-2 md:hidden">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white"
            style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)" }}>
            C+
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/upgrade")}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all hover:opacity-80"
            style={{ background: planMeta.bg, border: `1px solid ${planMeta.border}`, color: planMeta.color }}>
            {planMeta.icon && <planMeta.icon className="w-3 h-3" />}
            {planMeta.label}
          </button>

          <div className="relative" ref={menuRef}>
            <button onClick={() => setOpen(v => !v)}
              className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full transition-all hover:bg-white/5"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)" }}>
                {initials}
              </div>
              {email && (
                <span className="hidden md:block text-xs text-slate-400 max-w-[120px] truncate">{email}</span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
              <div className="absolute right-0 z-50 mt-2 w-[300px] rounded-2xl overflow-hidden shadow-2xl"
                style={{
                  background: "linear-gradient(160deg,#060e20,#040c1a)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                }}>

                {/* Header */}
                <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)", boxShadow: "0 0 20px rgba(13,148,136,0.3)" }}>
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{email ?? "Usuario"}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: planMeta.bg, border: `1px solid ${planMeta.border}`, color: planMeta.color }}>
                          {planMeta.icon && <planMeta.icon className="w-2.5 h-2.5 inline mr-1" />}
                          Plan {planMeta.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex px-3 pt-3 pb-1 gap-1">
                  {([
                    { key: "cuenta", label: "Cuenta", icon: User },
                    { key: "moneda", label: "Moneda", icon: Coins },
                    { key: "fx",     label: "FX",     icon: ArrowLeftRight },
                  ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setTab(key)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                      style={{
                        background: tab === key ? "rgba(255,255,255,0.08)" : "transparent",
                        color: tab === key ? "white" : "rgba(148,163,184,0.7)",
                        border: tab === key ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
                      }}>
                      <Icon className="w-3 h-3" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Contenido tabs */}
                <div className="px-3 pb-3 pt-1">

                  {/* Cuenta */}
                  {tab === "cuenta" && (
                    <div className="space-y-1 pt-1">
                      <MenuItem icon={Settings} label="Configuración" onClick={() => { router.push("/settings"); setOpen(false); }} />
                      {plan === "FREE" && (
                        <MenuItem icon={Zap} label="Mejorar plan" accent onClick={() => { router.push("/upgrade"); setOpen(false); }} />
                      )}
                      <MenuItem icon={Shield} label="Privacidad" onClick={() => { router.push("/privacidad"); setOpen(false); }} />
                      <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <MenuItem icon={LogOut} label={loggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
                          danger onClick={handleLogout} disabled={loggingOut} />
                      </div>
                    </div>
                  )}

                  {/* Moneda */}
                  {tab === "moneda" && (
                    <div className="pt-2 space-y-3">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Globe2 className="w-3 h-3 text-slate-500" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Idioma</span>
                        </div>
                        <div className="flex gap-1.5">
                          {(["ES", "EN", "PT"] as const).map(L => (
                            <button key={L} onClick={() => setLang(L)}
                              className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                              style={{
                                background: L === lang ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)",
                                border: L === lang ? "1px solid rgba(59,130,246,0.35)" : "1px solid rgba(255,255,255,0.07)",
                                color: L === lang ? "#93c5fd" : "#94a3b8",
                              }}>
                              {L === lang && <Check className="w-2.5 h-2.5 inline mr-1" />}{L}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Coins className="w-3 h-3 text-slate-500" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Moneda principal</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(["USD", "EUR", "UYU", "ARS", "BRL"] as const).map(C => (
                            <button key={C} onClick={() => setCurrency(C)}
                              className="py-1.5 rounded-lg text-xs font-medium transition-all"
                              style={{
                                background: C === currency ? "rgba(13,148,136,0.15)" : "rgba(255,255,255,0.04)",
                                border: C === currency ? "1px solid rgba(13,148,136,0.35)" : "1px solid rgba(255,255,255,0.07)",
                                color: C === currency ? "#2dd4bf" : "#94a3b8",
                              }}>
                              {C === currency && <Check className="w-2.5 h-2.5 inline mr-1" />}{C}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* FX */}
                  {tab === "fx" && (
                    <div className="pt-2 space-y-2">
                      {/* Indicador de fecha */}
                      <div className="flex items-center justify-between text-[10px] px-1"
                        style={{ color: "rgba(100,116,139,0.7)" }}>
                        <span className="flex items-center gap-1">
                          <RefreshCw className="w-2.5 h-2.5"/>
                          {ratesLoading
                            ? "Actualizando…"
                            : ratesDateLabel
                            ? `Actualizado ${ratesDateLabel}`
                            : "Tasas aproximadas"}
                        </span>
                        <span className="text-slate-700">Base: USD</span>
                      </div>

                      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                        {fxTargets.map(({ from, to }, i) => (
                          <div key={`${from}-${to}`}
                            className="flex items-center justify-between px-3 py-2 text-xs"
                            style={{
                              borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none",
                              background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                            }}>
                            <span className="text-slate-500">1 {from}</span>
                            <span className="text-slate-300 font-medium font-mono">
                              {convert(1, { from, to }).toFixed(2)}{" "}
                              <span className="text-slate-500">{to}</span>
                            </span>
                          </div>
                        ))}
                      </div>

                      <button onClick={handleCopyFx}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8" }}>
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? "¡Copiado!" : "Copiar tasas"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger, accent, disabled }: {
  icon: any; label: string; onClick?: () => void;
  danger?: boolean; accent?: boolean; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ color: danger ? "#f87171" : accent ? "#2dd4bf" : "#94a3b8", background: "transparent" }}
      onMouseEnter={e=>(e.currentTarget.style.background=danger?"rgba(239,68,68,0.08)":accent?"rgba(13,148,136,0.08)":"rgba(255,255,255,0.05)")}
      onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {label}
    </button>
  );
}
