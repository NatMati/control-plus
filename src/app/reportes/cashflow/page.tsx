// src/app/reportes/cashflow/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type SankeyLink = {
  source: number;
  target: number;
  value: number;
};

type SankeyData = {
  nodes: string[];
  links: SankeyLink[];
};

type ApiResponse = {
  rows: any[];
  fromDate: string;
  toDate: string;
  sankey?: SankeyData | null;
  error?: string;
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

export default function CashflowPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [fromMonth, setFromMonth] = useState<string>("");
  const [fromYear, setFromYear] = useState<string>("");
  const [toMonth, setToMonth] = useState<string>("");
  const [toYear, setToYear] = useState<string>("");

  const [activeFrom, setActiveFrom] = useState<string | null>(null);
  const [activeTo, setActiveTo] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  // Zoom del diagrama y del texto (independientes)
  const [flowZoom, setFlowZoom] = useState<number>(100);   // escala del diagrama
  const [labelZoom, setLabelZoom] = useState<number>(100); // tamaño de texto

  // 1) Inicializar selects con querystring o mes actual
  useEffect(() => {
    const now = new Date();
    const defaultYear = now.getFullYear().toString();
    const defaultMonth = String(now.getMonth() + 1).padStart(2, "0");

    const urlFrom = searchParams.get("from");
    const urlTo = searchParams.get("to");

    const from =
      urlFrom && /^\d{4}-\d{2}$/.test(urlFrom)
        ? urlFrom
        : `${defaultYear}-${defaultMonth}`;

    const to = urlTo && /^\d{4}-\d{2}$/.test(urlTo) ? urlTo : from;

    setFromYear(from.slice(0, 4));
    setFromMonth(from.slice(5, 7));
    setToYear(to.slice(0, 4));
    setToMonth(to.slice(5, 7));

    setActiveFrom(from);
    setActiveTo(to);
  }, [searchParams]);

  // 2) Cuando cambian rango → llamar API
  useEffect(() => {
    if (!activeFrom || !activeTo) return;

    const controller = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);
        setApiError(null);

        const params = new URLSearchParams({
          from: activeFrom,
          to: activeTo,
        });

        const res = await fetch(
          `/api/movements/cashflow?${params.toString()}`,
          { method: "GET", signal: controller.signal }
        );

        const json = (await res.json()) as ApiResponse;

        if (!res.ok) {
          setApiError(json.error || `Error HTTP ${res.status}`);
          setData(null);
          return;
        }

        setData(json);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setApiError(e?.message ?? "Error al cargar datos");
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => controller.abort();
  }, [activeFrom, activeTo]);

  const handleApply = () => {
    const from = `${fromYear}-${fromMonth}`;
    const to = `${toYear}-${toMonth}`;

    setActiveFrom(from);
    setActiveTo(to);

    const params = new URLSearchParams(searchParams.toString());
    params.set("from", from);
    params.set("to", to);

    router.replace(`?${params.toString()}`);
  };

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const arr: number[] = [];
    for (let y = currentYear - 5; y <= currentYear + 5; y++) {
      arr.push(y);
    }
    return arr;
  }, []);

  // Sankey ya viene armado desde el backend
  const sankey = useMemo(() => {
    if (!data || !data.sankey) return null;
    if (!data.sankey.nodes || data.sankey.nodes.length === 0) return null;
    if (!data.sankey.links || data.sankey.links.length === 0) return null;
    return data.sankey;
  }, [data]);

  const plotSources = sankey?.links.map((l) => l.source) ?? [];
  const plotTargets = sankey?.links.map((l) => l.target) ?? [];
  const plotValues = sankey?.links.map((l) => l.value) ?? [];

  // -------- ZOOMS SEPARADOS --------
  const flowScale = flowZoom / 100;
  const labelScale = labelZoom / 100;

  // ALTURA BASE AUMENTADA para más espacio vertical
  const baseHeight = 700; // antes era 500
  const plotHeight = Math.round(baseHeight * flowScale);

  const baseFont = 10;
  const fontSize = Math.max(8, Math.round(baseFont * labelScale));

  const baseThickness = 18;
  const nodeThickness = Math.max(8, Math.round(baseThickness * flowScale));

  const basePad = 15;
  const nodePad = Math.round(basePad * flowScale);

  return (
    <main className="px-6 py-6 space-y-4">
      <h1 className="text-2xl font-semibold mb-4">Cashflow</h1>

      {/* Filtros + Zooms */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm text-gray-300 mb-1">
            Desde (mes / año)
          </label>
          <div className="flex gap-2">
            <select
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
              value={fromMonth}
              onChange={(e) => setFromMonth(e.target.value)}
            >
              {MONTHS.map((m, idx) => {
                const value = String(idx + 1).padStart(2, "0");
                return (
                  <option key={value} value={value}>
                    {m}
                  </option>
                );
              })}
            </select>

            <select
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
              value={fromYear}
              onChange={(e) => setFromYear(e.target.value)}
            >
              {years.map((y) => (
                <option key={y} value={y.toString()}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">
            Hasta (mes / año)
          </label>
          <div className="flex gap-2">
            <select
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
              value={toMonth}
              onChange={(e) => setToMonth(e.target.value)}
            >
              {MONTHS.map((m, idx) => {
                const value = String(idx + 1).padStart(2, "0");
                return (
                  <option key={value} value={value}>
                    {m}
                  </option>
                );
              })}
            </select>

            <select
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
              value={toYear}
              onChange={(e) => setToYear(e.target.value)}
            >
              {years.map((y) => (
                <option key={y} value={y.toString()}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleApply}
          className="bg-emerald-500 hover:bg-emerald-600 text-sm font-medium px-4 py-2 rounded transition-colors"
        >
          Aplicar
        </button>

        {/* Controles de zoom a la derecha */}
        <div className="ml-auto flex flex-wrap items-end gap-4">
          <div className="flex flex-col text-xs text-gray-400">
            <span className="mb-1">Zoom diagrama</span>
            <select
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-gray-100"
              value={flowZoom}
              onChange={(e) => setFlowZoom(Number(e.target.value))}
            >
              <option value={50}>50%</option>
              <option value={75}>75%</option>
              <option value={100}>100%</option>
              <option value={125}>125%</option>
              <option value={150}>150%</option>
            </select>
          </div>

          <div className="flex flex-col text-xs text-gray-400">
            <span className="mb-1">Texto</span>
            <select
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-gray-100"
              value={labelZoom}
              onChange={(e) => setLabelZoom(Number(e.target.value))}
            >
              <option value={75}>Pequeño</option>
              <option value={100}>Normal</option>
              <option value={125}>Grande</option>
              <option value={150}>Muy grande</option>
            </select>
          </div>
        </div>
      </div>

      {/* Mensajes */}
      {apiError && (
        <div className="mt-4 rounded border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          Error: {apiError}
        </div>
      )}

      <div className="mt-4 min-h-[300px]">
        {loading && <p className="text-sm text-gray-300">Cargando...</p>}

        {!loading && !apiError && data && data.rows.length === 0 && (
          <p className="text-sm text-gray-300">
            No hay movimientos registrados en este período.
          </p>
        )}

        {!loading && !apiError && data && data.rows.length > 0 && !sankey && (
          <p className="text-sm text-gray-300">
            Hay movimientos en este período, pero no se pudo armar el diagrama
            de flujo. Esto suele pasar cuando no hay ingresos claros en el
            rango seleccionado (solo gastos o transferencias).
          </p>
        )}

        {!loading && sankey && (
          <Plot
            data={[
              {
                type: "sankey",
                orientation: "h",
                node: {
                  label: sankey.nodes,
                  pad: nodePad,
                  thickness: nodeThickness,
                  line: { width: 0.5, color: "#0f172a" },
                },
                link: {
                  source: plotSources,
                  target: plotTargets,
                  value: plotValues,
                },
              } as any,
            ]}
            layout={{
              margin: { l: 20, r: 20, t: 20, b: 20 },
              height: plotHeight,
              font: { size: fontSize, color: "#e5e5e5" },
              paper_bgcolor: "rgba(0,0,0,0)",
              plot_bgcolor: "rgba(0,0,0,0)",
            }}
            style={{ width: "100%", height: plotHeight }}
            config={{
              displaylogo: false,
              responsive: true,
              toImageButtonOptions: {
                format: "png",
                filename: "cashflow-control-plus",
              },
              locale: "es",
            }}
          />
        )}
      </div>
    </main>
  );
}
