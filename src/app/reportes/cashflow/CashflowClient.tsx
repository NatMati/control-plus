// src/app/reportes/cashflow/CashflowClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

// Plotly debe cargarse solo en cliente
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type Props = {
  from: string; // "YYYY-MM"
  to: string;   // "YYYY-MM"
};

type Movement = {
  date: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  category: string | null;
};

type SankeyData = {
  labels: string[];
  source: number[];
  target: number[];
  value: number[];
};

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "setiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

export default function CashflowClient({ from, to }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // estado de los selectores
  const [fromMonth, setFromMonth] = useState<number>(() => {
    const [, m] = from.split("-").map(Number);
    return m || new Date().getMonth() + 1;
  });
  const [fromYear, setFromYear] = useState<number>(() => {
    const [y] = from.split("-").map(Number);
    return y || new Date().getFullYear();
  });

  const [toMonth, setToMonth] = useState<number>(() => {
    const [, m] = to.split("-").map(Number);
    return m || new Date().getMonth() + 1;
  });
  const [toYear, setToYear] = useState<number>(() => {
    const [y] = to.split("-").map(Number);
    return y || new Date().getFullYear();
  });

  // datos de la API
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // cuando cambia from/to (vienen del server) → recargo datos
  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const url = `/api/reports/cashflow?from=${from}&to=${to}`;
        const res = await fetch(url, { signal: controller.signal });

        if (!res.ok) {
          const text = await res.text();
          console.error("[cashflow] Error HTTP", res.status, text);
          setError(`Error HTTP ${res.status}`);
          setMovements([]);
          return;
        }

        const json = await res.json();
        setMovements(json.movements ?? []);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        console.error("[cashflow] Error de red", e);
        setError("Error al cargar los datos");
        setMovements([]);
      } finally {
        setLoading(false);
      }
    }

    load();

    return () => controller.abort();
  }, [from, to]);

  // cuando el usuario toca "Aplicar"
  const handleApply = () => {
    const newFrom = `${fromYear}-${pad2(fromMonth)}`;
    const newTo = `${toYear}-${pad2(toMonth)}`;

    const params = new URLSearchParams(searchParams.toString());
    params.set("from", newFrom);
    params.set("to", newTo);

    router.push(`/reportes/cashflow?${params.toString()}`);
  };

  // construir Sankey a partir de movimientos
  const sankeyData: SankeyData | null = useMemo(() => {
    if (!movements.length) return null;

    const incomes = movements.filter((m) => m.type === "INCOME");
    const expenses = movements.filter((m) => m.type === "EXPENSE");

    if (!incomes.length && !expenses.length) return null;

    const labels: string[] = [];
    const index = new Map<string, number>();
    const source: number[] = [];
    const target: number[] = [];
    const value: number[] = [];

    const ensureNode = (label: string) => {
      if (!index.has(label)) {
        index.set(label, labels.length);
        labels.push(label);
      }
      return index.get(label)!;
    };

    const ingresosNode = ensureNode("Ingresos");

    // sumar ingresos totales
    const totalIncome = incomes.reduce(
      (sum, m) => sum + Math.max(0, m.amount),
      0
    );

    // sumar gastos por categoría
    const expenseByCat = new Map<string, number>();
    for (const m of expenses) {
      const cat = m.category?.trim() || "Otros gastos";
      const current = expenseByCat.get(cat) ?? 0;
      expenseByCat.set(cat, current + Math.abs(m.amount));
    }

    const totalExpenses = Array.from(expenseByCat.values()).reduce(
      (a, b) => a + b,
      0
    );

    // Enlaces: Ingresos -> Categoría de gasto
    for (const [cat, amount] of expenseByCat.entries()) {
      const catNode = ensureNode(cat);
      source.push(ingresosNode);
      target.push(catNode);
      value.push(amount);
    }

    // Si queda ingreso sin gastar → Ahorro/Inversiones
    if (totalIncome > totalExpenses) {
      const saveNode = ensureNode("Ahorro / Inversiones");
      source.push(ingresosNode);
      target.push(saveNode);
      value.push(totalIncome - totalExpenses);
    }

    return { labels, source, target, value };
  }, [movements]);

  // años para los selects (podés ajustar el rango que quieras)
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years: number[] = [];
    for (let y = current - 3; y <= current + 1; y++) years.push(y);
    return years;
  }, []);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-900/40 border border-slate-800 rounded-xl px-4 py-3 text-sm">
        <span className="text-slate-400 mr-2">Desde</span>
        <select
          value={fromMonth}
          onChange={(e) => setFromMonth(Number(e.target.value))}
          className="bg-slate-900 border border-slate-700 rounded px-2 py-1"
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={fromYear}
          onChange={(e) => setFromYear(Number(e.target.value))}
          className="bg-slate-900 border border-slate-700 rounded px-2 py-1"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <span className="text-slate-400 mx-2">Hasta</span>

        <select
          value={toMonth}
          onChange={(e) => setToMonth(Number(e.target.value))}
          className="bg-slate-900 border border-slate-700 rounded px-2 py-1"
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={toYear}
          onChange={(e) => setToYear(Number(e.target.value))}
          className="bg-slate-900 border border-slate-700 rounded px-2 py-1"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <button
          onClick={handleApply}
          className="ml-auto bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-sm"
        >
          Aplicar
        </button>
      </div>

      {/* Estado / errores */}
      {loading && (
        <p className="text-sm text-slate-400">Cargando movimientos…</p>
      )}
      {error && (
        <p className="text-sm text-red-400">
          Debug: {error}. Verificá que estés logueado.
        </p>
      )}

      {!loading && !error && !movements.length && (
        <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
          No hay movimientos registrados en este período. Registrá ingresos y
          gastos para ver tu flujo de dinero.
        </div>
      )}

      {/* Sankey */}
      {!loading && !error && movements.length > 0 && sankeyData && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
          <Plot
            data={[
              {
                type: "sankey",
                orientation: "h",
                node: {
                  label: sankeyData.labels,
                  pad: 20,
                  thickness: 16,
                  line: {
                    color: "rgba(148, 163, 184, 0.4)",
                    width: 1,
                  },
                },
                link: {
                  source: sankeyData.source,
                  target: sankeyData.target,
                  value: sankeyData.value,
                },
              } as any,
            ]}
            layout={{
              autosize: true,
              font: { color: "#e5e7eb", size: 12 },
              paper_bgcolor: "rgba(15,23,42,1)",
              plot_bgcolor: "rgba(15,23,42,1)",
              margin: { l: 40, r: 40, t: 20, b: 20 },
            }}
            style={{ width: "100%", height: 480 }}
            config={{ displayModeBar: false, responsive: true }}
          />
        </div>
      )}
    </div>
  );
}
