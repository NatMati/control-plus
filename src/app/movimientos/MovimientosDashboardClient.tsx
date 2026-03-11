// src/app/movimientos/MovimientosDashboardClient.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useSettings } from "@/context/SettingsContext";
import {
  ResponsiveContainer, BarChart, Bar,
  CartesianGrid, XAxis, YAxis, Tooltip,
} from "recharts";
import ImportBankStatement from "./ImportBankStatement";
import {
  TrendingUp, TrendingDown, Minus, Hash,
  Plus, AlignJustify, ChevronRight,
} from "lucide-react";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type UIMovement = {
  id: string; date: string;
  type: "INGRESO" | "GASTO" | "TRANSFER";
  category?: string; amount: number; currency: string;
  note?: string; accountId?: string;
};
type AccountOption = { id: string; name: string; currency: string };
type Props = { initialMovements: UIMovement[]; accounts: AccountOption[] };
type PeriodKey = "1M" | "3M" | "6M" | "1Y" | "ALL";

// ── Helpers ───────────────────────────────────────────────────────────────────

function round2(n: number) { return Math.round(n * 100) / 100; }
function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-UY", { day: "2-digit", month: "short" });
}
function monthLabelFromKey(key: string) {
  const [y, m] = key.split("-").map(Number);
  const raw = new Date(y, m - 1, 1).toLocaleDateString("es-UY", { month: "short" }).replace(".", "");
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

const TYPE_META = {
  INGRESO:  { label: "Ingreso",       color: "#10b981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.18)" },
  GASTO:    { label: "Gasto",         color: "#f97316", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.18)" },
  TRANSFER: { label: "Transferencia", color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.18)" },
} as const;

// ── Tooltip ───────────────────────────────────────────────────────────────────

function DarkTooltip({ active, label, payload, formatValue }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2.5 text-xs shadow-2xl"
      style={{ background: "rgba(3,7,18,0.97)", border: "1px solid rgba(255,255,255,0.09)" }}>
      {label && <div className="text-slate-500 mb-1.5 text-[10px]">{label}</div>}
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-5">
          <span className="text-slate-400">{p.dataKey === "income" ? "Ingresos" : "Gastos"}</span>
          <span className="font-bold text-white tabular-nums">{formatValue(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function MovimientosDashboardClient({ initialMovements, accounts }: Props) {
  const { convert, format, currency } = useSettings();
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodKey>("3M");

  const periodStart = useMemo(() => {
    if (period === "ALL") return null;
    const d = new Date();
    if (period === "1M") d.setMonth(d.getMonth() - 1);
    if (period === "3M") d.setMonth(d.getMonth() - 3);
    if (period === "6M") d.setMonth(d.getMonth() - 6);
    if (period === "1Y") d.setFullYear(d.getFullYear() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [period]);

  const inPeriod = useMemo(() =>
    !periodStart ? initialMovements
    : initialMovements.filter(m => new Date(m.date + "T00:00:00") >= periodStart!),
  [initialMovements, periodStart]);

  const kpis = useMemo(() => {
    let ingresos = 0, gastos = 0;
    for (const m of inPeriod) {
      const amt = convert(m.amount, { from: m.currency as any, to: currency });
      if (m.type === "INGRESO") ingresos += amt;
      if (m.type === "GASTO")   gastos  += amt;
    }
    return { ingresos, gastos, neto: ingresos - gastos, count: inPeriod.length };
  }, [inPeriod, convert, currency]);

  const savingsRate = kpis.ingresos > 0
    ? ((kpis.ingresos - kpis.gastos) / kpis.ingresos) * 100
    : 0;

  const monthlySeries = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const m of inPeriod) {
      const key = m.date.slice(0, 7);
      const b = map.get(key) ?? { income: 0, expense: 0 };
      const amt = convert(m.amount, { from: m.currency as any, to: currency });
      if (m.type === "INGRESO") b.income  += amt;
      if (m.type === "GASTO")   b.expense += amt;
      map.set(key, b);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([key, val]) => ({
        monthLabel: monthLabelFromKey(key),
        income: round2(val.income),
        expense: round2(val.expense),
      }));
  }, [inPeriod, convert, currency]);

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of inPeriod) {
      if (m.type !== "GASTO") continue;
      const cat = (m.category || "Sin categoría").trim();
      map.set(cat, (map.get(cat) ?? 0) + convert(m.amount, { from: m.currency as any, to: currency }));
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([category, value]) => ({ category, value: round2(value) }));
  }, [inPeriod, convert, currency]);

  const latestPreview = useMemo(() => inPeriod.slice(0, 8), [inPeriod]);

  const PERIOD_LABELS: Record<PeriodKey, string> = {
    "1M": "1M", "3M": "3M", "6M": "6M", "1Y": "1A", "ALL": "Todo",
  };

  // ── KPI data ──────────────────────────────────────────────────────────────
  const kpiItems = [
    {
      label: "Ingresos", value: format(kpis.ingresos),
      icon: TrendingUp, color: "#10b981",
      sub: `+${savingsRate > 0 ? savingsRate.toFixed(1) : "0"}% ahorro`,
    },
    {
      label: "Gastos", value: format(kpis.gastos),
      icon: TrendingDown, color: "#f97316",
      sub: `${kpis.count} operación${kpis.count !== 1 ? "es" : ""}`,
    },
    {
      label: "Neto", value: format(kpis.neto),
      icon: Minus, color: kpis.neto >= 0 ? "#10b981" : "#f97316",
      sub: "Ingresos − Gastos",
    },
    {
      label: "Operaciones", value: String(kpis.count),
      icon: Hash, color: "#94a3b8",
      sub: "En el período",
    },
  ];

  return (
    <div className="p-5 md:p-7 space-y-5 max-w-[1200px]">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Movimientos</h1>
          <p className="text-xs text-slate-500 mt-0.5">Flujo financiero · análisis por período</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector período */}
          <div className="flex rounded-xl p-0.5 gap-0.5"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            {(["1M", "3M", "6M", "1Y", "ALL"] as PeriodKey[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                style={{
                  background: p === period ? "rgba(255,255,255,0.1)" : "transparent",
                  color: p === period ? "white" : "rgba(148,163,184,0.55)",
                  border: p === period ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent",
                }}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          <Link href="/movimientos/nuevo"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
            style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)", boxShadow: "0 4px 14px rgba(13,148,136,0.2)" }}>
            <Plus className="w-3.5 h-3.5" /> Registrar
          </Link>

          <Link href="/movimientos/detalles"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors"
            style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
            <AlignJustify className="w-3.5 h-3.5" /> Tabla
          </Link>
        </div>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiItems.map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="rounded-2xl p-4 flex flex-col gap-2 transition-all hover:scale-[1.01]"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">{label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${color}14`, border: `1px solid ${color}28` }}>
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
            </div>
            <div className="text-xl font-bold text-white tabular-nums">{value}</div>
            <div className="text-[10px]" style={{ color: `${color}99` }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Gráficos ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Evolución mensual */}
        <div className="lg:col-span-2 rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-white">Evolución mensual</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Ingresos vs gastos · {currency}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <div className="w-2 h-2 rounded-sm bg-emerald-500" />Ingresos
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <div className="w-2 h-2 rounded-sm bg-orange-500" />Gastos
              </div>
            </div>
          </div>
          <div className="h-52">
            {monthlySeries.length === 0
              ? <EmptyChart text="Sin datos en este período." />
              : <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySeries} barCategoryGap={12}>
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

        {/* Top categorías */}
        <div className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="mb-4">
            <div className="text-sm font-semibold text-white">Top categorías</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Gastos del período · {currency}</div>
          </div>
          {expenseByCategory.length === 0
            ? <EmptyChart text="Sin gastos en este período." />
            : <div className="space-y-3">
                {expenseByCategory.map((c, i) => {
                  const max = expenseByCategory[0].value;
                  const pct = max > 0 ? (c.value / max) * 100 : 0;
                  return (
                    <div key={c.category}>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-slate-400 truncate max-w-[130px]">{c.category}</span>
                        <span className="text-slate-300 font-medium tabular-nums">{format(c.value)}</span>
                      </div>
                      <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            background: i === 0 ? "#f97316" : i === 1 ? "#fb923c" : "#fdba74",
                            opacity: 1 - i * 0.1,
                          }} />
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      </div>

      {/* ── Últimos movimientos ───────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <div>
            <div className="text-sm font-semibold text-white">Últimos movimientos</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Vista rápida del período</div>
          </div>
          <Link href="/movimientos/detalles"
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-teal-400 transition-colors">
            Tabla completa <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {latestPreview.length === 0
          ? <div className="px-5 py-8 text-center text-xs text-slate-600">Sin movimientos en este período.</div>
          : <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              {latestPreview.map(m => {
                const meta = TYPE_META[m.type];
                return (
                  <div key={m.id}
                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-white/[0.015] transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
                    <span className="text-[10px] text-slate-600 w-12 shrink-0">{formatDate(m.date)}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                      style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}>
                      {meta.label}
                    </span>
                    <span className="text-xs text-slate-400 truncate flex-1 min-w-0">{m.category || m.note || "—"}</span>
                    <span className="text-xs font-bold font-mono tabular-nums shrink-0"
                      style={{ color: m.type === "INGRESO" ? "#10b981" : m.type === "GASTO" ? "#f97316" : "#94a3b8" }}>
                      {m.type === "GASTO" ? "−" : m.type === "INGRESO" ? "+" : ""}
                      {format(m.amount, { currency: m.currency as any })}
                    </span>
                    <span className="text-[10px] text-slate-700 font-mono w-8 text-right shrink-0">{m.currency}</span>
                  </div>
                );
              })}
            </div>
        }
      </div>

      {/* ── Importador ───────────────────────────────────────────────────── */}
      <ImportBankStatement accounts={accounts} onImported={() => router.refresh()} />
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="h-52 flex items-center justify-center text-xs text-slate-600">{text}</div>
  );
}
