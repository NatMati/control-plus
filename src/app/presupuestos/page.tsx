// src/app/presupuestos/page.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useBudgets } from "@/context/BudgetsContext";
import { useSettings } from "@/context/SettingsContext";
import { useAccounts } from "@/context/AccountsContext";

function getCurrentMonthValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getLastMonths(count: number): string[] {
  const now = new Date();
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    result.push(`${y}-${m}`);
  }
  return result;
}

function formatMonthLabelEs(value: string): string {
  const [y, m] = value.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("es-UY", {
    month: "long",
    year: "numeric",
  });
}

export default function PresupuestosPage() {
  const { budgets, getBudgetsForMonth } = useBudgets();
  const { convert, format, currency: baseCurrency } = useSettings();
  const { movements } = useAccounts();

  const currentMonth = getCurrentMonthValue();
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);

  const monthOptions = useMemo(() => getLastMonths(6), []);

  const budgetsForMonth = useMemo(
    () => getBudgetsForMonth(selectedMonth),
    [getBudgetsForMonth, selectedMonth]
  );

  // 🔹 GASTOS REALES DEL MES SELECCIONADO (solo tipo GASTO)
  const gastosDelMes = useMemo(
    () =>
      movements.filter(
        (m) =>
          m.type === "GASTO" &&
          // m.date viene como "YYYY-MM-DD" → comparamos "YYYY-MM"
          m.date.slice(0, 7) === selectedMonth
      ),
    [movements, selectedMonth]
  );

  // 🔹 RESUMEN POR CATEGORÍA (presupuesto + gastado + % + estado)
  const categoryRows = useMemo(() => {
    return budgetsForMonth.map((b) => {
      const limitInBase = convert(b.limit, {
        from: b.currency,
        to: baseCurrency,
      });

      const spentInBase = gastosDelMes.reduce((acc, mov) => {
        const movCat = (mov.category ?? "").trim().toLowerCase();
        const budgetCat = b.category.trim().toLowerCase();
        if (movCat !== budgetCat) return acc;

        const valor = convert(mov.amount, {
          from: mov.currency,
          to: baseCurrency,
        });
        return acc + valor;
      }, 0);

      const percentUsed =
        limitInBase > 0 ? (spentInBase / limitInBase) * 100 : 0;

      const estado =
        limitInBase === 0
          ? "Sin monto"
          : percentUsed >= 110
          ? "Muy pasado"
          : percentUsed >= 100
          ? "Superado"
          : percentUsed >= 80
          ? "Alto"
          : "En curso";

      return {
        id: b.id,
        category: b.category,
        currency: b.currency,
        limitInBase,
        spentInBase,
        percentUsed,
        estado,
      };
    });
  }, [budgetsForMonth, gastosDelMes, convert, baseCurrency]);

  // 🔹 TOTALES GENERALES (usando los datos ya calculados por categoría)
  const { totalLimitBase, totalSpentBase, percentUsed } = useMemo(() => {
    const totalLimitBase = categoryRows.reduce(
      (acc, r) => acc + r.limitInBase,
      0
    );
    const totalSpentBase = categoryRows.reduce(
      (acc, r) => acc + r.spentInBase,
      0
    );

    const percentUsed =
      totalLimitBase > 0 ? (totalSpentBase / totalLimitBase) * 100 : 0;

    return { totalLimitBase, totalSpentBase, percentUsed };
  }, [categoryRows]);

  // 🔹 CATEGORÍAS DE RIESGO / ALERTAS
  const highRiskCategories = useMemo(
    () => categoryRows.filter((r) => r.percentUsed >= 100),
    [categoryRows]
  );

  const nearLimitCategories = useMemo(
    () =>
      categoryRows.filter(
        (r) => r.percentUsed >= 80 && r.percentUsed < 100
      ),
    [categoryRows]
  );

  const lowUsageCategories = useMemo(
    () =>
      categoryRows.filter(
        (r) => r.spentInBase > 0 && r.percentUsed <= 30
      ),
    [categoryRows]
  );

  // 🔹 CATEGORÍAS CON GASTOS PERO SIN PRESUPUESTO
  const unbudgetedCategories = useMemo(() => {
    if (!gastosDelMes.length) return [];

    const setPresupuesto = new Set(
      budgetsForMonth.map((b) => b.category.trim().toLowerCase())
    );

    const map = new Map<string, number>();

    for (const g of gastosDelMes) {
      const rawCat = (g.category ?? "").trim();
      if (!rawCat) continue;
      const norm = rawCat.toLowerCase();

      if (setPresupuesto.has(norm)) continue;

      const valor = convert(g.amount, {
        from: g.currency,
        to: baseCurrency,
      });
      map.set(rawCat, (map.get(rawCat) ?? 0) + valor);
    }

    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [gastosDelMes, budgetsForMonth, convert, baseCurrency]);

  // 🔹 Texto del resumen inteligente (global)
  const resumenTexto = useMemo(() => {
    if (budgetsForMonth.length === 0) {
      return "Todavía no configuraste presupuestos para este mes. Creá al menos un presupuesto por categoría para empezar a ver alertas e indicadores.";
    }

    if (totalLimitBase === 0) {
      return "Tenés categorías configuradas pero con monto 0. Asigná un límite a cada una para que el sistema pueda medir tu avance.";
    }

    if (percentUsed >= 100) {
      return "Superaste el presupuesto total del mes. Revisá en qué categorías se concentró el exceso para ajustar el próximo mes.";
    }

    if (percentUsed >= 80) {
      return "Vas usando más del 80% de tu presupuesto del mes. Es un buen momento para moderar gastos en las categorías más altas.";
    }

    if (percentUsed <= 30 && gastosDelMes.length > 0) {
      return "Tus gastos todavía están bastante por debajo del presupuesto del mes. Mantené el ritmo y revisá periódicamente para no pasarte al final.";
    }

    if (gastosDelMes.length === 0) {
      return "Ya tenés presupuestos configurados, pero todavía no registraste gastos este mes. A medida que los registres vas a ver acá tu avance real.";
    }

    return "Tus gastos vienen alineados con el presupuesto del mes. Usá las categorías para detectar dónde se concentra el gasto y ajustar si es necesario.";
  }, [
    budgetsForMonth,
    totalLimitBase,
    percentUsed,
    gastosDelMes.length,
  ]);

  // 🔹 Listas recortadas para mostrar en las alertas visuales
  const topHighRisk = highRiskCategories.slice(0, 3);
  const topNearLimit = nearLimitCategories.slice(0, 3);
  const topUnbudgeted = unbudgetedCategories.slice(0, 3);

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Presupuestos</h1>
          <p className="text-sm text-slate-400 max-w-2xl mt-1">
            Definí un límite por categoría (comida, salidas, transporte, etc.)
            y mirá cuánto llevás gastado en el mes. Más adelante esta sección
            va a activar alertas cuando te acerques o pases esos límites.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="text-xs text-slate-400 mb-1">Mes seleccionado</div>
          <div className="flex items-center gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-[#020617] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabelEs(m)}
                </option>
              ))}
            </select>

            <Link
              href={`/presupuestos/nuevo?month=${selectedMonth}`}
              className="bg-[#3b82f6] hover:bg-blue-500 text-white text-sm rounded-lg px-4 py-2"
            >
              Crear nuevo presupuesto
            </Link>
          </div>

          <span className="text-[11px] text-slate-500">
            Mostrando datos para {formatMonthLabelEs(selectedMonth)}.
          </span>
        </div>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Presupuesto mensual activo */}
        <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
          <div className="text-xs text-slate-400 mb-2">
            Presupuesto mensual activo
          </div>
          <div className="text-2xl font-semibold">{format(totalLimitBase)}</div>
          <div className="mt-2 text-xs text-slate-500">
            Suma de todos los presupuestos activos del mes, convertidos a{" "}
            {baseCurrency}.
          </div>
        </div>

        {/* Gasto este mes (real) */}
        <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
          <div className="text-xs text-slate-400 mb-2">Gasto este mes</div>
          <div className="text-2xl font-semibold">
            {format(totalSpentBase)}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Basado en los movimientos de tipo gasto registrados para este mes.
          </div>
        </div>

        {/* Porcentaje utilizado */}
        <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
          <div className="text-xs text-slate-400 mb-2">
            Porcentaje utilizado
          </div>
          <div className="text-2xl font-semibold">
            {percentUsed.toFixed(0)}%
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Relación entre el gasto del mes y el total presupuestado.
          </div>
        </div>
      </div>

      {/* Resumen inteligente + alertas */}
      <div className="rounded-xl border border-slate-800 bg-[#050816] p-4">
        <div className="text-sm font-medium mb-1">Resumen inteligente</div>
        <p className="text-xs text-slate-400">{resumenTexto}</p>

        {(topHighRisk.length > 0 ||
          topNearLimit.length > 0 ||
          topUnbudgeted.length > 0) && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
            {/* Categorías pasadas */}
            {topHighRisk.length > 0 && (
              <div className="rounded-lg border border-rose-700/60 bg-rose-900/10 px-3 py-2">
                <div className="text-rose-300 font-semibold mb-1">
                  Categorías pasadas del límite
                </div>
                <ul className="space-y-0.5 text-rose-100">
                  {topHighRisk.map((r) => (
                    <li key={r.id}>
                      <span className="font-medium">{r.category}</span>{" "}
                      · {r.percentUsed.toFixed(0)}% usado
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Categorías cerca del límite */}
            {topNearLimit.length > 0 && (
              <div className="rounded-lg border border-amber-600/60 bg-amber-900/10 px-3 py-2">
                <div className="text-amber-300 font-semibold mb-1">
                  Categorías cerca del límite
                </div>
                <ul className="space-y-0.5 text-amber-100">
                  {topNearLimit.map((r) => (
                    <li key={r.id}>
                      <span className="font-medium">{r.category}</span>{" "}
                      · {r.percentUsed.toFixed(0)}% usado
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Gastos sin presupuesto */}
            {topUnbudgeted.length > 0 && (
              <div className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2">
                <div className="text-slate-200 font-semibold mb-1">
                  Gastos sin presupuesto asignado
                </div>
                <ul className="space-y-0.5 text-slate-200">
                  {topUnbudgeted.map(([cat, val]) => (
                    <li key={cat}>
                      <span className="font-medium">{cat}</span>{" "}
                      · {format(val)}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[10px] text-slate-400">
                  Podés crear un presupuesto para estas categorías si querés
                  controlarlas mejor.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabla por categoría */}
      <div className="rounded-xl border border-slate-800 bg-[#0f1830] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="text-sm font-medium">Presupuestos por categoría</div>
          <div className="text-xs text-slate-500">
            Acá vas a ver cuánto tenés asignado y cuánto llevás gastado en cada
            categoría para el mes seleccionado.
          </div>
        </div>

        <div className="grid grid-cols-12 px-4 py-3 text-xs uppercase tracking-wide text-slate-400 border-b border-slate-800">
          <div className="col-span-4">Categoría</div>
          <div className="col-span-3">Presupuesto</div>
          <div className="col-span-3">Gastado</div>
          <div className="col-span-1 text-right">% usado</div>
          <div className="col-span-1 text-right">Estado</div>
        </div>

        {categoryRows.length === 0 ? (
          <div className="p-6 text-sm text-slate-400">
            Todavía no configuraste presupuestos para este mes. Podés crearlos
            desde el botón{" "}
            <span className="font-semibold">&quot;Crear nuevo presupuesto&quot;</span>.
          </div>
        ) : (
          categoryRows.map((r) => {
            const estadoColor =
              r.estado === "Muy pasado"
                ? "text-rose-400"
                : r.estado === "Superado"
                ? "text-rose-300"
                : r.estado === "Alto"
                ? "text-amber-300"
                : r.estado === "Sin monto"
                ? "text-slate-500"
                : "text-emerald-300";

            return (
              <div
                key={r.id}
                className="grid grid-cols-12 px-4 py-3 border-b border-slate-900/40 text-sm"
              >
                <div className="col-span-4 text-slate-200">{r.category}</div>
                <div className="col-span-3 text-slate-200">
                  {format(r.limitInBase)}{" "}
                  <span className="text-xs text-slate-500">
                    ({baseCurrency})
                  </span>
                </div>
                <div className="col-span-3 text-slate-300">
                  {format(r.spentInBase)}
                </div>
                <div className="col-span-1 text-right text-slate-300">
                  {r.percentUsed.toFixed(0)}%
                </div>
                <div
                  className={
                    "col-span-1 text-right text-xs font-medium " +
                    estadoColor
                  }
                >
                  {r.estado}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
