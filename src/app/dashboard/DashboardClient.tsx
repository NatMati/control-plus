"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useAccounts } from "@/context/AccountsContext";
import { useSettings, type Currency } from "@/context/SettingsContext";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";
import {
  TrendingUp, TrendingDown, Wallet, CreditCard,
  ArrowRight, Eye, EyeOff, Building2,
} from "lucide-react";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type UIMovement = {
  id: string; date: string;
  type: "INGRESO" | "GASTO" | "TRANSFER";
  amount: number; currency: Currency;
  note?: string; category?: string; accountId?: string;
};

type Row = {
  id: string; name: string; native: number;
  nativeCurrency: Currency; base: number; share: number;
};

type BrokerLiquidity = {
  broker_account_id: string;
  broker_name: string;
  currency: string;
  liquidity_usd: number;
};

type EvolutionMode  = "SAVINGS" | "INVESTMENTS" | "BOTH";
type RangeOption    = "1M" | "3M" | "6M" | "1Y" | "ALL";
type GroupingOption = "MONTH" | "WEEK";

type InvestmentsHistoryPoint = { date: string; value: number; contributed?: number; performance?: number };
type Props = { initialMovements: UIMovement[] };

// ── Helpers ───────────────────────────────────────────────────────────────────

function monthKey(d: Date)  { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function monthLabel(d: Date){ const r=d.toLocaleDateString("es-UY",{month:"short"}).replace(".",""); return r.charAt(0).toUpperCase()+r.slice(1); }
function weekKey(d: Date)   { const s=new Date(d.getFullYear(),0,1);const w=Math.floor((Math.floor((d.getTime()-s.getTime())/(864e5))+s.getDay())/7)+1;return `${d.getFullYear()}-W${String(w).padStart(2,"0")}`; }
function weekLabel(d: Date) { const s=new Date(d.getFullYear(),0,1);const w=Math.floor((Math.floor((d.getTime()-s.getTime())/(864e5))+s.getDay())/7)+1;return `Sem ${w}`; }
function rangeStartDate(last: Date, range: RangeOption){ const d=new Date(last);if(range==="ALL")return new Date("1970-01-01");if(range==="1M")d.setMonth(d.getMonth()-1);if(range==="3M")d.setMonth(d.getMonth()-3);if(range==="6M")d.setMonth(d.getMonth()-6);if(range==="1Y")d.setFullYear(d.getFullYear()-1);return d; }

function formatUsd(n: number, compact = false) {
  const sign = n < 0 ? "-" : ""; const abs = Math.abs(n);
  if (compact && abs >= 1_000_000) return `${sign}US$${(abs/1_000_000).toFixed(2)}M`;
  if (compact && abs >= 1_000)     return `${sign}US$${(abs/1_000).toFixed(1)}k`;
  return `${sign}US$ ${abs.toLocaleString("es-UY",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}

type RechartsItem = { name?: string; dataKey?: string|number; value?: number|string; [k:string]:unknown };

function DarkTooltip({ active, label, payload, formatValue }: {
  active?: boolean; label?: string|number;
  payload?: ReadonlyArray<RechartsItem>; formatValue:(n:number)=>string;
}) {
  if (!active || !payload?.length) return null;
  const items = payload.filter(p => p.value !== undefined && p.value !== null);
  const nameMap: Record<string,string> = { savings:"Ahorro", investments:"Inversiones", income:"Ingresos", expense:"Gastos" };
  return (
    <div className="rounded-xl px-3 py-2.5 shadow-2xl" style={{ background:"rgba(4,12,30,0.95)", border:"1px solid rgba(255,255,255,0.1)" }}>
      {label && <div className="text-[10px] text-slate-500 mb-1.5">{String(label)}</div>}
      <div className="space-y-1">
        {items.map(p => {
          const key = String(p.dataKey ?? p.name ?? "");
          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="text-xs text-slate-400">{nameMap[key] ?? key}</span>
              <span className="text-xs font-bold text-white">{formatValue(Number(p.value ?? 0))}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, href, icon: Icon, color }: {
  label: string; value: string; sub?: string;
  href?: string; icon: any; color?: string;
}) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3 group transition-all hover:scale-[1.01]"
      style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", boxShadow:"0 4px 20px rgba(0,0,0,0.3)" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 font-medium">{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background:"rgba(255,255,255,0.05)" }}>
          <Icon className="w-4 h-4 text-slate-400" />
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight" style={{ color: color ?? "white" }}>{value}</div>
        {sub && <div className="text-xs text-slate-600 mt-1">{sub}</div>}
      </div>
      {href && (
        <Link href={href} className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-teal-400 transition-colors mt-auto">
          Ver detalle <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

function PillSelector<T extends string>({ options, value, onChange }: {
  options: { key: T; label: string }[];
  value: T; onChange: (v:T)=>void;
}) {
  return (
    <div className="flex rounded-xl p-0.5 gap-0.5" style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)" }}>
      {options.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)}
          className="px-3 py-1 rounded-lg text-[11px] font-medium transition-all"
          style={{
            background: o.key === value ? "rgba(255,255,255,0.1)" : "transparent",
            color: o.key === value ? "white" : "rgba(148,163,184,0.6)",
            border: o.key === value ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent",
          }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function DashboardClient({ initialMovements }: Props) {
  const { accounts } = useAccounts();
  const { currency, convert, format } = useSettings();

  const [evolutionMode, setEvolutionMode] = useState<EvolutionMode>("SAVINGS");
  const [range, setRange]                 = useState<RangeOption>("6M");
  const [grouping, setGrouping]           = useState<GroupingOption>("MONTH");
  const [showBalances, setShowBalances]   = useState(false);

  const [invHistory,      setInvHistory]      = useState<InvestmentsHistoryPoint[]>([]);
  const [invLoading,      setInvLoading]      = useState(false);
  const [brokerLiquidity, setBrokerLiquidity] = useState<BrokerLiquidity[]>([]);
  const [liqLoading,      setLiqLoading]      = useState(false);

  useEffect(() => {
    let alive = true;
    setInvLoading(true);
    fetch("/api/investments/history", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (alive && Array.isArray(d?.points)) setInvHistory(d.points); })
      .catch(() => {})
      .finally(() => { if (alive) setInvLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setLiqLoading(true);
    fetch("/api/investments/cash-movements", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (alive && Array.isArray(d?.liquidity)) setBrokerLiquidity(d.liquidity); })
      .catch(() => {})
      .finally(() => { if (alive) setLiqLoading(false); });
    return () => { alive = false; };
  }, []);

  // ── Cashflow ──────────────────────────────────────────────────────────────

  const cashflowData = useMemo(() => {
    type Bucket = { income:number; expense:number; label:string; date:Date };
    const buckets = new Map<string, Bucket>();
    for (const m of initialMovements) {
      if (m.type !== "INGRESO" && m.type !== "GASTO") continue;
      const d = new Date(m.date); if (isNaN(d.getTime())) continue;
      const key   = grouping === "MONTH" ? monthKey(d) : weekKey(d);
      const label = grouping === "MONTH" ? monthLabel(d) : weekLabel(d);
      const prev  = buckets.get(key) ?? { income:0, expense:0, label, date:d };
      const base  = convert(m.amount, { from:m.currency, to:currency });
      if (m.type === "INGRESO") prev.income  += base;
      else                      prev.expense += base;
      buckets.set(key, prev);
    }
    return Array.from(buckets.entries()).sort((a,b) => a[1].date.getTime()-b[1].date.getTime()).map(([,v]) => v);
  }, [initialMovements, grouping, currency, convert]);

  const rangedCashflow = useMemo(() => {
    if (!cashflowData.length) return [];
    const last = cashflowData[cashflowData.length-1].date;
    const start = rangeStartDate(last, range);
    return cashflowData.filter(p => p.date >= start);
  }, [cashflowData, range]);

  const investmentsByPeriod = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of invHistory) {
      const d = new Date(p.date); if (isNaN(d.getTime())) continue;
      const key = grouping === "MONTH" ? monthKey(d) : weekKey(d);
      map.set(key, convert(Number(p.value ?? 0), { from:"USD", to:currency }));
    }
    return map;
  }, [invHistory, grouping, currency, convert]);

  const evolutionData = useMemo(() => {
    let acc = 0; let lastInv = 0;
    return rangedCashflow.map(point => {
      acc += point.income - point.expense;
      const key = grouping === "MONTH" ? monthKey(point.date) : weekKey(point.date);
      const inv = investmentsByPeriod.get(key);
      if (typeof inv === "number" && isFinite(inv)) lastInv = inv;
      return { label: point.label, savings: acc, investments: lastInv };
    });
  }, [rangedCashflow, grouping, investmentsByPeriod]);

  // ── Totales ───────────────────────────────────────────────────────────────

  const { totalIncome, totalExpense, savingsRate } = useMemo(() => {
    const totalIncome  = rangedCashflow.reduce((s,p) => s+p.income,  0);
    const totalExpense = rangedCashflow.reduce((s,p) => s+p.expense, 0);
    const savingsRate  = totalIncome > 0 ? ((totalIncome-totalExpense)/totalIncome)*100 : 0;
    return { totalIncome, totalExpense, savingsRate };
  }, [rangedCashflow]);

  // ── Liquidez total brokers (convertida a moneda del usuario) ──────────────

  const totalLiquidityConverted = useMemo(() =>
    brokerLiquidity.reduce((a, b) =>
      a + convert(Number(b.liquidity_usd ?? 0), { from: "USD", to: currency }), 0),
  [brokerLiquidity, currency, convert]);

  // ── Balances por cuenta ───────────────────────────────────────────────────

  const { rows, totalBase, richestAccount } = useMemo(() => {
    if (!accounts.length) return { rows:[] as Row[], totalBase:0, richestAccount:undefined as Row|undefined };
    const baseMap   = new Map<string,number>();
    const nativeMap = new Map<string,number>();
    for (const m of initialMovements) {
      if (!m.accountId || (m.type !== "INGRESO" && m.type !== "GASTO")) continue;
      const acc = accounts.find(a => a.id === m.accountId); if (!acc) continue;
      const sign = m.type === "INGRESO" ? 1 : -1;
      baseMap.set(acc.id,   (baseMap.get(acc.id)   ?? 0) + convert(m.amount*sign, { from:m.currency, to:currency }));
      nativeMap.set(acc.id, (nativeMap.get(acc.id) ?? 0) + convert(m.amount*sign, { from:m.currency, to:acc.currency }));
    }
    let totalBase = 0;
    const tmpRows: Row[] = accounts.map(acc => {
      const base = baseMap.get(acc.id) ?? 0;
      totalBase += base;
      return { id:acc.id, name:acc.name, native:nativeMap.get(acc.id)??0, nativeCurrency:acc.currency, base, share:0 };
    });
    const rows = tmpRows.map(r => ({ ...r, share: totalBase > 0 ? (r.base/totalBase)*100 : 0 }));
    return { rows, totalBase, richestAccount: rows.length ? rows.reduce((mx,r)=>r.base>mx.base?r:mx, rows[0]) : undefined };
  }, [accounts, initialMovements, currency, convert]);

  const rangeLabelMap: Record<RangeOption, string> = { "1M":"1 mes","3M":"3 meses","6M":"6 meses","1Y":"1 año","ALL":"Todo" };

  return (
    <div className="p-5 md:p-7 space-y-6 max-w-[1200px]">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Resumen</h1>
          <p className="text-xs text-slate-500 mt-0.5">Vista general de tus finanzas</p>
        </div>
        <div className="flex items-center gap-2">
          <PillSelector
            options={([
              { key:"1M",  label:"1M"  },
              { key:"3M",  label:"3M"  },
              { key:"6M",  label:"6M"  },
              { key:"1Y",  label:"1A"  },
              { key:"ALL", label:"Todo"},
            ] as { key: RangeOption; label: string }[])}
            value={range} onChange={setRange}
          />
        </div>
      </div>

      {/* KPI cards — 5 en desktop, 2+3 en mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          label="Saldo total"
          value={format(totalBase)}
          sub={`${accounts.length} cuenta${accounts.length !== 1 ? "s" : ""}`}
          href="/cuentas"
          icon={Wallet}
        />
        <StatCard
          label="Ingresos"
          value={format(totalIncome)}
          sub={rangeLabelMap[range]}
          href="/movimientos"
          icon={TrendingUp}
        />
        <StatCard
          label="Gastos"
          value={format(totalExpense)}
          sub={rangeLabelMap[range]}
          href="/movimientos"
          icon={TrendingDown}
        />
        <StatCard
          label="Tasa de ahorro"
          value={`${savingsRate.toFixed(1)}%`}
          sub={richestAccount ? `Mayor: ${richestAccount.name}` : undefined}
          icon={CreditCard}
        />
        {/* ── LIQUIDEZ BROKERS ─────────────────────────────────────── */}
        <div className="rounded-2xl p-5 flex flex-col gap-3 col-span-2 lg:col-span-1 transition-all hover:scale-[1.01]"
          style={{
            background: totalLiquidityConverted >= 0 ? "rgba(52,211,153,0.04)" : "rgba(248,113,113,0.04)",
            border: `1px solid ${totalLiquidityConverted >= 0 ? "rgba(52,211,153,0.16)" : "rgba(248,113,113,0.16)"}`,
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          }}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Liquidez brokers</span>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: totalLiquidityConverted >= 0 ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)" }}>
              <Building2 className="w-4 h-4" style={{ color: totalLiquidityConverted >= 0 ? "#34d399" : "#f87171" }}/>
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight tabular-nums"
              style={{ color: totalLiquidityConverted >= 0 ? "#34d399" : "#f87171" }}>
              {liqLoading ? "…" : format(totalLiquidityConverted)}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              {brokerLiquidity.length > 0
                ? `${brokerLiquidity.length} broker${brokerLiquidity.length > 1 ? "s" : ""} · cash disponible`
                : "Sin brokers vinculados"}
            </div>
          </div>
          <Link href="/inversiones" className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-teal-400 transition-colors mt-auto">
            Ver inversiones <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Evolución — 2/3 */}
        <div className="lg:col-span-2 rounded-2xl p-5"
          style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)" }}>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
            <div>
              <div className="text-sm font-semibold text-white">Evolución</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {evolutionMode === "SAVINGS"     && "Ahorro acumulado en el tiempo"}
                {evolutionMode === "INVESTMENTS" && "Valor del portafolio"}
                {evolutionMode === "BOTH"        && "Ahorro e inversiones combinados"}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <PillSelector
                options={[
                  { key:"SAVINGS"     as EvolutionMode, label:"Ahorro"      },
                  { key:"INVESTMENTS" as EvolutionMode, label:"Inversiones" },
                  { key:"BOTH"        as EvolutionMode, label:"Ambos"       },
                ]}
                value={evolutionMode} onChange={setEvolutionMode}
              />
              <PillSelector
                options={[
                  { key:"MONTH" as GroupingOption, label:"Mensual" },
                  { key:"WEEK"  as GroupingOption, label:"Semanal" },
                ]}
                value={grouping} onChange={setGrouping}
              />
            </div>
          </div>

          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickFormatter={v => format(v)} tickLine={false} axisLine={false} width={72} />
                <Tooltip cursor={{ stroke:"rgba(255,255,255,0.08)", strokeWidth:1 }}
                  content={(p:any) => <DarkTooltip active={p.active} label={p.label} payload={p.payload} formatValue={n => format(n)} />} />
                {(evolutionMode === "SAVINGS" || evolutionMode === "BOTH") && (
                  <Line type="monotone" dataKey="savings" stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} />
                )}
                {(evolutionMode === "INVESTMENTS" || evolutionMode === "BOTH") && (
                  <Line type="monotone" dataKey="investments" stroke="#a78bfa" strokeWidth={2} dot={false} isAnimationActive={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center gap-4 mt-2">
            {(evolutionMode === "SAVINGS" || evolutionMode === "BOTH") && (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <div className="w-3 h-0.5 rounded-full bg-sky-400" /> Ahorro
              </div>
            )}
            {(evolutionMode === "INVESTMENTS" || evolutionMode === "BOTH") && (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <div className="w-3 h-0.5 rounded-full bg-violet-400" /> Inversiones
              </div>
            )}
          </div>
        </div>

        {/* Ingresos vs Gastos — 1/3 */}
        <div className="rounded-2xl p-5"
          style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)" }}>
          <div className="mb-4">
            <div className="text-sm font-semibold text-white">Ingresos vs Gastos</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Por período</div>
          </div>

          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rangedCashflow} barCategoryGap={12}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickFormatter={v => format(v)} tickLine={false} axisLine={false} width={72} />
                <Tooltip cursor={{ fill:"rgba(255,255,255,0.04)" }}
                  content={(p:any) => <DarkTooltip active={p.active} label={p.label} payload={p.payload} formatValue={n => format(n)} />} />
                <Bar dataKey="income"  fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="expense" fill="#f97316" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />Ingresos</div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500"><div className="w-2.5 h-2.5 rounded-sm bg-orange-500" />Gastos</div>
            </div>
            <Link href="/reportes/cashflow" className="text-[10px] text-slate-600 hover:text-teal-400 transition-colors flex items-center gap-1">
              Detalle <ArrowRight className="w-2.5 h-2.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Liquidez por broker — panel expandible */}
      {brokerLiquidity.length > 0 && (
        <div className="rounded-2xl overflow-hidden"
          style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-600"/>
              <div className="text-sm font-semibold text-white">Liquidez en brokers</div>
              <span className="text-[11px] font-bold tabular-nums ml-2"
                style={{ color: totalLiquidityConverted >= 0 ? "#34d399" : "#f87171" }}>
                {format(totalLiquidityConverted)}
              </span>
            </div>
            <Link href="/inversiones"
              className="text-[11px] text-slate-600 hover:text-teal-400 transition-colors flex items-center gap-1">
              Ver detalle <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-0 divide-x divide-y"
            style={{ borderColor:"rgba(255,255,255,0.05)" }}>
            {brokerLiquidity.map(b => {
              const val = Number(b.liquidity_usd ?? 0);
              const converted = convert(val, { from:"USD", to:currency });
              const isNeg = val < 0;
              return (
                <div key={b.broker_account_id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className="text-[10px] text-slate-600 mb-1 truncate">{b.broker_name}</div>
                  <div className="text-sm font-bold tabular-nums" style={{ color: isNeg ? "#f87171" : "#34d399" }}>
                    {format(converted)}
                  </div>
                  <div className="text-[10px] text-slate-700 mt-0.5">
                    {formatUsd(val, true)} USD
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Saldos por cuenta */}
      <div className="rounded-2xl p-5"
        style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-semibold text-white">Saldos por cuenta</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Distribución de tu liquidez</div>
          </div>
          <button onClick={() => setShowBalances(v => !v)}
            className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-white transition-colors px-3 py-1.5 rounded-xl"
            style={{ border:"1px solid rgba(255,255,255,0.07)", background:"rgba(255,255,255,0.03)" }}>
            {showBalances ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showBalances ? "Ocultar" : "Ver detalle"}
          </button>
        </div>

        {rows.length > 0 && (
          <div className="space-y-2 mb-4">
            {rows.slice(0,5).map(r => (
              <div key={r.id}>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-400">{r.name}</span>
                  <span className="text-slate-500">{r.share.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width:`${Math.max(r.share,0)}%`, background:"linear-gradient(90deg,#0d9488,#2563eb)" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {showBalances && (
          <div className="overflow-x-auto mt-2 pt-4" style={{ borderTop:"1px solid rgba(255,255,255,0.05)" }}>
            <table className="w-full min-w-[500px]">
              <thead>
                <tr>
                  {["Cuenta","Saldo nativo","Saldo "+currency,"% del total"].map(h => (
                    <th key={h} className="pb-2 text-left text-[10px] font-medium text-slate-600 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor:"rgba(255,255,255,0.04)" }}>
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 text-xs text-slate-300">{r.name}</td>
                    <td className="py-2.5 text-xs text-slate-400 font-mono">{r.native.toLocaleString("es-UY",{minimumFractionDigits:2,maximumFractionDigits:2})} {r.nativeCurrency}</td>
                    <td className="py-2.5 text-xs text-slate-300 font-mono">{format(r.base)}</td>
                    <td className="py-2.5 text-xs text-slate-500">{r.share.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <div className="text-xs text-slate-600 py-4">Sin datos suficientes.</div>}
          </div>
        )}
      </div>

    </div>
  );
}
