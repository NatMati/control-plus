// src/app/movimientos/MovimientosClient.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSettings } from "@/context/SettingsContext";
import { useAccounts } from "@/context/AccountsContext";
import {
  ResponsiveContainer, BarChart, Bar,
  CartesianGrid, XAxis, YAxis, Tooltip,
} from "recharts";
import {
  Search, Plus, X, TrendingUp, TrendingDown,
  ArrowLeftRight, ChevronRight, Trash2, SlidersHorizontal,
} from "lucide-react";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type UIMovement = {
  id: string; date: string;
  type: "INGRESO" | "GASTO" | "TRANSFER";
  category?: string; amount: number; currency: string;
  note?: string; accountId?: string;
};
type Props = { initialMovements: UIMovement[] };

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-UY", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
function monthLabelFromKey(key: string) {
  const [y, m] = key.split("-").map(Number);
  const raw = new Date(y, m - 1, 1).toLocaleDateString("es-UY", { month: "short" }).replace(".", "");
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

const TYPE_META = {
  INGRESO:  { label: "Ingreso",       color: "#10b981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.18)",  icon: TrendingUp     },
  GASTO:    { label: "Gasto",         color: "#f97316", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.18)",  icon: TrendingDown   },
  TRANSFER: { label: "Transferencia", color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.18)",  icon: ArrowLeftRight },
} as const;

function DarkTooltip({ active, label, payload, formatValue }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2.5 text-xs shadow-2xl"
      style={{ background: "rgba(3,7,18,0.97)", border: "1px solid rgba(255,255,255,0.09)" }}>
      {label && <div className="text-slate-500 mb-1.5 text-[10px]">{label}</div>}
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-5">
          <span className="text-slate-400">{p.dataKey === "income" ? "Ingresos" : p.dataKey === "expense" ? "Gastos" : "Neto"}</span>
          <span className="font-bold text-white tabular-nums">{formatValue(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function MovimientosClient({ initialMovements }: Props) {
  const { convert, format, currency } = useSettings();
  const { deleteMovement } = useAccounts();

  const [movements, setMovements] = useState<UIMovement[]>(initialMovements);
  const [q, setQ]               = useState("");
  const [tipo, setTipo]         = useState<"" | "INGRESO" | "GASTO" | "TRANSFER">("");
  const [desde, setDesde]       = useState("");
  const [hasta, setHasta]       = useState("");
  const [categoria, setCategoria] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [deletingId, setDeletingId]   = useState<string | null>(null);

  const categorias = useMemo(() =>
    Array.from(new Set(movements.map(m => m.category || ""))).filter(Boolean).sort(),
  [movements]);

  const filtrados = useMemo(() =>
    movements.filter(m => {
      if (q) {
        const txt = `${m.category ?? ""} ${m.note ?? ""} ${m.accountId ?? ""}`.toLowerCase();
        if (!txt.includes(q.toLowerCase())) return false;
      }
      if (tipo && m.type !== tipo) return false;
      if (categoria && m.category !== categoria) return false;
      if (desde && m.date < desde) return false;
      if (hasta && m.date > hasta) return false;
      return true;
    }).sort((a, b) => (a.date < b.date ? 1 : -1)),
  [movements, q, tipo, categoria, desde, hasta]);

  const totals = useMemo(() => {
    let ingreso = 0, gasto = 0, transfer = 0;
    for (const m of filtrados) {
      const amt = convert(m.amount, { from: m.currency as any, to: currency });
      if (m.type === "INGRESO")  ingreso  += amt;
      if (m.type === "GASTO")    gasto    += amt;
      if (m.type === "TRANSFER") transfer += amt;
    }
    return { ingreso, gasto, transfer };
  }, [filtrados, convert, currency]);

  const monthlySummary = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const m of movements) {
      const key = m.date.slice(0, 7);
      const b = map.get(key) ?? { income: 0, expense: 0 };
      const amt = convert(m.amount, { from: m.currency as any, to: currency });
      if (m.type === "INGRESO") b.income  += amt;
      if (m.type === "GASTO")   b.expense += amt;
      map.set(key, b);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1)).slice(-6)
      .map(([key, val]) => ({
        monthLabel: monthLabelFromKey(key),
        income: val.income, expense: val.expense,
        net: val.income - val.expense,
      }));
  }, [movements, convert, currency]);

  const spendingInsight = useMemo(() => {
    if (monthlySummary.length < 2) return null;
    const cur  = monthlySummary[monthlySummary.length - 1];
    const prev = monthlySummary[monthlySummary.length - 2];
    const totalDiff = cur.expense - prev.expense;
    const totalPct  = prev.expense > 0 ? (totalDiff / prev.expense) * 100 : 0;
    return { cur, prev, totalDiff, totalPct };
  }, [monthlySummary]);

  const hasFilters = !!(q || tipo || categoria || desde || hasta);
  const clearFilters = () => { setQ(""); setTipo(""); setCategoria(""); setDesde(""); setHasta(""); };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar este movimiento?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/movements/${id}`, { method: "DELETE" });
      if (!res.ok) { alert("No se pudo eliminar."); return; }
      try { await deleteMovement(id); } catch {}
      setMovements(prev => prev.filter(m => m.id !== id));
    } catch { alert("Error al borrar."); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="p-5 md:p-7 space-y-5 max-w-[1200px]">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Historial</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {filtrados.length} movimiento{filtrados.length !== 1 ? "s" : ""}
            {hasFilters && " · filtros activos"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAnalysis(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
            style={{
              background: showAnalysis ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.03)",
              border: showAnalysis ? "1px solid rgba(99,102,241,0.3)" : "1px solid rgba(255,255,255,0.08)",
              color: showAnalysis ? "#a5b4fc" : "#94a3b8",
            }}>
            <TrendingUp className="w-3.5 h-3.5" />
            Análisis
          </button>
          <Link href="/movimientos/nuevo"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
            style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)", boxShadow: "0 4px 14px rgba(13,148,136,0.2)" }}>
            <Plus className="w-3.5 h-3.5" /> Nuevo
          </Link>
        </div>
      </div>

      {/* ── KPI cards (clicables para filtrar) ──────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([
          { key: "INGRESO"  as const, label: "Ingresos",       value: totals.ingreso,  icon: TrendingUp,     color: "#10b981" },
          { key: "GASTO"    as const, label: "Gastos",          value: totals.gasto,   icon: TrendingDown,   color: "#f97316" },
          { key: "TRANSFER" as const, label: "Transferencias",  value: totals.transfer, icon: ArrowLeftRight, color: "#60a5fa" },
        ]).map(({ key, label, value, icon: Icon, color }) => (
          <button key={key}
            onClick={() => setTipo(t => t === key ? "" : key)}
            className="rounded-2xl p-4 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{
              background: tipo === key ? `${color}10` : "rgba(255,255,255,0.025)",
              border: tipo === key ? `1px solid ${color}35` : "1px solid rgba(255,255,255,0.07)",
            }}>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] text-slate-500 font-medium">{label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${color}14`, border: `1px solid ${color}28` }}>
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
            </div>
            <div className="text-xl font-bold text-white tabular-nums">{format(value)}</div>
            <div className="mt-2 text-[10px] flex items-center gap-1" style={{ color: `${color}80` }}>
              {tipo === key ? "Filtrando por este tipo" : "Clic para filtrar"}
              <ChevronRight className="w-2.5 h-2.5" />
            </div>
          </button>
        ))}
      </div>

      {/* ── Panel análisis ───────────────────────────────────────────────── */}
      {showAnalysis && (
        <div className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between px-5 py-3.5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
            <div className="text-sm font-semibold text-white">Análisis mensual</div>
            <button onClick={() => setShowAnalysis(false)}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all">
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Gráfico */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500"><div className="w-2 h-2 rounded-sm bg-emerald-500" />Ingresos</div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500"><div className="w-2 h-2 rounded-sm bg-orange-500" />Gastos</div>
              </div>
              <div className="h-48">
                {monthlySummary.length === 0
                  ? <div className="h-full flex items-center justify-center text-xs text-slate-600">Sin datos suficientes.</div>
                  : <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlySummary} barCategoryGap={12}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="monthLabel" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#475569" fontSize={10} tickFormatter={v => format(v)} tickLine={false} axisLine={false} width={72} />
                        <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }}
                          content={(p: any) => <DarkTooltip {...p} formatValue={(n: number) => format(n)} />} />
                        <Bar dataKey="income"  fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expense" fill="#f97316" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                }
              </div>
            </div>

            {/* Insights */}
            <div className="space-y-3">
              {spendingInsight ? (
                <>
                  <div className="rounded-xl p-4"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">Mes a mes</div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      En <span className="text-white font-semibold">{spendingInsight.cur.monthLabel}</span> gastaste{" "}
                      <span className="font-bold" style={{ color: spendingInsight.totalDiff >= 0 ? "#f97316" : "#10b981" }}>
                        {format(Math.abs(spendingInsight.totalDiff))} {spendingInsight.totalDiff >= 0 ? "más" : "menos"}
                      </span>{" "}
                      que en <span className="text-white font-semibold">{spendingInsight.prev.monthLabel}</span>.
                    </p>
                  </div>
                  <div className="rounded-xl p-4"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1.5">Variación</div>
                    <div className="text-2xl font-bold tabular-nums"
                      style={{ color: spendingInsight.totalDiff >= 0 ? "#f97316" : "#10b981" }}>
                      {spendingInsight.totalDiff >= 0 ? "+" : ""}{spendingInsight.totalPct.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">respecto al mes anterior</div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl p-4 text-xs text-slate-600"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  Necesitás al menos dos meses con datos para ver comparativas.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Barra de búsqueda + filtros ──────────────────────────────────── */}
      <div className="rounded-2xl p-4 space-y-3"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>

        <div className="flex items-center gap-2">
          {/* Buscador */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
            <input value={q} onChange={e => setQ(e.target.value)}
              placeholder="Buscar categoría, nota…"
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs text-slate-200 outline-none transition-all"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
          </div>
          {/* Toggle filtros extra */}
          <button onClick={() => setShowFilters(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] transition-colors shrink-0"
            style={{
              background: showFilters ? "rgba(96,165,250,0.1)" : "rgba(255,255,255,0.04)",
              border: showFilters ? "1px solid rgba(96,165,250,0.25)" : "1px solid rgba(255,255,255,0.08)",
              color: showFilters ? "#93c5fd" : "#64748b",
            }}>
            <SlidersHorizontal className="w-3 h-3" />
            Filtros
          </button>
          {hasFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] text-slate-500 hover:text-white transition-colors shrink-0"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <X className="w-3 h-3" /> Limpiar
            </button>
          )}
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 pt-1">
            {/* Tipo */}
            {(["", "INGRESO", "GASTO", "TRANSFER"] as const).map(t => (
              <button key={t} onClick={() => setTipo(t)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                style={{
                  background: tipo === t ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)",
                  color: tipo === t ? "white" : "#64748b",
                  border: tipo === t ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(255,255,255,0.06)",
                }}>
                {t === "" ? "Todos los tipos" : TYPE_META[t].label}
              </button>
            ))}

            <div className="w-px self-stretch" style={{ background: "rgba(255,255,255,0.07)" }} />

            {/* Categoría */}
            <select value={categoria} onChange={e => setCategoria(e.target.value)}
              className="px-2.5 py-1 rounded-lg text-[11px] outline-none appearance-none cursor-pointer"
              style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                color: categoria ? "white" : "#64748b",
              }}>
              <option value="">Categoría</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Fechas */}
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              className="px-2.5 py-1 rounded-lg text-[11px] outline-none"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: desde ? "white" : "#64748b" }} />
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              className="px-2.5 py-1 rounded-lg text-[11px] outline-none"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: hasta ? "white" : "#64748b" }} />
          </div>
        )}
      </div>

      {/* ── Tabla de movimientos ──────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>

        {/* Cabecera desktop */}
        <div className="hidden md:grid grid-cols-12 px-5 py-3 text-[10px] uppercase tracking-wider text-slate-600"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}>
          <div className="col-span-2">Fecha</div>
          <div className="col-span-2">Tipo</div>
          <div className="col-span-2">Categoría</div>
          <div className="col-span-2">Cuenta</div>
          <div className="col-span-2">Monto</div>
          <div className="col-span-1">Nota</div>
          <div className="col-span-1 text-right">·</div>
        </div>

        {filtrados.length === 0 && (
          <div className="px-5 py-10 text-center text-xs text-slate-600">
            {hasFilters ? "Sin resultados con esos filtros." : "No hay movimientos registrados."}
          </div>
        )}

        <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
          {filtrados.map(m => {
            const meta  = TYPE_META[m.type];
            const isIn  = m.type === "INGRESO";
            const isOut = m.type === "GASTO";

            return (
              <div key={m.id} className="group transition-colors hover:bg-white/[0.015]">

                {/* Desktop */}
                <div className="hidden md:grid grid-cols-12 px-5 py-3 items-center text-xs">
                  <div className="col-span-2 text-slate-500 tabular-nums">{formatDate(m.date)}</div>
                  <div className="col-span-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="col-span-2 text-slate-400 truncate">{m.category || "—"}</div>
                  <div className="col-span-2 text-slate-500 truncate">
                    {m.type === "TRANSFER" ? "Transferencia" : m.accountId || "—"}
                  </div>
                  <div className="col-span-2">
                    <span className="font-bold font-mono tabular-nums"
                      style={{ color: isIn ? "#10b981" : isOut ? "#f97316" : "#94a3b8" }}>
                      {isOut ? "−" : isIn ? "+" : ""}
                      {format(m.amount, { currency: m.currency as any })}
                    </span>
                    <span className="ml-1.5 text-[10px] text-slate-700">{m.currency}</span>
                  </div>
                  <div className="col-span-1 text-slate-600 truncate text-[11px]">{m.note || "—"}</div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => handleDelete(m.id)} disabled={deletingId === m.id}
                      className="w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 disabled:opacity-40"
                      style={{ color: "#f87171" }}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Mobile */}
                <div className="md:hidden px-4 py-3 flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-300 truncate">{m.category || m.note || "Sin categoría"}</span>
                      <span className="text-xs font-bold font-mono tabular-nums shrink-0"
                        style={{ color: isIn ? "#10b981" : isOut ? "#f97316" : "#94a3b8" }}>
                        {isOut ? "−" : isIn ? "+" : ""}{format(m.amount, { currency: m.currency as any })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-600">{formatDate(m.date)}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ color: meta.color, background: meta.bg }}>{meta.label}</span>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(m.id)} disabled={deletingId === m.id}
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors hover:bg-red-500/10 disabled:opacity-40"
                    style={{ color: "#475569" }}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
