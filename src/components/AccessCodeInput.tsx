// src/components/AccessCodeInput.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Props = {
  onSuccess?: (plan: string) => void;
  compact?: boolean;
};

type Preview = {
  valid: boolean;
  plan: string;
  duration_months: number | null;
  cupos_restantes: number;
};

const PLAN_META: Record<string, { label: string; color: string; icon: string; gradient: string }> = {
  PRO:    { label: "Pro",    color: "#60a5fa", icon: "⚡", gradient: "linear-gradient(135deg,#2563eb,#1e40af)" },
  DELUXE: { label: "Deluxe", color: "#fbbf24", icon: "✦", gradient: "linear-gradient(135deg,#d97706,#b45309)" },
};

function planLabel(plan: string, duration: number | null) {
  const meta = PLAN_META[plan];
  if (!meta) return plan;
  return `Plan ${meta.label}${duration ? ` · ${duration} meses` : " · Para siempre"}`;
}

export default function AccessCodeInput({ onSuccess, compact = false }: Props) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ plan: string; message: string } | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Preview con debounce
  useEffect(() => {
    setPreview(null);
    setError(null);
    if (code.trim().length < 3) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setPreviewing(true);
      try {
        const res = await fetch(`/api/access-code?code=${encodeURIComponent(code.trim().toUpperCase())}`);
        const data = await res.json();
        if (res.ok) setPreview(data);
        else setError(data.error ?? "Código inválido.");
      } catch { /* silencioso */ }
      finally { setPreviewing(false); }
    }, 600);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [code]);

  async function handleApply() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/access-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Código inválido."); return; }
      setSuccess({ plan: data.plan, message: data.message });
      setCode(""); setPreview(null);
      onSuccess?.(data.plan);
      setTimeout(() => router.refresh(), 1500);
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); handleApply(); }
  }

  const borderColor = error
    ? "1px solid rgba(239,68,68,0.4)"
    : preview?.valid ? "1px solid rgba(16,185,129,0.4)"
    : "1px solid rgba(255,255,255,0.08)";

  // ── Compacto (registro) ───────────────────────────────────────────────────
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setSuccess(null); }}
              onKeyDown={handleKeyDown}
              placeholder="Código de acceso (opcional)"
              maxLength={32}
              className="w-full px-3 py-2 rounded-lg text-sm bg-transparent outline-none transition-colors placeholder:text-slate-600 text-slate-200 font-mono"
              style={{ border: borderColor }}
            />
            {previewing && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
            )}
          </div>
          <button onClick={handleApply} disabled={!preview?.valid || loading}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)" }}>
            {loading ? "..." : "Aplicar"}
          </button>
        </div>

        {preview?.valid && !success && (
          <div className="flex items-center gap-2 text-xs px-1">
            <span style={{ color: PLAN_META[preview.plan]?.color }}>{PLAN_META[preview.plan]?.icon}</span>
            <span className="text-slate-300">{planLabel(preview.plan, preview.duration_months)}</span>
            <span className="text-slate-600">·</span>
            <span className={preview.cupos_restantes <= 2 ? "text-amber-400" : "text-slate-500"}>
              {preview.cupos_restantes} cupo{preview.cupos_restantes !== 1 ? "s" : ""}
            </span>
          </div>
        )}
        {error && <div className="text-xs text-red-400 px-1 flex items-center gap-1.5"><span>✕</span>{error}</div>}
        {success && <div className="text-xs text-emerald-400 px-1 flex items-center gap-1.5"><span>✓</span>{success.message}</div>}
      </div>
    );
  }

  // ── Completo (/upgrade) ───────────────────────────────────────────────────
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>

      <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-0.5">¿Tenés un código de acceso?</div>
        <div className="text-xs text-slate-500">Aplicá tu código para activar un plan gratuitamente.</div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {success ? (
          <div className="flex items-center gap-3 py-3 px-4 rounded-xl"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
              style={{ background: PLAN_META[success.plan]?.gradient }}>
              {PLAN_META[success.plan]?.icon ?? "✓"}
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-400">¡Código aplicado!</div>
              <div className="text-xs text-slate-400">{success.message}</div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  value={code}
                  onChange={e => { setCode(e.target.value.toUpperCase()); setSuccess(null); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Ej: FOUNDERS10"
                  maxLength={32}
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-transparent outline-none transition-all placeholder:text-slate-600 text-slate-200 font-mono tracking-widest"
                  style={{ border: borderColor, background: "rgba(255,255,255,0.02)" }}
                />
                {previewing && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
                )}
              </div>
              <button onClick={handleApply} disabled={!preview?.valid || loading}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: preview?.valid ? PLAN_META[preview.plan]?.gradient ?? "linear-gradient(135deg,#0d9488,#2563eb)" : "rgba(255,255,255,0.05)",
                  boxShadow: preview?.valid ? "0 4px 15px rgba(13,148,136,0.2)" : "none",
                }}>
                {loading ? "Aplicando..." : "Aplicar"}
              </button>
            </div>

            {/* Preview del código */}
            {preview?.valid && (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)" }}>
                <div className="flex items-center gap-2.5">
                  <span className="text-base" style={{ color: PLAN_META[preview.plan]?.color }}>
                    {PLAN_META[preview.plan]?.icon}
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{planLabel(preview.plan, preview.duration_months)}</div>
                    <div className="text-[10px] text-emerald-500">Código válido ✓</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold" style={{ color: preview.cupos_restantes <= 2 ? "#f59e0b" : "#34d399" }}>
                    {preview.cupos_restantes}
                  </div>
                  <div className="text-[10px] text-slate-600">cupo{preview.cupos_restantes !== 1 ? "s" : ""} left</div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 px-1"><span>✕</span>{error}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
