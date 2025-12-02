// src/app/reportes/cashflow/page.client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sankey, Tooltip, ResponsiveContainer, Layer } from "recharts";

type CashflowSankeyNode = {
  id: string;
  name: string;
  type?: string;
};

type CashflowSankeyLink = {
  source: string;
  target: string;
  value: number;
};

// Tipos mínimos para Recharts
type SankeyNode = {
  name: string;
  type?: string;
  value?: number;
};

type SankeyLink = {
  source: number;
  target: number;
  value: number;
};

type SankeyData = {
  nodes: SankeyNode[];
  links: SankeyLink[];
};

type CashflowPageClientProps = {
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
  initialNodes: CashflowSankeyNode[];
  initialLinks: CashflowSankeyLink[];
  initialDebugInfo?: string;
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

// Colores por tipo de nodo
const getNodeColor = (type?: string) => {
  switch (type) {
    case "income":
      return "#22c55e"; // verde
    case "expense":
      return "#ef4444"; // rojo
    case "account":
      return "#3b82f6"; // azul
    case "category":
    default:
      return "#a855f7"; // violeta
  }
};

// Nodo custom con etiqueta visible
const CustomNode = (props: any) => {
  const { x, y, width, height, index, payload } = props;
  const node = payload as SankeyNode & { type?: string };

  const fill = getNodeColor(node.type);
  const centerY = y + height / 2;
  const labelX = x + width + 10;

  return (
    <Layer key={`node-${index}`}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        opacity={0.9}
        rx={4}
      />
      <text
        x={labelX}
        y={centerY}
        textAnchor="start"
        dominantBaseline="middle"
        fill="#e5e7eb"
        fontSize={12}
        fontWeight={500}
      >
        {node.name}
      </text>
      {typeof node.value === "number" && node.value > 0 && (
        <text
          x={labelX}
          y={centerY + 14}
          textAnchor="start"
          dominantBaseline="hanging"
          fill="#9ca3af"
          fontSize={11}
        >
          {node.value.toLocaleString("es-UY")}
        </text>
      )}
    </Layer>
  );
};

// Tooltip custom
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;

  const p = payload[0]?.payload as any;
  if (!p) return null;

  const sourceName = p.source?.name ?? p.sourceName ?? "";
  const targetName = p.target?.name ?? p.targetName ?? "";
  const value = p.value ?? 0;

  return (
    <div className="bg-slate-900/95 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 shadow-lg">
      <div className="font-semibold mb-1">
        {sourceName} → {targetName}
      </div>
      <div>Monto: {value.toLocaleString("es-UY")}</div>
    </div>
  );
};

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

export default function CashflowPageClient({
  fromYear: initialFromYear,
  fromMonth: initialFromMonth,
  toYear: initialToYear,
  toMonth: initialToMonth,
  initialNodes,
  initialLinks,
  initialDebugInfo,
}: CashflowPageClientProps) {
  const router = useRouter();

  // estado del selector
  const [fromYear, setFromYear] = useState(initialFromYear);
  const [fromMonth, setFromMonth] = useState(initialFromMonth);
  const [toYear, setToYear] = useState(initialToYear);
  const [toMonth, setToMonth] = useState(initialToMonth);

  // datos del sankey (se sincronizan con las props)
  const [nodes, setNodes] = useState<CashflowSankeyNode[]>(initialNodes);
  const [links, setLinks] = useState<CashflowSankeyLink[]>(initialLinks);
  const [debugInfo, setDebugInfo] = useState(initialDebugInfo ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFromYear(initialFromYear);
    setFromMonth(initialFromMonth);
    setToYear(initialToYear);
    setToMonth(initialToMonth);
    setNodes(initialNodes);
    setLinks(initialLinks);
    setDebugInfo(initialDebugInfo ?? "");
    setLoading(false);
  }, [
    initialFromYear,
    initialFromMonth,
    initialToYear,
    initialToMonth,
    initialNodes,
    initialLinks,
    initialDebugInfo,
  ]);

  // Transformar ids string → índices numéricos + acumular valor por nodo
  const data: SankeyData = useMemo(() => {
    const indexById = new Map<string, number>();
    const valueByIndex = new Map<number, number>();

    const sankeyNodes: SankeyNode[] = nodes.map((n, idx) => {
      indexById.set(n.id, idx);
      return { name: n.name, type: n.type, value: 0 };
    });

    const sankeyLinks: SankeyLink[] = links.map((l) => {
      const sourceIndex = indexById.get(l.source) ?? 0;
      const targetIndex = indexById.get(l.target) ?? 0;
      const value = l.value;

      valueByIndex.set(
        sourceIndex,
        (valueByIndex.get(sourceIndex) ?? 0) + value
      );
      valueByIndex.set(
        targetIndex,
        (valueByIndex.get(targetIndex) ?? 0) + value
      );

      return {
        source: sourceIndex,
        target: targetIndex,
        value,
      };
    });

    valueByIndex.forEach((v, idx) => {
      if (sankeyNodes[idx]) {
        sankeyNodes[idx].value = v;
      }
    });

    return { nodes: sankeyNodes, links: sankeyLinks };
  }, [nodes, links]);

  const hasData = data.links.length > 0;

  const fromLabel = new Date(
    initialFromYear,
    initialFromMonth - 1,
    1
  ).toLocaleDateString("es-UY", { month: "long", year: "numeric" });

  const toLabel = new Date(
    initialToYear,
    initialToMonth - 1,
    1
  ).toLocaleDateString("es-UY", { month: "long", year: "numeric" });

  // años ofrecidos en el combo
  const now = new Date();
  const currentYear = now.getFullYear();
  const yearOptions: number[] = [];
  for (let y = currentYear - 3; y <= currentYear + 1; y++) {
    yearOptions.push(y);
  }

  const handleApply = () => {
    const fromDate = new Date(fromYear, fromMonth - 1, 1);
    const toDate = new Date(toYear, toMonth - 1, 1);

    let fYear = fromYear;
    let fMonth = fromMonth;
    let tYear = toYear;
    let tMonth = toMonth;

    if (fromDate > toDate) {
      fYear = toYear;
      fMonth = toMonth;
      tYear = fromYear;
      tMonth = fromMonth;
    }

    const search = new URLSearchParams();
    search.set("from", `${fYear}-${pad2(fMonth)}`);
    search.set("to", `${tYear}-${pad2(tMonth)}`);

    setLoading(true);
    router.push(`/reportes/cashflow?${search.toString()}`);
  };

  return (
    <div className="p-6 space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Cashflow</h1>
          <p className="text-sm text-slate-400">
            Flujo de dinero desde{" "}
            <span className="font-medium">{fromLabel}</span>{" "}
            hasta <span className="font-medium">{toLabel}</span>.
          </p>
          {debugInfo && (
            <p className="text-xs text-slate-500 mt-1">
              Debug: {debugInfo}
            </p>
          )}
        </div>

        {/* Selector de rango */}
        <div className="flex items-center gap-3 text-sm bg-slate-900/70 border border-slate-700 rounded-xl px-3 py-2">
          <span className="text-slate-300">Desde</span>
          <select
            className="bg-transparent border border-slate-600 rounded-lg px-2 py-1 outline-none text-slate-100"
            value={fromMonth}
            onChange={(e) => setFromMonth(Number(e.target.value))}
          >
            {MONTHS.map((name, idx) => (
              <option key={idx} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
          <select
            className="bg-transparent border border-slate-600 rounded-lg px-2 py-1 outline-none text-slate-100"
            value={fromYear}
            onChange={(e) => setFromYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <span className="text-slate-300 mx-1">Hasta</span>

          <select
            className="bg-transparent border border-slate-600 rounded-lg px-2 py-1 outline-none text-slate-100"
            value={toMonth}
            onChange={(e) => setToMonth(Number(e.target.value))}
          >
            {MONTHS.map((name, idx) => (
              <option key={idx} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
          <select
            className="bg-transparent border border-slate-600 rounded-lg px-2 py-1 outline-none text-slate-100"
            value={toYear}
            onChange={(e) => setToYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            onClick={handleApply}
            className="ml-2 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium"
          >
            {loading ? "Cargando..." : "Aplicar"}
          </button>
        </div>
      </div>

      <div className="flex-1 rounded-2xl border border-slate-800 bg-[#050816] px-4 py-4">
        {loading && (
          <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
            Cargando cashflow…
          </div>
        )}

        {!loading && !hasData && (
          <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
            No hay datos de cashflow para este período.
          </div>
        )}

        {!loading && hasData && (
          <ResponsiveContainer width="100%" height={420}>
            <Sankey
              data={data}
              nodePadding={48}
              nodeWidth={18}
              margin={{ left: 80, right: 80, top: 40, bottom: 40 }}
              linkCurvature={0.6}
              node={<CustomNode />}
            >
              <Tooltip content={<CustomTooltip />} />
            </Sankey>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
