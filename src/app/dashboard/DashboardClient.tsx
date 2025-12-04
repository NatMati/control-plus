// src/app/dashboard/DashboardClient.tsx
"use client";

import { useMemo, useState } from "react";
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
  date: string;
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

type Props = {
  initialMovements: UIMovement[];
};

// =====================================================
//            COMPONENTE PRINCIPAL (CLIENT)
// =====================================================

export default function DashboardClient({ initialMovements }: Props) {
  const { accounts } = useAccounts();
  const { currency, convert, format } = useSettings();

  // 👇 movimientos vienen del server (Supabase)
  const movements = initialMovements;

  const [showHelp, setShowHelp] = useState(false);
  const [showBalances, setShowBalances] = useState(false);

  // ---------- Agrupación real ingresos/gastos por mes ----------
  const cashflowData = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();

    for (const m of movements) {
      if (m.type !== "INGRESO" && m.type !== "GASTO") continue;
      if (!m.date) continue;

      const d = new Date(m.date);
      if (Number.isNaN(d.getTime())) continue;

      const y = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const key = `${y}-${mm}`;

      const current = map.get(key) ?? { income: 0, expense: 0 };

      const amountInBase = convert(m.amount, {
        from: m.currency,
        to: currency,
      });

      if (m.type === "INGRESO") current.income += amountInBase;
      else current.expense += Math.abs(amountInBase);

      map.set(key, current);
    }

    const now = new Date();
    const result: { month: string; income: number; expense: number }[] = [];

    // últimos 6 meses
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const key = `${y}-${mm}`;
      const entry = map.get(key) ?? { income: 0, expense: 0 };

      const label = d.toLocaleDateString("es-UY", { month: "short" });

      result.push({
        month: label,
        income: entry.income,
        expense: entry.expense,
      });
    }

    return result;
  }, [movements, convert, currency]);

  // ---------- Resumen del último mes ----------
  const cashflowSummary = useMemo(() => {
    if (!cashflowData.length)
      return { month: "", income: 0, expense: 0, net: 0 };
    const last = cashflowData[cashflowData.length - 1];
    return {
      ...last,
      net: last.income - last.expense,
    };
  }, [cashflowData]);

  // ---------- Evolución del ahorro a partir del cashflow ----------
  // Tomamos los mismos 6 meses y acumulamos el (ingresos - gastos)
  const combinedEvolutionData = useMemo(() => {
    if (!cashflowData.length) return [];

    let running = 0;
    return cashflowData.map((p) => {
      const net = p.income - p.expense;
      running += net;
      return {
        month: p.month,
        savings: running,
      };
    });
  }, [cashflowData]);

  const evolutionTitle = "Evolución del ahorro";
  const evolutionSubtitle =
    "Muestra cómo fue cambiando tu ahorro neto mes a mes, a partir de tus ingresos y gastos.";

  // ---------- Cálculo de distribución por cuenta (A PARTIR DE MOVIMIENTOS) ----------
  const { rows, totalBase, richestAccount } = useMemo(() => {
    if (!accounts.length)
      return {
        rows: [] as Row[],
        totalBase: 0,
        richestAccount: undefined as Row | undefined,
      };

    // 1) Saldos nativos por cuenta (sumando ingresos - gastos)
    const nativeById = new Map<string, number>();
    for (const acc of accounts) {
      nativeById.set(acc.id, 0);
    }

    for (const m of movements) {
      if (m.type !== "INGRESO" && m.type !== "GASTO") continue;
      if (!m.accountId) continue;

      const current = nativeById.get(m.accountId) ?? 0;
      const delta = m.type === "INGRESO" ? m.amount : -m.amount;
      nativeById.set(m.accountId, current + delta);
    }

    // 2) Convertimos a moneda base y calculamos % del total
    let totalBase = 0;
    const tmpRows: Row[] = accounts.map((acc) => {
      const native = nativeById.get(acc.id) ?? 0;
      const base = convert(native, {
        from: acc.currency,
        to: currency,
      });

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

    const rows: Row[] = tmpRows.map((r) => ({
      ...r,
      share: totalBase > 0 ? (r.base / totalBase) * 100 : 0,
    }));

    const richestAccount =
      rows.length > 0
        ? rows.reduce((max, r) => (r.base > max.base ? r : max), rows[0])
        : undefined;

    return { rows, totalBase, richestAccount };
  }, [accounts, movements, currency, convert]);

  // =====================================================
  //            RENDER DEL DASHBOARD
  // =====================================================

  return (
    <div className="p-6 space-y-6">
      {/* ------- TÍTULO ------- */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Resumen</h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Vista general de sus finanzas en Control+. Aquí podrá ver el saldo
            total, cómo se reparte entre cuentas y accesos rápidos a ahorro,
            presupuestos y deudas.
          </p>
        </div>

        <span className="self-start text-xs px-2 py-1 rounded-full bg-slate-800/60 text-slate-300">
          Mostrando en: <span className="font-semibold">{currency}</span>
        </span>
      </div>

      {/* =====================================================
                BLOQUE 1 — Evolución + Cashflow
        ===================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ---------- Evolución ahorro ---------- */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-[#0f1830] p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-medium">{evolutionTitle}</div>
              <div className="text-xs text-slate-500">
                {evolutionSubtitle}
              </div>
            </div>
          </div>

          {/* ---------- Gráfico principal ---------- */}
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combinedEvolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="month"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickFormatter={(v: number) => format(v)}
                  tickLine={false}
                />

                <Tooltip
                  formatter={(value: number) => [format(value), "Ahorro neto"]}
                  contentStyle={{
                    backgroundColor: "#020617",
                    border: "1px solid #1f2937",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="savings"
                  name="Ahorro neto"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ---------- Caja ingresos vs gastos ---------- */}
        <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4 flex flex-col">
          <div className="flex items-start justify-between mb-2 gap-3">
            <div>
              <div className="text-sm font-medium">
                Ingresos vs gastos (últimos meses)
              </div>
              <div className="text-xs text-slate-500">
                Comparación simple entre lo que entra y lo que sale, basada en
                sus movimientos registrados.
              </div>
            </div>

            {/* Resumen último mes */}
            <div className="text-right text-xs">
              <div className="text-slate-400 mb-0.5">
                Último mes: {cashflowSummary.month || "—"}
              </div>

              <div className="text-slate-300">
                Ingresos:{" "}
                <span className="font-semibold">
                  {format(cashflowSummary.income)}
                </span>
              </div>

              <div className="text-slate-300">
                Gastos:{" "}
                <span className="font-semibold">
                  {format(cashflowSummary.expense)}
                </span>
              </div>

              <div
                className={
                  "mt-1 font-semibold " +
                  (cashflowSummary.net >= 0
                    ? "text-emerald-400"
                    : "text-rose-400")
                }
              >
                Resultado: {cashflowSummary.net >= 0 ? "+" : ""}
                {format(cashflowSummary.net)}
              </div>
            </div>
          </div>

          {/* ---------- Gráfico ingresos/gastos ---------- */}
          <div className="h-52 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="month"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickFormatter={(v: number) => format(v)}
                  tickLine={false}
                />

                <Tooltip
                  formatter={(value: number, name: string) => [
                    format(value),
                    name === "income" ? "Ingresos" : "Gastos",
                  ]}
                  labelFormatter={(label) => `Mes: ${label}`}
                  contentStyle={{
                    backgroundColor: "#020617",
                    border: "1px solid #1f2937",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />

                <Bar
                  dataKey="income"
                  name="Ingresos"
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="expense"
                  name="Gastos"
                  fill="#f97316"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex justify-end">
            <Link
              href="/movimientos"
              className="text-[11px] px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              Ver análisis detallado →
            </Link>
          </div>
        </div>
      </div>

      {/* BLOQUE 2 — Panel de ayuda */}
      <div className="rounded-xl border border-dashed border-slate-800 bg-[#050816] p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">
            Resumen visual del sistema
          </div>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="text-[11px] px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
          >
            {showHelp ? "Ocultar detalle" : "¿Qué estoy viendo?"}
          </button>
        </div>

        {showHelp ? (
          <p className="text-xs text-slate-400 mt-1 space-y-1">
            <span className="block">
              •{" "}
              <strong>Evolución del ahorro:</strong> muestra cómo cambia tu
              ahorro neto a lo largo de los meses.
            </span>
            <span className="block">
              • <strong>Ingresos vs gastos:</strong> te da una vista rápida de
              si en los últimos meses estás gastando por encima o por debajo de
              lo que ingresás.
            </span>
            <span className="block mt-1">
              Para un análisis más profundo (categorías, períodos, ratios,
              etc.), usá la sección de Movimientos.
            </span>
          </p>
        ) : (
          <p className="text-xs text-slate-500 mt-1">
            Este panel resume lo que muestran los gráficos de ahorro e
            ingresos/gastos. Podés desplegarlo cuando necesites una explicación
            rápida.
          </p>
        )}
      </div>

      {/* BLOQUE 3 — Tarjetas KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Saldo total */}
        <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
          <div className="text-xs text-slate-400 mb-2">Saldo total</div>
          <div className="text-2xl font-semibold">{format(totalBase)}</div>
          <div className="mt-2 text-xs text-slate-500">
            Suma de todas las cuentas registradas, convertidas a {currency}.
          </div>
          <div className="mt-4">
            <Link
              href="/ahorro"
              className="text-xs font-medium text-sky-400 hover:text-sky-300"
            >
              Ver detalle de cuentas →
            </Link>
          </div>
        </div>

        {/* Cuentas activas */}
        <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
          <div className="text-xs text-slate-400 mb-2">Cuentas activas</div>
          <div className="text-2xl font-semibold">{accounts.length}</div>
          <div className="mt-2 text-xs text-slate-500">
            Incluye bancos, billeteras y efectivo configurados en el sistema.
          </div>
          <div className="mt-4">
            <Link
              href="/ahorro"
              className="text-xs font-medium text-sky-400 hover:text-sky-300"
            >
              Gestionar cuentas →
            </Link>
          </div>
        </div>

        {/* Cuenta principal */}
        <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
          <div className="text-xs text-slate-400 mb-2">
            Cuenta con mayor saldo
          </div>
          {richestAccount ? (
            <>
              <div className="mt-1 text-sm font-medium">
                {richestAccount.name}
              </div>
              <div className="mt-1 text-lg font-semibold">
                {format(richestAccount.base)}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {richestAccount.native.toFixed(2)}{" "}
                <span className="text-slate-500">
                  ({richestAccount.nativeCurrency})
                </span>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                Ideal para identificar dónde se concentra tu liquidez.
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500">
              Todavía no cargaste cuentas con saldo. Podés comenzar desde la
              sección de Ahorro.
            </div>
          )}
        </div>
      </div>

      {/* BLOQUE 4 — Saldos por cuenta + Próximos pasos */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
        {/* Tabla rápida de cuentas (colapsable) */}
        <div className="xl:col-span-2 rounded-xl border border-slate-800 bg-[#0f1830] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Saldos por cuenta</div>
              <div className="text-xs text-slate-500">
                Resumen abreviado de tus cuentas. El detalle completo se
                encuentra en la sección de Ahorro.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowBalances((v) => !v)}
              className="text-[11px] px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              {showBalances ? "Ocultar" : "Ver detalle"}
            </button>
          </div>

          {showBalances && rows.length > 0 && (
            <>
              {/* Encabezados */}
              <div className="grid grid-cols-12 px-4 py-3 text-xs uppercase tracking-wide text-slate-400 border-b border-slate-800">
                <div className="col-span-4">Cuenta</div>
                <div className="col-span-3">Saldo nativo</div>
                <div className="col-span-3">Saldo en {currency}</div>
                <div className="col-span-2 text-right">% del total</div>
              </div>

              {rows.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-12 px-4 py-3 border-b border-slate-900/40 text-sm"
                >
                  <div className="col-span-4 text-slate-200">{r.name}</div>
                  <div className="col-span-3 text-slate-300">
                    {r.native.toFixed(2)}{" "}
                    <span className="text-xs text-slate-500">
                      {r.nativeCurrency}
                    </span>
                  </div>
                  <div className="col-span-3 font-medium">
                    {format(r.base)}
                  </div>
                  <div className="col-span-2 text-right text-slate-300">
                    {r.share.toFixed(1)}%
                  </div>
                </div>
              ))}
            </>
          )}

          {!showBalances && (
            <div className="p-4 text-xs text-slate-500">
              Tocá <span className="font-semibold">“Ver detalle”</span> para
              ver cómo se reparte tu saldo entre cuentas.
            </div>
          )}

          {showBalances && rows.length === 0 && (
            <div className="p-6 text-sm text-slate-400">
              Todavía no registraste cuentas con saldo. Una vez lo hagas, acá
              vas a ver cómo se reparte tu dinero entre bancos, billeteras y
              efectivo.
            </div>
          )}
        </div>

        {/* Accesos rápidos / estado general */}
        <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4 flex flex-col justify-between">
          <div>
            <div className="text-sm font-medium mb-1">
              Próximos pasos recomendados
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Usá estas secciones para completar tu configuración financiera
              en Control+.
            </p>

            <ul className="space-y-2 text-xs">
              <li>
                <span className="font-semibold text-slate-200">
                  1. Definir presupuestos del mes
                </span>
                <br />
                <span className="text-slate-400">
                  Establecé límites por categoría (comida, salidas,
                  transporte, etc.) y mirá cuánto llevás gastado.
                </span>
                <div className="mt-1">
                  <Link
                    href="/presupuestos"
                    className="text-[11px] font-medium text-sky-400 hover:text-sky-300"
                  >
                    Ir a Presupuestos →
                  </Link>
                </div>
              </li>

              <li className="pt-2 border-t border-slate-800/70">
                <span className="font-semibold text-slate-200">
                  2. Registrar deudas importantes
                </span>
                <br />
                <span className="text-slate-400">
                  Cargá préstamos, tarjetas y otros compromisos para ver cuotas
                  del mes y vencimientos.
                </span>
                <div className="mt-1">
                  <Link
                    href="/deudas"
                    className="text-[11px] font-medium text-sky-400 hover:text-sky-300"
                  >
                    Ir a Deudas →
                  </Link>
                </div>
              </li>

              <li className="pt-2 border-t border-slate-800/70">
                <span className="font-semibold text-slate-200">
                  3. Revisar ahorro y objetivos
                </span>
                <br />
                <span className="text-slate-400">
                  Usá la sección de Ahorro para ver en qué cuentas se
                  concentran tus fondos y, más adelante, configurar metas
                  específicas.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
