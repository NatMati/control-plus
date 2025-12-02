// src/app/ahorro/page.tsx
"use client";

import { useMemo } from "react";
import { useAccounts } from "@/context/AccountsContext";
import { useSettings, type Currency } from "@/context/SettingsContext";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import AccountGoals from "@/components/AccountGoals";

type Row = {
  id: string;
  name: string;
  native: number;
  nativeCurrency: Currency;
  base: number;
  share: number;
};

type ChartPoint = {
  name: string;
  value: number;
  share: number;
};

const CHART_COLORS = ["#3b82f6", "#22c55e", "#a855f7", "#f97316", "#e11d48"];

export default function AhorroPage() {
  const { accounts } = useAccounts();
  const { currency, convert, format } = useSettings();

  const {
    rows,
    totalBase,
    totalNativePerCurrency,
    richestAccount,
    chartData,
  } = useMemo(() => {
    if (!accounts.length) {
      return {
        rows: [] as Row[],
        totalBase: 0,
        totalNativePerCurrency: {} as Record<Currency, number>,
        richestAccount: undefined as Row | undefined,
        chartData: [] as ChartPoint[],
      };
    }

    let totalBase = 0;
    const totalNativePerCurrency: Record<Currency, number> = {
      USD: 0,
      EUR: 0,
      UYU: 0,
      ARS: 0,
      BRL: 0,
    };

    const tmpRows: Row[] = accounts.map((acc) => {
      const base = convert(acc.balance, {
        from: acc.currency,
        to: currency,
      });

      totalBase += base;
      totalNativePerCurrency[acc.currency] += acc.balance;

      return {
        id: acc.id,
        name: acc.name,
        native: acc.balance,
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

    const chartData: ChartPoint[] = rows.map((r) => ({
      name: r.name,
      value: r.base,
      share: r.share,
    }));

    return { rows, totalBase, totalNativePerCurrency, richestAccount, chartData };
  }, [accounts, currency, convert]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-semibold">Ahorro</h1>
        <span className="text-xs px-2 py-1 rounded-full bg-slate-800/60 text-slate-300">
          Mostrando en: <span className="font-semibold">{currency}</span>
        </span>
      </div>

      <p className="text-sm text-slate-400 max-w-2xl">
        Resumen de tus cuentas y saldos. Los movimientos que registres
        actualizarán estos montos automáticamente.
      </p>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total ahorrado */}
        <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
          <div className="text-xs text-slate-400 mb-2">Total ahorrado</div>
          <div className="text-2xl font-semibold">{format(totalBase)}</div>
          <div className="mt-2 text-xs text-slate-500">
            Suma de todos los saldos, convertidos a {currency}.
          </div>
        </div>

        {/* Cuentas activas */}
        <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
          <div className="text-xs text-slate-400 mb-2">Cuentas activas</div>
          <div className="text-2xl font-semibold">{accounts.length}</div>
          <div className="mt-2 text-xs text-slate-500">
            Cada cuenta puede representar un banco, billetera o efectivo.
          </div>
        </div>

        {/* Cuenta con mayor saldo */}
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
                Ideal para visualizar dónde se concentra tu ahorro.
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500">
              Aún no has registrado cuentas con saldo. Agrega movimientos para
              comenzar a visualizar tu ahorro.
            </div>
          )}
        </div>
      </div>

      {/* Detalle + gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        {/* Detalle por cuenta */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-[#0f1830] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <div className="text-sm font-medium">Detalle por cuenta</div>
            <div className="text-xs text-slate-500">
              Saldos en su moneda nativa y convertidos a {currency}.
            </div>
          </div>

          <div className="grid grid-cols-12 px-4 py-3 text-xs uppercase tracking-wide text-slate-400 border-b border-slate-800">
            <div className="col-span-4">Cuenta</div>
            <div className="col-span-3">Saldo nativo</div>
            <div className="col-span-3">Saldo en {currency}</div>
            <div className="col-span-2 text-right">% del total</div>
          </div>

          {rows.length === 0 ? (
            <div className="p-6 text-sm text-slate-400">
              Aún no has registrado cuentas con saldo. A medida que registres
              movimientos, verás aquí la distribución de tu ahorro.
            </div>
          ) : (
            rows.map((r) => (
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
            ))
          )}
        </div>

        {/* Gráfico de distribución */}
        <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4 flex flex-col">
          <div className="flex items-baseline justify-between mb-2">
            <div>
              <div className="text-sm font-medium">
                Distribución del ahorro
              </div>
              <div className="text-xs text-slate-500">
                Proporción de cada cuenta respecto al total.
              </div>
            </div>
          </div>

          {totalBase === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-slate-500 text-center px-4 leading-relaxed">
              Aún no dispones de distribución de ahorro.
              <br />
              Cuando registres saldos o múltiples cuentas, el gráfico se
              mostrará aquí.
            </div>
          ) : accounts.length === 1 ? (
            <div className="h-56 flex flex-col items-center justify-center gap-2">
              <div className="w-40 h-40 rounded-full border-4 border-blue-500/40 flex items-center justify-center">
                <span className="text-slate-300 text-sm">
                  {accounts[0].name}
                </span>
              </div>
              <span className="text-xs text-slate-500">
                Representa el 100% del ahorro
              </span>
            </div>
          ) : (
            <>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`slice-${entry.name}-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: unknown) =>
                        format(Number(value ?? 0))
                      }
                      contentStyle={{
                        backgroundColor: "#020617",
                        border: "1px solid #1f2937",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Leyenda */}
              <div className="mt-3ณฑ space-y-1">
                {chartData.map((d, i) => (
                  <div
                    key={`legend-${d.name}-${i}`}
                    className="flex items-center gap-2 text-xs text-slate-300"
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{
                        backgroundColor:
                          CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    />
                    <span className="flex-1 truncate">{d.name}</span>
                    <span className="text-slate-500">
                      {d.share.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Metas de ahorro por cuenta (usa AccountGoals) */}
      <div className="rounded-xl border border-slate-800 bg-[#050816] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Metas de ahorro por cuenta</div>
            <p className="text-xs text-slate-400">
              Crea objetivos como “Auto”, “PC nueva” o “Vacaciones” y asigna
              aportes desde tus movimientos.
            </p>
          </div>
        </div>

        {accounts.length === 0 ? (
          <p className="text-xs text-slate-500">
            Primero crea al menos una cuenta. Luego podrás definir metas de
            ahorro asociadas a cada una.
          </p>
        ) : (
          <div className="space-y-4">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="rounded-lg border border-slate-800 bg-[#020617] p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      Cuenta
                    </div>
                    <div className="text-sm font-medium text-slate-100">
                      {acc.name}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    Saldo actual:{" "}
                    <span className="font-semibold">
                      {format(
                        convert(acc.balance, {
                          from: acc.currency,
                          to: currency,
                        })
                      )}
                    </span>
                  </div>
                </div>

                {/* 👇 Componente que muestra y gestiona las metas de esta cuenta */}
                <AccountGoals accountId={acc.id} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
