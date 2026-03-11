"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Scatter,
  ReferenceLine,
} from "recharts";

export type ChartPoint = {
  date: string; // YYYY-MM-DD
  price: number | null;

  // retornos
  returnPct_entry: number | null;
  returnPct_avg: number | null;

  // compras agregadas
  buyQty: number | null;
  buyAmount: number | null;
  hasBuy: boolean;
};

type Mode = "precio" | "rendimiento" | "ambos";
type Baseline = "entrada" | "promedio";

function fmtDate(isoDay: string) {
  const [y, m, d] = String(isoDay).slice(0, 10).split("-");
  if (!y || !m || !d) return String(isoDay);
  return `${d}/${m}/${y}`;
}

function fmtMoney(n: number | null, currency = "USD") {
  if (n == null || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat("es-UY", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function fmtPct(n: number | null) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function CustomTooltip({
  active,
  label,
  payload,
  mode,
  baseline,
  currency,
}: {
  active?: boolean;
  label?: any;
  payload?: any[];
  mode: Mode;
  baseline: Baseline;
  currency: string;
}) {
  if (!active || !payload?.length) return null;

  const p: ChartPoint | undefined = payload?.[0]?.payload;
  if (!p) return null;

  const ret = baseline === "entrada" ? p.returnPct_entry : p.returnPct_avg;

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.97)",
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: 10,
        padding: "10px 12px",
        color: "#111",
        maxWidth: 280,
        boxShadow: "0 10px 30px rgba(0,0,0,0.14)",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 6 }}>
        {label ? fmtDate(String(label)) : ""}
      </div>

      {(mode === "precio" || mode === "ambos") && (
        <div style={{ marginBottom: 4 }}>
          Precio: <b>{fmtMoney(p.price, currency)}</b>
        </div>
      )}

      {(mode === "rendimiento" || mode === "ambos") && (
        <div style={{ marginBottom: 4 }}>
          Rend.: <b>{fmtPct(ret)}</b>
        </div>
      )}

      {p.hasBuy && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Compra</div>
          <div>
            Cantidad: <b>{p.buyQty ?? "—"}</b>
          </div>
          <div>
            Monto: <b>{fmtMoney(p.buyAmount, currency)}</b>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Shape seguro para Recharts:
 * - NO retorna null jamás
 * - si no hay compra o no hay valor, devuelve un círculo "invisible" (r=0)
 */
function makeBuyDotShape(valueKey: keyof ChartPoint) {
  return function BuyDot(props: any): React.ReactElement {
    const p: ChartPoint | undefined = props?.payload;
    const cx = props?.cx;
    const cy = props?.cy;

    // Siempre devolvemos un elemento válido para TS
    const invisible = <circle cx={cx} cy={cy} r={0} />;

    if (!p?.hasBuy) return invisible;

    const v = p[valueKey] as unknown as number | null;
    if (v == null || Number.isNaN(v)) return invisible;

    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill="#16a34a"
        stroke="white"
        strokeWidth={1.5}
      />
    );
  };
}

export function AssetChart({
  data,
  mode,
  baseline,
  currency = "USD",
  avgCostLine, // opcional: para línea punteada de promedio
}: {
  data: ChartPoint[];
  mode: Mode;
  baseline: Baseline;
  currency?: string;
  avgCostLine?: number | null;
}) {
  const returnKey: keyof ChartPoint =
    baseline === "entrada" ? "returnPct_entry" : "returnPct_avg";

  const yAxisForMarkers = mode === "rendimiento" ? "right" : "left";
  const markerValueKey: keyof ChartPoint = mode === "rendimiento" ? returnKey : "price";

  const BuyDot = useMemo(() => makeBuyDotShape(markerValueKey), [markerValueKey]);

  const rightDomain = useMemo(() => {
    const vals = data
      .map((d) => d[returnKey] as unknown as number | null)
      .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));

    if (vals.length === 0) return ["auto", "auto"] as any;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return [Math.floor(min - 1), Math.ceil(max + 1)];
  }, [data, returnKey]);

  return (
    <div style={{ width: "100%", height: 340 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
          <XAxis dataKey="date" tickFormatter={fmtDate} minTickGap={24} />

          <YAxis yAxisId="left" tickFormatter={(v) => String(v)} />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={rightDomain}
            tickFormatter={(v) => `${v}%`}
          />

          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={
              <CustomTooltip
                mode={mode}
                baseline={baseline}
                currency={currency}
              />
            }
          />

          {/* Línea punteada de avgCost (solo si estás graficando precio) */}
          {typeof avgCostLine === "number" && avgCostLine > 0 && mode !== "rendimiento" && (
            <ReferenceLine
              yAxisId="left"
              y={avgCostLine}
              stroke="rgba(226,232,240,0.6)"
              strokeDasharray="6 6"
              ifOverflow="extendDomain"
            />
          )}

          {(mode === "precio" || mode === "ambos") && (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="price"
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={true}
              isAnimationActive={false}
            />
          )}

          {(mode === "rendimiento" || mode === "ambos") && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey={returnKey as string}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}

          {/* Scatter markers (NO secuestran tooltip porque usan el mismo data[]) */}
          <Scatter
            yAxisId={yAxisForMarkers}
            dataKey={markerValueKey as string}
            isAnimationActive={false}
            // Cast a `any` para compatibilidad total con definiciones de tipo de Recharts
            // (hay versiones donde ScatterCustomizedShape es excesivamente estricto).
            shape={BuyDot as any}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
