"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useAccounts } from "@/context/AccountsContext";
import { useSettings, type Currency } from "@/context/SettingsContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

// ---------- Tipos compartidos con el server ----------

export type UIMovement = {
  id: string;
  date: string; // "YYYY-MM-DD"
  type: "INGRESO" | "GASTO" | "TRANSFER";
  amount: number;
  currency: Currency;
  note?: string;
  category?: string;
  accountId?: string;
};

type Row = {
  id: string;
  name: string;
  native: number;
  nativeCurrency: Currency;
  base: number;
  share: number;
};

type EvolutionMode = "SAVINGS" | "INVESTMENTS" | "BOTH";
type RangeOption = "1M" | "3M" | "6M" | "1Y" | "ALL";
type GroupingOption = "MONTH" | "WEEK";

type Props = {
  initialMovements: UIMovement[];
};

// ==============================
//   Tipos de inversiones (API)
// ==============================
type InvestmentsHistoryPoint = {
  date: string; // YYYY-MM-DD
  value: number; // valor del portafolio (probablemente en USD)
  contributed?: number;
  performance?: number;
};

type InvestmentsHistoryResponse = {
  points: InvestmentsHistoryPoint[];
  error?: string;
};

// ===============================================
//        Helpers para agrupar movimientos
// ===============================================

// key mensual: YYYY-MM
function monthKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// etiqueta corta "Jul", "Ago", etc.
function monthLabel(d: Date) {
  const raw = d.toLocaleDateString("es-UY", { month: "short" });
  const clean = raw.replace(".", "");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

// key semanal: YYYY-Www (semana aproximada)
function weekKey(d: Date) {
  const year = d.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const diffDays = Math.floor(
    (d.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
  );
  const week = Math.floor((diffDays + startOfYear.getDay()) / 7) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function weekLabel(d: Date) {
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const diffDays = Math.floor(
    (d.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
  );
  const week = Math.floor((diffDays + startOfYear.getDay()) / 7) + 1;
  return `Sem ${week}`;
}

// Rango: devuelve dateFrom según selección
function rangeStartDate(lastDate: Date, range: RangeOption) {
  const d = new Date(lastDate);
  if (range === "ALL") return new Date("1970-01-01");
  if (range === "1M") d.setMonth(d.getMonth() - 1);
  if (range === "3M") d.setMonth(d.getMonth() - 3);
  if (range === "6M") d.setMonth(d.getMonth() - 6);
  if (range === "1Y") d.setFullYear(d.getFullYear() - 1);
  return d;
}

// ===============================================
//         Tooltip oscuro consistente (Recharts)
// ===============================================

// Evitamos depender de TooltipProps de Recharts (varía por versión)
type AnyTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<unknown>;
};

// Item “genérico” del payload (Recharts lo cambia entre versiones)
type RechartsTooltipItem = {
  name?: string;
  dataKey?: string | number;
  value?: number | string;
  [key: string]: unknown;
};

function DarkTooltip({
  active,
  label,
  payload,
  labelPrefix,
  formatValue,
}: {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<RechartsTooltipItem>;
  labelPrefix?: string;
  formatValue: (n: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const safePayload = payload.filter(
    (p: RechartsTooltipItem) => p && p.value !== undefined && p.value !== null
  );

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 shadow-xl">
      {label !== undefined && (
        <div className="mb-1 text-[11px] text-slate-400">
          {labelPrefix ? `${labelPrefix}: ` : ""}
          <span className="text-slate-200">{String(label)}</span>
        </div>
      )}

      <div className="space-y-0.5">
        {safePayload.map((p: RechartsTooltipItem) => {
          const key = String(p.dataKey ?? p.name ?? "");
          const name =
            key === "savings"
              ? "Ahorro"
              : key === "investments"
              ? "Inversiones"
              : key === "income"
              ? "Ingresos"
              : key === "expense"
              ? "Gastos"
              : String(p.name ?? key);

          const num = Number(p.value ?? 0);

          return (
            <div key={key} className="flex items-center justify-between gap-3">
              <div className="text-[12px] text-slate-200">{name}</div>
              <div className="text-[12px] font-semibold text-slate-100">
                {formatValue(Number.isFinite(num) ? num : 0)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===============================================
//             COMPONENTE PRINCIPAL
// ===============================================

export default function DashboardClient({ initialMovements }: Props) {
  const { accounts } = useAccounts();
  const { currency, convert, format } = useSettings();

  const [showHelp, setShowHelp] = useState(false);
  const [showBalances, setShowBalances] = useState(false);

  const [evolutionMode, setEvolutionMode] =
    useState<EvolutionMode>("SAVINGS");
  const [range, setRange] = useState<RangeOption>("6M");
  const [grouping, setGrouping] = useState<GroupingOption>("MONTH");

  // ============================================
  //   Inversiones reales (history)
  // ============================================
  const [invHistory, setInvHistory] = useState<InvestmentsHistoryPoint[]>([]);
  const [invHistoryLoading, setInvHistoryLoading] = useState(false);
  const [invHistoryError, setInvHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        setInvHistoryLoading(true);
        setInvHistoryError(null);

        const res = await fetch("/api/investments/history", {
          cache: "no-store",
        });
        const json = (await res.json()) as Partial<InvestmentsHistoryResponse>;

        if (!res.ok) {
          if (!alive) return;
          setInvHistory([]);
          setInvHistoryError(json?.error || "Error al cargar inversiones.");
          return;
        }

        const points = Array.isArray(json?.points)
          ? (json!.points as InvestmentsHistoryPoint[])
          : [];

        const cleaned = points
          .map((p) => ({
            date: String(p.date || ""),
            value: Number(p.value ?? 0),
            contributed: Number(p.contributed ?? 0),
            performance: Number(p.performance ?? 0),
          }))
          .filter((p) => p.date && Number.isFinite(new Date(p.date).getTime()))
          .sort((a, b) => (a.date > b.date ? 1 : -1));

        if (!alive) return;
        setInvHistory(cleaned);
      } catch {
        if (!alive) return;
        setInvHistory([]);
        setInvHistoryError("Error inesperado al cargar inversiones.");
      } finally {
        if (alive) setInvHistoryLoading(false);
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, []);

  // =====================================================
  //   1) CASHFLOW REAL: ingresos / gastos por período
  // =====================================================

  const cashflowData = useMemo(() => {
    if (!initialMovements.length) return [];

    type Bucket = { income: number; expense: number; label: string; date: Date };

    const buckets = new Map<string, Bucket>();

    for (const m of initialMovements) {
      if (m.type !== "INGRESO" && m.type !== "GASTO") continue;
      if (!m.date) continue;

      const d = new Date(m.date);
      if (Number.isNaN(d.getTime())) continue;

      const key = grouping === "MONTH" ? monthKey(d) : weekKey(d);
      const label = grouping === "MONTH" ? monthLabel(d) : weekLabel(d);

      const prev = buckets.get(key) ?? { income: 0, expense: 0, label, date: d };

      const signed = m.type === "INGRESO" ? m.amount : -m.amount;

      const amountInBase = convert(signed, { from: m.currency, to: currency });

      if (amountInBase >= 0) prev.income += amountInBase;
      else prev.expense += Math.abs(amountInBase);

      buckets.set(key, prev);
    }

    const sorted = Array.from(buckets.entries())
      .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
      .map(([, v]) => v);

    return sorted;
  }, [initialMovements, grouping, currency, convert]);

  // =====================================================
  //   Rango aplicado (sobre cashflow)
  // =====================================================

  const rangedCashflow = useMemo(() => {
    if (!cashflowData.length) return [];
    const last = cashflowData[cashflowData.length - 1].date;
    const start = rangeStartDate(last, range);
    return cashflowData.filter((p) => p.date >= start);
  }, [cashflowData, range]);

  // =====================================================
  //   Inversiones por período (alineado a MONTH/WEEK)
  // =====================================================

  const investmentsByPeriod = useMemo(() => {
    if (!invHistory.length) return new Map<string, number>();

    const map = new Map<string, number>();

    for (const p of invHistory) {
      const d = new Date(p.date);
      if (Number.isNaN(d.getTime())) continue;

      const key = grouping === "MONTH" ? monthKey(d) : weekKey(d);

      // Asumimos history en USD. Convertimos a moneda base del dashboard.
      const vBase = convert(Number(p.value ?? 0), { from: "USD", to: currency });

      // Si hay varias lecturas dentro del mismo período, nos quedamos con la última.
      map.set(key, vBase);
    }

    return map;
  }, [invHistory, grouping, currency, convert]);

  // =====================================================
  //   2) EVOLUCIÓN DEL AHORRO + INVERSIONES (REAL)
  // =====================================================

  const evolutionData = useMemo(() => {
    if (!rangedCashflow.length) return [];

    let accSavings = 0;
    let lastInv = 0;

    return rangedCashflow.map((point) => {
      accSavings += point.income - point.expense;

      const key =
        grouping === "MONTH" ? monthKey(point.date) : weekKey(point.date);

      const inv = investmentsByPeriod.get(key);
      if (typeof inv === "number" && Number.isFinite(inv)) lastInv = inv;

      return {
        label: point.label,
        savings: accSavings,
        investments: lastInv,
      };
    });
  }, [rangedCashflow, grouping, investmentsByPeriod]);

  const evolutionTitle =
    evolutionMode === "SAVINGS"
      ? "Evolución del ahorro"
      : evolutionMode === "INVESTMENTS"
      ? "Evolución de las inversiones"
      : "Evolución de ahorro e inversiones";

  const evolutionSubtitle =
    evolutionMode === "SAVINGS"
      ? "Muestra cómo fue cambiando tu ahorro neto en el tiempo, a partir de tus ingresos y gastos."
      : evolutionMode === "INVESTMENTS"
      ? "Muestra la evolución del valor de tu portafolio (según tu histórico)."
      : "Muestra la evolución combinada de ahorro e inversiones.";

  // =====================================================
  //   3) BALANCES POR CUENTA (a partir de movimientos)
  // =====================================================

  const { rows, totalBase, richestAccount } = useMemo(() => {
    if (!accounts.length) {
      return {
        rows: [] as Row[],
        totalBase: 0,
        richestAccount: undefined as Row | undefined,
      };
    }

    const baseByAccount = new Map<string, number>();
    const nativeByAccount = new Map<string, number>();

    for (const m of initialMovements) {
      if (!m.accountId) continue;
      if (m.type !== "INGRESO" && m.type !== "GASTO") continue;

      const acc = accounts.find((a) => a.id === m.accountId);
      if (!acc) continue;

      const signed = m.type === "INGRESO" ? m.amount : -m.amount;

      const amountInBase = convert(signed, { from: m.currency, to: currency });
      const amountInNative = convert(signed, {
        from: m.currency,
        to: acc.currency,
      });

      baseByAccount.set(acc.id, (baseByAccount.get(acc.id) ?? 0) + amountInBase);
      nativeByAccount.set(
        acc.id,
        (nativeByAccount.get(acc.id) ?? 0) + amountInNative
      );
    }

    let totalBase = 0;

    const tmpRows: Row[] = accounts.map((acc) => {
      const base = baseByAccount.get(acc.id) ?? 0;
      const native = nativeByAccount.get(acc.id) ?? 0;

      totalBase += base;

      return {
        id: acc.id,
        name: acc.name,
        native,
        nativeCurrency: acc.currency,
        base,
        share: 0,
      };
    });

    const rows = tmpRows.map((r) => ({
      ...r,
      share: totalBase > 0 ? (r.base / totalBase) * 100 : 0,
    }));

    const richestAccount =
      rows.length > 0
        ? rows.reduce((max, r) => (r.base > max.base ? r : max), rows[0])
        : undefined;

    return { rows, totalBase, richestAccount };
  }, [accounts, initialMovements, currency, convert]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Resumen</h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Vista general de sus finanzas en Control+. Aquí podrá ver el saldo
            total, cómo se reparte entre cuentas y accesos rápidos a cuentas,
            presupuestos y deudas.
          </p>
        </div>

        <span className="self-start text-xs px-2 py-1 rounded-full bg-slate-800/60 text-slate-300">
          Mostrando en: <span className="font-semibold">{currency}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-[#0f1830] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-3">
            <div>
              <div className="text-sm font-medium">{evolutionTitle}</div>
              <div className="text-xs text-slate-500">{evolutionSubtitle}</div>

              {invHistoryLoading && evolutionMode !== "SAVINGS" && (
                <div className="mt-1 text-[11px] text-slate-500">
                  Cargando inversiones…
                </div>
              )}
              {invHistoryError && evolutionMode !== "SAVINGS" && (
                <div className="mt-1 text-[11px] text-red-400">
                  {invHistoryError}
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex rounded-full bg-slate-900 p-1 text-[11px]">
                {[
                  { key: "SAVINGS", label: "Ahorro" },
                  { key: "INVESTMENTS", label: "Inversiones" },
                  { key: "BOTH", label: "Ambos" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setEvolutionMode(opt.key as EvolutionMode)}
                    className={
                      "px-3 py-1 rounded-full transition " +
                      (evolutionMode === opt.key
                        ? "bg-sky-500 text-white"
                        : "text-slate-300 hover:bg-slate-800")
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 text-[11px]">
                <div className="flex rounded-full bg-slate-900 p-1">
                  {(["1M", "3M", "6M", "1Y", "ALL"] as RangeOption[]).map(
                    (opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setRange(opt)}
                        className={
                          "px-2 py-0.5 rounded-full " +
                          (range === opt
                            ? "bg-slate-700 text-white"
                            : "text-slate-300 hover:bg-slate-800")
                        }
                      >
                        {opt === "ALL" ? "Todo" : opt}
                      </button>
                    )
                  )}
                </div>

                <div className="flex rounded-full bg-slate-900 p-1">
                  {(
                    [
                      ["MONTH", "Mensual"],
                      ["WEEK", "Semanal"],
                    ] as [GroupingOption, string][]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setGrouping(value)}
                      className={
                        "px-2 py-0.5 rounded-full " +
                        (grouping === value
                          ? "bg-slate-700 text-white"
                          : "text-slate-300 hover:bg-slate-800")
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="label"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#1f2937" }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickFormatter={(v: number) => format(v)}
                  tickLine={false}
                  axisLine={{ stroke: "#1f2937" }}
                  width={78}
                />

                <Tooltip
                  cursor={{ stroke: "#334155", strokeWidth: 1 }}
                  content={(props: AnyTooltipProps) => (
                    <DarkTooltip
                      active={props.active}
                      label={props.label}
                      payload={
                        (props.payload as ReadonlyArray<RechartsTooltipItem>) ??
                        undefined
                      }
                      labelPrefix={grouping === "MONTH" ? "Mes" : "Período"}
                      formatValue={(n) => format(n)}
                    />
                  )}
                />

                {(evolutionMode === "SAVINGS" || evolutionMode === "BOTH") && (
                  <Line
                    type="monotone"
                    dataKey="savings"
                    stroke="#38bdf8"
                    strokeWidth={2.2}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}

                {(evolutionMode === "INVESTMENTS" ||
                  evolutionMode === "BOTH") && (
                  <Line
                    type="monotone"
                    dataKey="investments"
                    stroke="#a78bfa"
                    strokeWidth={2.2}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="text-sm font-medium">
                Ingresos vs gastos (últimos períodos)
              </div>
              <div className="text-xs text-slate-500">
                Comparación simple entre lo que entra y lo que sale, basada en
                tus movimientos registrados.
              </div>
            </div>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rangedCashflow} barCategoryGap={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="label"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#1f2937" }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickFormatter={(v: number) => format(v)}
                  tickLine={false}
                  axisLine={{ stroke: "#1f2937" }}
                  width={78}
                />

                <Tooltip
                  cursor={{ fill: "rgba(148,163,184,0.08)" }}
                  content={(props: AnyTooltipProps) => (
                    <DarkTooltip
                      active={props.active}
                      label={props.label}
                      payload={
                        (props.payload as ReadonlyArray<RechartsTooltipItem>) ??
                        undefined
                      }
                      formatValue={(n) => format(n)}
                    />
                  )}
                />

                <Bar dataKey="income" fill="#22c55e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex justify-end">
            <Link
              href="/reportes"
              className="text-xs text-slate-300 hover:text-white underline underline-offset-4"
            >
              Ver análisis detallado →
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Resumen visual del sistema</div>
            <div className="text-xs text-slate-500">
              Este panel resume lo que muestran los gráficos de ahorro,
              inversiones e ingresos/gastos. Podés desplegarlo cuando necesites
              una explicación rápida.
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowHelp((s) => !s)}
            className="text-xs px-3 py-1 rounded-full bg-slate-800/60 text-slate-300 hover:bg-slate-800"
          >
            {showHelp ? "Ocultar" : "¿Qué estoy viendo?"}
          </button>
        </div>

        {showHelp && (
          <div className="mt-3 text-sm text-slate-300 leading-relaxed">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="font-medium">Evolución:</span> el ahorro se
                calcula como acumulado de ingresos menos gastos; inversiones se
                toma del histórico de tu portafolio (API).
              </li>
              <li>
                <span className="font-medium">Ingresos vs gastos:</span> agrupa
                por mes o semana según el selector.
              </li>
              <li>
                <span className="font-medium">Cuentas:</span> se estiman en base
                a movimientos asociados a cada cuenta.
              </li>
            </ul>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
          <div className="text-xs text-slate-500">Saldo total</div>
          <div className="mt-1 text-2xl font-semibold">{format(totalBase)}</div>
          <div className="mt-1 text-xs text-slate-500">
            Suma de todas las cuentas registradas, convertidas a {currency}.
          </div>
          <div className="mt-3">
            <Link
              href="/cuentas"
              className="text-xs text-sky-400 hover:text-sky-300 underline underline-offset-4"
            >
              Ver detalle de cuentas →
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
          <div className="text-xs text-slate-500">Cuentas activas</div>
          <div className="mt-1 text-2xl font-semibold">{accounts.length}</div>
          <div className="mt-1 text-xs text-slate-500">
            Incluye bancos, billeteras y efectivo configurados en el sistema.
          </div>
          <div className="mt-3">
            <Link
              href="/cuentas"
              className="text-xs text-sky-400 hover:text-sky-300 underline underline-offset-4"
            >
              Gestionar cuentas →
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
          <div className="text-xs text-slate-500">Cuenta con mayor saldo</div>
          <div className="mt-1 text-sm font-semibold text-slate-200">
            {richestAccount?.name ?? "—"}
          </div>
          <div className="mt-2 text-2xl font-semibold">
            {richestAccount ? format(richestAccount.base) : format(0)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Ideal para identificar dónde se concentra tu liquidez.
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-medium">Saldos por cuenta</div>
            <div className="text-xs text-slate-500">
              Resumen abreviado de tus cuentas. El detalle completo se encuentra
              en la sección de Cuentas.
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowBalances((s) => !s)}
            className="text-xs px-3 py-1 rounded-full bg-slate-800/60 text-slate-300 hover:bg-slate-800"
          >
            {showBalances ? "Ocultar" : "Ver detalle"}
          </button>
        </div>

        {showBalances && (
          <div className="overflow-x-auto">
            <table className="min-w-[680px] w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="py-2 pr-3">Cuenta</th>
                  <th className="py-2 pr-3">Saldo (moneda cuenta)</th>
                  <th className="py-2 pr-3">Saldo ({currency})</th>
                  <th className="py-2 pr-3">% del total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-800">
                    <td className="py-2 pr-3 text-slate-200">{r.name}</td>
                    <td className="py-2 pr-3 text-slate-300">
                      {convert(r.native, {
                        from: r.nativeCurrency,
                        to: r.nativeCurrency,
                      }).toLocaleString("es-UY", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      {r.nativeCurrency}
                    </td>
                    <td className="py-2 pr-3 text-slate-300">{format(r.base)}</td>
                    <td className="py-2 pr-3 text-slate-300">
                      {r.share.toLocaleString("es-UY", {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}
                      %
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td className="py-3 text-sm text-slate-500" colSpan={4}>
                      No hay cuentas o movimientos suficientes para calcular
                      saldos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {!showBalances && (
          <div className="text-xs text-slate-500">
            Tocá “Ver detalle” para ver cómo se reparte tu saldo entre cuentas.
          </div>
        )}
      </div>
    </div>
  );
}
