"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useSettings } from "@/context/SettingsContext";
import { useQuote } from "@/lib/useQuote";

// 👇 Por ahora usamos mocks / ejemplo.
// Más adelante esto va a venir de Supabase (tabla de posiciones de inversión).
type Position = {
  symbol: string;
  type: string;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
};

const MOCK_POSITIONS: Position[] = [
  { symbol: "VOO", type: "ETF", quantity: 3, buyPrice: 390, currentPrice: 415 },
  { symbol: "QQQ", type: "ETF", quantity: 2, buyPrice: 365, currentPrice: 380 },
  {
    symbol: "BTC-USD",
    type: "Cripto",
    quantity: 0.03,
    buyPrice: 60000,
    currentPrice: 62000,
  },
  {
    symbol: "ETH-USD",
    type: "Cripto",
    quantity: 0.4,
    buyPrice: 3200,
    currentPrice: 3000,
  },
];

// Historial de ejemplo para el gráfico.
// Después lo vamos a reemplazar por precios históricos reales.
function buildMockHistory(currentPrice: number) {
  const base = currentPrice || 100;
  return [
    { label: "T-5", value: base * 0.9 },
    { label: "T-4", value: base * 0.95 },
    { label: "T-3", value: base * 0.85 },
    { label: "T-2", value: base * 1.0 },
    { label: "T-1", value: base * 1.05 },
    { label: "Hoy", value: base },
  ];
}

export default function AssetDetailPage() {
  const params = useParams<{ symbol: string }>();
  const router = useRouter();
  const { format } = useSettings();

  const raw = Array.isArray(params.symbol)
    ? params.symbol[0]
    : params.symbol;

  const symbol = decodeURIComponent(raw || "").toUpperCase();

  const position = useMemo(
    () =>
      MOCK_POSITIONS.find(
        (p) => p.symbol.toUpperCase() === symbol.toUpperCase()
      ),
    [symbol]
  );

  const { price, loading } = useQuote(symbol);

  const stats = useMemo(() => {
    if (!position) return null;

    const mktPrice = price ?? position.currentPrice;
    const invested = position.buyPrice * position.quantity;
    const current = mktPrice * position.quantity;
    const pnl = current - invested;
    const pct = invested > 0 ? (pnl / invested) * 100 : 0;

    return { invested, current, pnl, pct, mktPrice };
  }, [position, price]);

  const historyData = useMemo(() => {
    const basePrice =
      stats?.mktPrice ?? position?.currentPrice ?? price ?? 100;
    return buildMockHistory(basePrice);
  }, [stats, position, price]);

  const hasPosition = !!position && !!stats;

  return (
    <div className="space-y-6 xl:space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <button
              onClick={() => router.back()}
              className="text-sky-400 hover:underline"
            >
              ← Volver
            </button>
            <span>·</span>
            <Link
              href="/inversiones"
              className="text-slate-400 hover:text-slate-200"
            >
              Inversiones
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {symbol}
          </h1>
          <p className="text-xs text-slate-400">
            Vista de detalle del activo. Podés ver su rendimiento aunque
            todavía no tengas posición en él.
          </p>
        </div>

        <div className="text-right text-sm">
          <p className="text-slate-400 text-xs mb-1">
            Precio actual (API)
          </p>
          <p className="text-lg font-semibold">
            {loading
              ? "..."
              : format(stats?.mktPrice ?? price ?? position?.currentPrice ?? 0)}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        {hasPosition ? (
          <>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-xs text-slate-400 mb-1">Cantidad</p>
              <p className="text-xl font-semibold">
                {position!.quantity}
              </p>
              <p className="text-xs text-slate-500">{position!.type}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-xs text-slate-400 mb-1">
                Invertido en este activo
              </p>
              <p className="text-xl font-semibold">
                {format(stats!.invested)}
              </p>
              <p className="text-xs text-slate-500">
                Precio compra: {format(position!.buyPrice)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-xs text-slate-400 mb-1">
                Valor actual de la posición
              </p>
              <p className="text-xl font-semibold">
                {format(stats!.current)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-xs text-slate-400 mb-1">
                Ganancia / pérdida total
              </p>
              <p
                className={
                  "text-xl font-semibold " +
                  (stats!.pnl >= 0 ? "text-emerald-400" : "text-rose-400")
                }
              >
                {format(stats!.pnl)}
              </p>
              <p
                className={
                  "text-xs " +
                  (stats!.pct >= 0 ? "text-emerald-400" : "text-rose-400")
                }
              >
                {stats!.pct.toFixed(2)}% rentabilidad
              </p>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-4 md:col-span-4">
            <p className="text-xs text-slate-400 mb-1">
              Todavía no tenés posiciones en {symbol}.
            </p>
            <p className="text-xs text-slate-500">
              Igual podés usar esta vista para analizar el activo, mirar su
              precio actual y, en el futuro, ver gráficos históricos y ratios
              fundamentales.
            </p>
          </div>
        )}
      </div>

      {/* Gráfico simple de precio */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-medium text-slate-400">
              Evolución del precio (demo)
            </p>
            <p className="text-xs text-slate-500">
              Más adelante lo conectamos a un historial real.
            </p>
          </div>
        </div>

        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={historyData}
              margin={{ top: 10, right: 24, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="label" stroke="#9ca3af" tickMargin={6} />
              <YAxis
                width={80}
                stroke="#9ca3af"
                tickFormatter={(v) => format(v as number)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#020617",
                  borderColor: "#1f2937",
                }}
                formatter={(value: any) => [format(value as number), "Precio"]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                dot={false}
                name="Precio (mock)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
