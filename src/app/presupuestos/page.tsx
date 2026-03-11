// src/app/presupuestos/page.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useBudgets } from "@/context/BudgetsContext";
import { useSettings } from "@/context/SettingsContext";
import { useAccounts } from "@/context/AccountsContext";
import {
  ChevronLeft, ChevronRight, Plus, TrendingUp,
  TrendingDown, Wallet, AlertTriangle, CheckCircle2,
  XCircle, Info,
} from "lucide-react";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function getCurrentYM(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
}
function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function fmtMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m-1, 1).toLocaleDateString("es-UY", { month: "long", year: "numeric" });
}
function fmtMonthShort(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m-1, 1).toLocaleDateString("es-UY", { month: "short", year: "2-digit" });
}

// ─── ATOMS ────────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color, glow }: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; color: string; glow: string;
}) {
  return (
    <div className="relative rounded-2xl p-4 overflow-hidden flex flex-col gap-2"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl pointer-events-none"
        style={{ background: glow, opacity: 0.18 }} />
      <div className="relative z-10 flex items-center justify-between">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
          {icon}
        </div>
      </div>
      <div className="relative z-10">
        <div className="text-xl font-bold text-white tabular-nums leading-none">{value}</div>
        {sub && <div className="text-[11px] text-slate-600 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

// Barra de progreso con overflow indicator
function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.min(pct, 100);
  const overflow = pct > 100;
  return (
    <div className="relative h-1.5 rounded-full overflow-hidden w-full"
      style={{ background: "rgba(255,255,255,0.06)" }}>
      <div className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${clamped}%`,
          background: overflow
            ? "linear-gradient(90deg,#f87171,#ef4444)"
            : pct >= 80
            ? "linear-gradient(90deg,#fbbf24,#f59e0b)"
            : `linear-gradient(90deg,${color},${color}cc)`,
        }} />
      {overflow && (
        <div className="absolute inset-0 flex items-center justify-end pr-1">
          <div className="w-1 h-1 rounded-full bg-rose-400 animate-pulse" />
        </div>
      )}
    </div>
  );
}

// Badge estado
function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
    "Muy pasado": { color: "#fca5a5", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.2)",  icon: <XCircle className="w-2.5 h-2.5"/> },
    "Superado":   { color: "#fca5a5", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.15)", icon: <XCircle className="w-2.5 h-2.5"/> },
    "Alto":       { color: "#fcd34d", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)", icon: <AlertTriangle className="w-2.5 h-2.5"/> },
    "En curso":   { color: "#6ee7b7", bg: "rgba(52,211,153,0.08)",border: "rgba(52,211,153,0.15)",icon: <CheckCircle2 className="w-2.5 h-2.5"/> },
    "Sin monto":  { color: "#64748b", bg: "rgba(100,116,139,0.1)",border: "rgba(100,116,139,0.2)",icon: <Info className="w-2.5 h-2.5"/> },
  };
  const s = map[estado] ?? map["En curso"];
  return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
      {s.icon}{estado}
    </span>
  );
}

// Selector de mes con navegación por flechas
function MonthNav({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const curYM = getCurrentYM();
  const isMax = value >= curYM;

  return (
    <div className="flex items-center gap-1 rounded-xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <button onClick={() => onChange(addMonths(value, -1))}
        className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-all">
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <div className="px-3 text-xs font-semibold text-white capitalize min-w-[120px] text-center">
        {fmtMonthLabel(value)}
      </div>
      <button onClick={() => !isMax && onChange(addMonths(value, 1))}
        disabled={isMax}
        className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-all disabled:opacity-25">
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// Mini sparkline de uso histórico (últimos 6 meses)
function UsageSparkline({ data }: { data: number[] }) {
  if (!data.length) return null;
  const max = Math.max(...data, 100);
  const W = 56, H = 18;
  const step = W / (data.length - 1 || 1);
  const points = data.map((v, i) => `${i * step},${H - (v / max) * H}`).join(" ");
  return (
    <svg width={W} height={H} className="shrink-0">
      <polyline points={points} fill="none" stroke="rgba(99,102,241,0.6)" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function PresupuestosPage() {
  const { budgets, getBudgetsForMonth } = useBudgets();
  const { convert, format, currency: baseCurrency } = useSettings();
  const { movements } = useAccounts();

  const curYM = getCurrentYM();
  const [selectedMonth, setSelectedMonth] = useState(curYM);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Últimos 6 meses para sparklines
  const last6 = useMemo(() => {
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) months.push(addMonths(selectedMonth, -i));
    return months;
  }, [selectedMonth]);

  const budgetsForMonth = useMemo(
    () => getBudgetsForMonth(selectedMonth),
    [getBudgetsForMonth, selectedMonth]
  );

  const gastosDelMes = useMemo(
    () => movements.filter(m => m.type === "GASTO" && m.date.slice(0, 7) === selectedMonth),
    [movements, selectedMonth]
  );

  // Filas por categoría
  const categoryRows = useMemo(() => {
    return budgetsForMonth.map(b => {
      const limitInBase = convert(b.limit, { from: b.currency, to: baseCurrency });

      const spentInBase = gastosDelMes.reduce((acc, mov) => {
        if ((mov.category ?? "").trim().toLowerCase() !== b.category.trim().toLowerCase()) return acc;
        return acc + convert(mov.amount, { from: mov.currency, to: baseCurrency });
      }, 0);

      const percentUsed = limitInBase > 0 ? (spentInBase / limitInBase) * 100 : 0;
      const remaining   = limitInBase - spentInBase;

      // Sparkline: % usado en cada uno de los últimos 6 meses
      const sparkData = last6.map(ym => {
        const bMonth = getBudgetsForMonth(ym).find(
          x => x.category.trim().toLowerCase() === b.category.trim().toLowerCase()
        );
        if (!bMonth) return 0;
        const lim = convert(bMonth.limit, { from: bMonth.currency, to: baseCurrency });
        const spent = movements
          .filter(m => m.type === "GASTO" && m.date.slice(0, 7) === ym &&
            (m.category ?? "").trim().toLowerCase() === b.category.trim().toLowerCase())
          .reduce((a, m) => a + convert(m.amount, { from: m.currency, to: baseCurrency }), 0);
        return lim > 0 ? (spent / lim) * 100 : 0;
      });

      const estado =
        limitInBase === 0   ? "Sin monto" :
        percentUsed >= 110  ? "Muy pasado" :
        percentUsed >= 100  ? "Superado" :
        percentUsed >= 80   ? "Alto" : "En curso";

      return { id: b.id, category: b.category, currency: b.currency,
        limitInBase, spentInBase, percentUsed, remaining, estado, sparkData };
    });
  }, [budgetsForMonth, gastosDelMes, convert, baseCurrency, last6, getBudgetsForMonth, movements]);

  // Totales
  const { totalLimit, totalSpent, totalPct } = useMemo(() => {
    const totalLimit = categoryRows.reduce((a, r) => a + r.limitInBase, 0);
    const totalSpent = categoryRows.reduce((a, r) => a + r.spentInBase, 0);
    return { totalLimit, totalSpent, totalPct: totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0 };
  }, [categoryRows]);

  const remaining = totalLimit - totalSpent;

  // Categorías sin presupuesto pero con gasto
  const unbudgeted = useMemo(() => {
    const set = new Set(budgetsForMonth.map(b => b.category.trim().toLowerCase()));
    const map = new Map<string, number>();
    for (const g of gastosDelMes) {
      const cat = (g.category ?? "").trim();
      if (!cat || set.has(cat.toLowerCase())) continue;
      map.set(cat, (map.get(cat) ?? 0) + convert(g.amount, { from: g.currency, to: baseCurrency }));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [gastosDelMes, budgetsForMonth, convert, baseCurrency]);

  // Alertas
  const overBudget  = categoryRows.filter(r => r.percentUsed >= 100);
  const nearLimit   = categoryRows.filter(r => r.percentUsed >= 80 && r.percentUsed < 100);
  const hasAlerts   = overBudget.length > 0 || nearLimit.length > 0 || unbudgeted.length > 0;

  // Color de la barra general
  const globalColor = totalPct >= 100 ? "#f87171" : totalPct >= 80 ? "#fbbf24" : "#34d399";

  return (
    <div className="px-4 md:px-6 py-5 md:py-6 space-y-5 max-w-screen-xl mx-auto">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white tracking-tight">Presupuestos</h1>
          <p className="text-xs text-slate-600 mt-1 capitalize">{fmtMonthLabel(selectedMonth)}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <MonthNav value={selectedMonth} onChange={setSelectedMonth} />
          <Link href={`/presupuestos/nuevo?month=${selectedMonth}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-white transition-all"
            style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)" }}>
            <Plus className="w-3.5 h-3.5" /> Nuevo presupuesto
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard label="Presupuestado" value={format(totalLimit)}
          sub={`${budgetsForMonth.length} categorías`}
          icon={<Wallet className="w-3.5 h-3.5" style={{ color: "#60a5fa" }} />}
          color="#60a5fa" glow="rgba(96,165,250,0.6)" />
        <KpiCard label="Gastado" value={format(totalSpent)}
          sub={`${gastosDelMes.length} movimientos`}
          icon={<TrendingDown className="w-3.5 h-3.5" style={{ color: "#f87171" }} />}
          color="#f87171" glow="rgba(248,113,113,0.6)" />
        <KpiCard label="Disponible" value={format(Math.max(0, remaining))}
          sub={remaining < 0 ? `Exceso: ${format(Math.abs(remaining))}` : "para gastar"}
          icon={<TrendingUp className="w-3.5 h-3.5" style={{ color: remaining >= 0 ? "#34d399" : "#f87171" }} />}
          color={remaining >= 0 ? "#34d399" : "#f87171"}
          glow={remaining >= 0 ? "rgba(52,211,153,0.5)" : "rgba(248,113,113,0.5)"} />

        {/* Card progreso global */}
        <div className="relative rounded-2xl p-4 overflow-hidden flex flex-col gap-2"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl pointer-events-none"
            style={{ background: `${globalColor}99`, opacity: 0.2 }} />
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Uso global</span>
            <span className="text-xs font-bold tabular-nums" style={{ color: globalColor }}>
              {totalPct.toFixed(0)}%
            </span>
          </div>
          <div className="relative z-10 flex-1 flex flex-col justify-end gap-2">
            <ProgressBar pct={totalPct} color={globalColor} />
            <div className="text-[11px] text-slate-600">
              {totalPct >= 100 ? "Presupuesto superado" :
               totalPct >= 80  ? "Cerca del límite" :
               "En buen ritmo"}
            </div>
          </div>
        </div>
      </div>

      {/* ALERTAS — solo si hay algo que reportar */}
      {hasAlerts && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {overBudget.length > 0 && (
            <div className="rounded-2xl px-4 py-3.5"
              style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-xs font-semibold text-rose-300">Superaron el límite</span>
              </div>
              <div className="space-y-1">
                {overBudget.slice(0, 4).map(r => (
                  <div key={r.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 truncate">{r.category}</span>
                    <span className="text-rose-400 font-semibold tabular-nums shrink-0 ml-2">{r.percentUsed.toFixed(0)}%</span>
                  </div>
                ))}
                {overBudget.length > 4 && <div className="text-[10px] text-slate-600">+{overBudget.length - 4} más</div>}
              </div>
            </div>
          )}

          {nearLimit.length > 0 && (
            <div className="rounded-2xl px-4 py-3.5"
              style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-amber-300">Cerca del límite</span>
              </div>
              <div className="space-y-1">
                {nearLimit.slice(0, 4).map(r => (
                  <div key={r.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 truncate">{r.category}</span>
                    <span className="text-amber-400 font-semibold tabular-nums shrink-0 ml-2">{r.percentUsed.toFixed(0)}%</span>
                  </div>
                ))}
                {nearLimit.length > 4 && <div className="text-[10px] text-slate-600">+{nearLimit.length - 4} más</div>}
              </div>
            </div>
          )}

          {unbudgeted.length > 0 && (
            <div className="rounded-2xl px-4 py-3.5"
              style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-semibold text-indigo-300">Sin presupuesto asignado</span>
              </div>
              <div className="space-y-1">
                {unbudgeted.slice(0, 4).map(([cat, val]) => (
                  <div key={cat} className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 truncate">{cat}</span>
                    <span className="text-indigo-400 font-semibold tabular-nums shrink-0 ml-2">{format(val)}</span>
                  </div>
                ))}
                {unbudgeted.length > 4 && <div className="text-[10px] text-slate-600">+{unbudgeted.length - 4} más</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TABLA CATEGORÍAS */}
      <div className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}>
          <div>
            <div className="text-sm font-semibold text-white">Por categoría</div>
            <div className="text-[11px] text-slate-600 mt-0.5">{categoryRows.length} categorías activas este mes</div>
          </div>
        </div>

        {categoryRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <Wallet className="w-8 h-8 text-slate-700" />
            <div className="text-sm text-slate-600">Sin presupuestos configurados</div>
            <Link href={`/presupuestos/nuevo?month=${selectedMonth}`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white mt-1"
              style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)" }}>
              <Plus className="w-3.5 h-3.5" /> Crear presupuesto
            </Link>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            {/* Header tabla */}
            <div className="hidden sm:grid grid-cols-12 px-5 py-2 text-[10px] uppercase tracking-widest text-slate-700"
              style={{ background: "rgba(255,255,255,0.01)" }}>
              <div className="col-span-3">Categoría</div>
              <div className="col-span-2 text-right">Límite</div>
              <div className="col-span-2 text-right">Gastado</div>
              <div className="col-span-3 px-3">Progreso</div>
              <div className="col-span-1 text-center">Tendencia</div>
              <div className="col-span-1 text-right">Estado</div>
            </div>

            {categoryRows.map(r => {
              const isExpanded = expandedId === r.id;
              const barColor =
                r.percentUsed >= 100 ? "#f87171" :
                r.percentUsed >= 80  ? "#fbbf24" : "#34d399";

              return (
                <div key={r.id}>
                  {/* Fila principal */}
                  <button
                    className="w-full text-left transition-colors"
                    style={{ background: "transparent" }}
                    onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.014)")}
                    onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>

                    {/* Desktop */}
                    <div className="hidden sm:grid grid-cols-12 items-center px-5 py-3.5 gap-2">
                      <div className="col-span-3">
                        <div className="text-sm font-medium text-white">{r.category}</div>
                      </div>
                      <div className="col-span-2 text-right text-xs text-slate-400 tabular-nums">
                        {format(r.limitInBase)}
                      </div>
                      <div className="col-span-2 text-right text-xs font-semibold tabular-nums"
                        style={{ color: barColor }}>
                        {format(r.spentInBase)}
                      </div>
                      <div className="col-span-3 px-3 flex flex-col gap-1">
                        <ProgressBar pct={r.percentUsed} color={barColor} />
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-700">{r.percentUsed.toFixed(0)}%</span>
                          <span className="text-slate-700 tabular-nums">
                            {r.remaining >= 0 ? `${format(r.remaining)} disponible` : `${format(Math.abs(r.remaining))} exceso`}
                          </span>
                        </div>
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <UsageSparkline data={r.sparkData} />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <EstadoBadge estado={r.estado} />
                      </div>
                    </div>

                    {/* Mobile */}
                    <div className="sm:hidden px-4 py-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">{r.category}</span>
                        <EstadoBadge estado={r.estado} />
                      </div>
                      <ProgressBar pct={r.percentUsed} color={barColor} />
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 tabular-nums">{format(r.spentInBase)} / {format(r.limitInBase)}</span>
                        <span className="tabular-nums font-semibold" style={{ color: barColor }}>{r.percentUsed.toFixed(0)}%</span>
                      </div>
                    </div>
                  </button>

                  {/* Detalle expandido */}
                  {isExpanded && (
                    <div className="px-5 pb-3.5 pt-0"
                      style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)" }}>
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        <div className="rounded-xl px-3 py-2.5"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Límite</div>
                          <div className="text-sm font-bold text-white tabular-nums">{format(r.limitInBase)}</div>
                        </div>
                        <div className="rounded-xl px-3 py-2.5"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Gastado</div>
                          <div className="text-sm font-bold tabular-nums" style={{ color: barColor }}>{format(r.spentInBase)}</div>
                        </div>
                        <div className="rounded-xl px-3 py-2.5"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">
                            {r.remaining >= 0 ? "Disponible" : "Exceso"}
                          </div>
                          <div className="text-sm font-bold tabular-nums"
                            style={{ color: r.remaining >= 0 ? "#34d399" : "#f87171" }}>
                            {format(Math.abs(r.remaining))}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-[10px] text-slate-600">Tendencia 6 meses:</span>
                        <UsageSparkline data={r.sparkData} />
                        <div className="flex items-center gap-1">
                          {r.sparkData.slice(-6).map((v, i) => (
                            <div key={i} className="flex flex-col items-center gap-0.5">
                              <div className="text-[8px] tabular-nums"
                                style={{ color: v >= 100 ? "#f87171" : v >= 80 ? "#fbbf24" : "#6ee7b7" }}>
                                {v.toFixed(0)}%
                              </div>
                              <div className="text-[8px] text-slate-700">{fmtMonthShort(last6[i])}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* EMPTY STATE completo */}
      {budgets.length === 0 && (
        <div className="rounded-2xl flex flex-col items-center justify-center py-16 gap-3"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <Wallet className="w-8 h-8 text-slate-700" />
          <div className="text-sm text-slate-600">No tenés presupuestos configurados</div>
          <div className="text-xs text-slate-700">Creá tu primer presupuesto por categoría</div>
          <Link href={`/presupuestos/nuevo?month=${selectedMonth}`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white mt-1"
            style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)" }}>
            <Plus className="w-3.5 h-3.5" /> Crear presupuesto
          </Link>
        </div>
      )}
    </div>
  );
}
