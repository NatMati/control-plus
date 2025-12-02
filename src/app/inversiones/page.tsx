"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AddAssetModal from "@/components/AddAssetModal";
import AssetTabs from "@/components/AssetTabs";
import { useSettings } from "@/context/SettingsContext";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useQuote } from "@/lib/useQuote";
import { ProFeatureGuard } from "@/components/ProFeatureGuard";

// ========= TIPOS =========

type Asset = {
  symbol: string;
  type: string;
  quantity: number;
  buyPrice: number;
  currentPrice: number; // fallback, se sobreescribe con useQuote
};

type AssetRowProps = { row: Asset };

type PortfolioMode = "VALUE" | "PNL" | "BOTH";
type PortfolioPeriod = "1D" | "1S" | "1M" | "3M" | "6M" | "1Y" | "ALL";

// ========= MOCKS PARA GRÁFICOS (visual demo) =========

const MOCK_PORTFOLIO_HISTORY = [
  { label: "Jul", value: 900 },
  { label: "Ago", value: 980 },
  { label: "Sep", value: 1050 },
  { label: "Oct", value: 1130 },
  { label: "Nov", value: 1200 },
  { label: "Dic", value: 1245.32 },
];

const MOCK_ALLOCATION = [
  { name: "Acciones", value: 40 },
  { name: "ETFs", value: 30 },
  { name: "Cripto", value: 15 },
  { name: "Bonos", value: 10 },
  { name: "Metales", value: 5 },
];

const ALLOCATION_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#f97316",
  "#e5e7eb",
];

// Helper P&L
function calcPnl(row: Asset) {
  const invested = row.buyPrice * row.quantity;
  const current = row.currentPrice * row.quantity;
  const pnl = current - invested;
  const pct = invested > 0 ? (pnl / invested) * 100 : 0;
  return { invested, current, pnl, pct };
}

// ========= FILA DE LA TABLA =========

function AssetRow({ row }: AssetRowProps) {
  const { format } = useSettings();
  const { price, loading } = useQuote(row.symbol);

  const effectivePrice = price ?? row.currentPrice;

  const invested = row.buyPrice * row.quantity;
  const current = effectivePrice * row.quantity;
  const pnl = current - invested;
  const pct = invested > 0 ? (pnl / invested) * 100 : 0;

  return (
    <tr className="border-b border-slate-900/60 last:border-0">
      <td className="py-1.5 pr-2">
        <Link
          href={`/inversiones/${encodeURIComponent(row.symbol)}`}
          className="text-sky-400 hover:underline"
        >
          {row.symbol}
        </Link>
      </td>
      <td className="py-1.5 pr-2 text-slate-400">{row.type}</td>
      <td className="py-1.5 pr-2 text-right">{row.quantity}</td>
      <td className="py-1.5 pr-2 text-right">{format(row.buyPrice)}</td>

      {/* Precio actual en vivo */}
      <td className="py-1.5 pr-2 text-right">
        {loading ? (
          <span className="text-slate-500">...</span>
        ) : (
          format(effectivePrice)
        )}
      </td>

      {/* Invertido */}
      <td className="py-1.5 pr-2 text-right">{format(invested)}</td>

      {/* Valor actual */}
      <td className="py-1.5 pr-2 text-right">{format(current)}</td>

      {/* Ganancia / Pérdida */}
      <td
        className={
          "py-1.5 pr-2 text-right " +
          (pnl >= 0 ? "text-emerald-400" : "text-rose-400")
        }
      >
        {format(pnl)}
      </td>

      {/* % Rent. */}
      <td
        className={
          "py-1.5 pl-2 text-right " +
          (pct >= 0 ? "text-emerald-400" : "text-rose-400")
        }
      >
        {pct.toFixed(1)}%
      </td>
    </tr>
  );
}

// ========= PÁGINA PRINCIPAL =========

export default function InvestmentsPage() {
  const [openAdd, setOpenAdd] = useState(false);
  const { format, t } = useSettings();

  // Estado real de posiciones: arranca VACÍO (ya no hay MOCK_ASSETS)
  const [assets, setAssets] = useState<Asset[]>([]);

  // Gráfico portafolio
  const [portfolioMode, setPortfolioMode] =
    useState<PortfolioMode>("VALUE");
  const [portfolioAsPct, setPortfolioAsPct] = useState(false);
  const [portfolioPeriod, setPortfolioPeriod] =
    useState<PortfolioPeriod>("ALL");

  // Crear activo desde el modal
  const onCreate = async (fd: FormData) => {
    const raw = Object.fromEntries(
      Array.from((fd as any).entries())
    ) as Record<string, FormDataEntryValue>;

    const getNum = (keys: string[], def = 0) => {
      for (const k of keys) {
        const v = raw[k];
        if (typeof v === "string" && v.trim() !== "") {
          const n = Number(v.replace(",", "."));
          if (!Number.isNaN(n)) return n;
        }
      }
      return def;
    };

    const symbol =
      (raw.symbol as string | undefined)?.toUpperCase().trim() ?? "";
    if (!symbol) return;

    const type = (raw.type as string | undefined) ?? "Acción";
    const quantity = getNum(["quantity", "qty"]);
    const buyPrice = getNum(["buyPrice", "buy_price", "price"]);

    // Intentar usar precio de API como “currentPrice” inicial
    let currentPrice = buyPrice;
    try {
      const res = await fetch(
        `/api/quotes/${encodeURIComponent(symbol)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (typeof data.price === "number") {
          currentPrice = data.price;
        }
      }
    } catch {
      // si falla, nos quedamos con buyPrice
    }

    const newAsset: Asset = {
      symbol,
      type,
      quantity,
      buyPrice,
      currentPrice,
    };

    // Si ya existe el símbolo, agregamos cantidad y recalculamos precio medio
    setAssets((prev) => {
      const idx = prev.findIndex(
        (a) => a.symbol === symbol && a.type === type
      );
      if (idx === -1) {
        return [...prev, newAsset];
      }

      const updated = [...prev];
      const old = updated[idx];

      const totalQty = old.quantity + newAsset.quantity;
      const totalInvested =
        old.buyPrice * old.quantity +
        newAsset.buyPrice * newAsset.quantity;
      const avgBuyPrice =
        totalQty > 0 ? totalInvested / totalQty : old.buyPrice;

      updated[idx] = {
        ...old,
        quantity: totalQty,
        buyPrice: avgBuyPrice,
      };

      return updated;
    });

    setOpenAdd(false);
  };

  // ===== Derivados =====

  const portfolioData = useMemo(() => {
    if (!MOCK_PORTFOLIO_HISTORY.length) return [];

    let history = MOCK_PORTFOLIO_HISTORY;

    switch (portfolioPeriod) {
      case "1D":
      case "1S":
      case "1M":
      case "3M":
        history = history.slice(-3);
        break;
      case "6M":
        history = history.slice(-6);
        break;
      case "1Y":
      case "ALL":
      default:
        history = history;
        break;
    }

    const base = history[0]?.value || 1;

    return history.map((d) => {
      const benefit = d.value - base;
      const valuePct = ((d.value - base) / base) * 100;
      const benefitPct = valuePct;

      return {
        ...d,
        benefit,
        valuePct,
        benefitPct,
      };
    });
  }, [portfolioPeriod]);

  const portfolioStats = useMemo(() => {
    const assetsCount = assets.length;
    let totalInvested = 0;
    let totalCurrent = 0;

    for (const row of assets) {
      const { invested, current } = calcPnl(row);
      totalInvested += invested;
      totalCurrent += current;
    }

    const totalPnl = totalCurrent - totalInvested;
    const totalReturnPct =
      totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    return {
      assetsCount,
      totalInvested,
      totalCurrent,
      totalPnl,
      totalReturnPct,
    };
  }, [assets]);

  const currentModeLabel =
    portfolioMode === "VALUE"
      ? "Valor del portafolio"
      : portfolioMode === "PNL"
      ? "Ganancia / pérdida"
      : "Valor + ganancia / pérdida";

  const hasPositions = portfolioStats.assetsCount > 0;

  // ========= RENDER =========

  return (
    <ProFeatureGuard
      title="Inversiones"
      description="Gestioná tus acciones, ETFs, cripto, bonos y metales desde un solo lugar."
    >
      <div className="space-y-7 xl:space-y-8">
        {/* Header + Tabs */}
        <div className="flex flex-col gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">Inversiones</h1>
            <p className="text-slate-400 text-sm">
              Gestioná tus activos y mirá la evolución de tu portafolio en
              tiempo real.
            </p>
          </div>

          <AssetTabs />
        </div>

        {/* KPI Cards */}
        <div className="grid gap-5 md:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-xs font-medium text-slate-400">
              Valor actual del portafolio
            </p>
            <p className="mt-2 text-xl font-semibold">
              {format(portfolioStats.totalCurrent)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Invertido: {format(portfolioStats.totalInvested)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-xs font-medium text-slate-400">
              Ganancia / pérdida total
            </p>
            <p
              className={
                "mt-2 text-xl font-semibold " +
                (portfolioStats.totalPnl >= 0
                  ? "text-emerald-400"
                  : "text-rose-400")
              }
            >
              {format(portfolioStats.totalPnl)}
            </p>
            <p
              className={
                "mt-1 text-xs " +
                (portfolioStats.totalReturnPct >= 0
                  ? "text-emerald-400"
                  : "text-rose-400")
              }
            >
              {portfolioStats.totalReturnPct.toFixed(2)}% rentabilidad
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-xs font-medium text-slate-400">
              Ganancias vs pérdidas
            </p>
            <p className="mt-2 text-xs">
              <span className="text-emerald-400 font-medium">
                + {format(Math.max(portfolioStats.totalPnl, 0))}
              </span>{" "}
              {" / "}
              <span className="text-rose-400 font-medium">
                - {format(Math.max(-portfolioStats.totalPnl, 0))}
              </span>
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-xs font-medium text-slate-400">
              Cantidad de activos
            </p>
            <p className="mt-2 text-xl font-semibold">
              {portfolioStats.assetsCount}
            </p>
          </div>
        </div>

        {/* Gráfico portafolio + distribución */}
        <div className="grid gap-5 lg:grid-cols-5">
          {/* Evolución del portafolio (por ahora demo de histórico) */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 lg:col-span-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-400">
                  Evolución del portafolio
                </p>
                <p className="text-xs text-slate-500">{currentModeLabel}</p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <div className="inline-flex rounded-md border border-slate-700 bg-slate-950/60">
                  <button
                    className={
                      "px-2 py-1 rounded-l-md " +
                      (portfolioMode === "VALUE"
                        ? "bg-slate-800 text-white"
                        : "text-slate-400")
                    }
                    onClick={() => setPortfolioMode("VALUE")}
                  >
                    Valor
                  </button>
                  <button
                    className={
                      "px-2 py-1 border-x border-slate-700 " +
                      (portfolioMode === "PNL"
                        ? "bg-slate-800 text-white"
                        : "text-slate-400")
                    }
                    onClick={() => setPortfolioMode("PNL")}
                  >
                    Rentabilidad
                  </button>
                  <button
                    className={
                      "px-2 py-1 rounded-r-md " +
                      (portfolioMode === "BOTH"
                        ? "bg-slate-800 text-white"
                        : "text-slate-400")
                    }
                    onClick={() => setPortfolioMode("BOTH")}
                  >
                    Ambos
                  </button>
                </div>

                <button
                  className={
                    "px-2 py-1 rounded-md border text-xs " +
                    (portfolioAsPct
                      ? "border-slate-500 bg-slate-800 text-white"
                      : "border-slate-700 text-slate-400")
                  }
                  onClick={() => setPortfolioAsPct((v) => !v)}
                >
                  {portfolioAsPct ? "% sobre el inicio" : "Valor absoluto"}
                </button>
              </div>
            </div>

            {hasPositions && portfolioData.length > 0 ? (
              <>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={portfolioData}
                      margin={{ top: 10, right: 24, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1f2937"
                      />
                      <XAxis
                        dataKey="label"
                        stroke="#9ca3af"
                        tickMargin={6}
                      />
                      <YAxis
                        width={80}
                        stroke="#9ca3af"
                        tickFormatter={(v) =>
                          portfolioAsPct
                            ? `${(v as number).toFixed(0)}%`
                            : format(v as number)
                        }
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#020617",
                          borderColor: "#1f2937",
                        }}
                        formatter={(value: any, name: any) => {
                          if (portfolioMode === "VALUE") {
                            return [format(value as number), "Valor"];
                          }
                          if (portfolioMode === "PNL") {
                            return [
                              portfolioAsPct
                                ? `${(value as number).toFixed(2)}%`
                                : format(value as number),
                              "Ganancia / pérdida",
                            ];
                          }
                          return [value, name];
                        }}
                      />
                      {(portfolioMode === "VALUE" ||
                        portfolioMode === "BOTH") && (
                        <Line
                          type="monotone"
                          dataKey={portfolioAsPct ? "valuePct" : "value"}
                          stroke="#3b82f6"
                          dot={false}
                          name={
                            portfolioAsPct
                              ? "Valor vs inicio (%)"
                              : "Valor del portafolio"
                          }
                        />
                      )}
                      {(portfolioMode === "PNL" ||
                        portfolioMode === "BOTH") && (
                        <Line
                          type="monotone"
                          dataKey={portfolioAsPct ? "benefitPct" : "benefit"}
                          stroke="#22c55e"
                          dot={false}
                          name={
                            portfolioAsPct
                              ? "Ganancia / pérdida (%)"
                              : "Ganancia / pérdida"
                          }
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-3 flex justify-end">
                  <div className="inline-flex rounded-md border border-slate-700 bg-slate-950/60 text-xs">
                    {(
                      [
                        "1D",
                        "1S",
                        "1M",
                        "3M",
                        "6M",
                        "1Y",
                        "ALL",
                      ] as PortfolioPeriod[]
                    ).map((p) => (
                      <button
                        key={p}
                        className={
                          "px-2 py-1 " +
                          (portfolioPeriod === p
                            ? "bg-slate-800 text-white"
                            : "text-slate-400")
                        }
                        onClick={() => setPortfolioPeriod(p)}
                      >
                        {p === "ALL" ? "Todo" : p}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-40 items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg mt-2">
                Todavía no tenés inversiones cargadas. Usá el botón
                <span className="mx-1 font-semibold">“Agregar”</span>
                en la tabla de posiciones para empezar.
              </div>
            )}
          </div>

          {/* Distribución por tipo de activo (demo visual por ahora) */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 lg:col-span-2">
            <p className="text-xs font-medium text-slate-400 mb-2">
              Distribución por tipo de activo
            </p>

            {hasPositions ? (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={MOCK_ALLOCATION}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {MOCK_ALLOCATION.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={
                            ALLOCATION_COLORS[
                              index % ALLOCATION_COLORS.length
                            ]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#020617",
                        borderColor: "#1f2937",
                      }}
                      formatter={(value: any, name: any) => [
                        `${value}%`,
                        name as string,
                      ]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={24}
                      wrapperStyle={{ fontSize: 11, color: "#9ca3af" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg mt-2">
                Cuando cargues tus primeras posiciones vas a ver acá cómo se
                reparte tu portafolio entre acciones, ETFs, cripto y más.
              </div>
            )}
          </div>
        </div>

        {/* Tabla + card de Plazo fijo mini */}
        <div className="grid gap-5 lg:grid-cols-5">
          {/* Tabla de posiciones */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 lg:col-span-3 flex flex-col">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-slate-400">
                Detalle de posiciones
              </p>
              <button
                onClick={() => setOpenAdd(true)}
                className="bg-[#3b82f6] hover:bg-blue-500 transition text-white px-3 py-1.5 rounded-lg text-xs font-medium"
              >
                {t("btn.add")}
              </button>
            </div>

            {hasPositions ? (
              <div className="overflow-x-auto max-h-[260px]">
                <table className="min-w-full text-xs">
                  <thead className="border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="py-2 pr-2 text-left">Símbolo</th>
                      <th className="py-2 pr-2 text-left">Tipo</th>
                      <th className="py-2 pr-2 text-right">Cantidad</th>
                      <th className="py-2 pr-2 text-right">
                        Precio compra
                      </th>
                      <th className="py-2 pr-2 text-right">
                        Precio actual
                      </th>
                      <th className="py-2 pr-2 text-right">Invertido</th>
                      <th className="py-2 pr-2 text-right">
                        Valor actual
                      </th>
                      <th className="py-2 pr-2 text-right">
                        Ganancia / pérdida
                      </th>
                      <th className="py-2 pr-2 text-right">% Rent.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((row) => (
                      <AssetRow key={row.symbol} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg mt-2">
                No hay posiciones aún. Usá el botón{" "}
                <span className="mx-1 font-semibold">“Agregar”</span> para
                cargar tu primera inversión.
              </div>
            )}
          </div>

          {/* Card mini de Plazo fijo */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 lg:col-span-2 flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">
                Plazo fijo
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Simulá distintos plazos fijos y gestioná tus depósitos a
                término en un apartado dedicado.
              </p>
            </div>
            <div className="mt-4 flex justify-end">
              <Link
                href="/plazo-fijo"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-sky-400 hover:bg-slate-900"
              >
                Ver detalle
              </Link>
            </div>
          </div>
        </div>

        {/* Modal Agregar activo */}
        <AddAssetModal
          open={openAdd}
          onClose={() => setOpenAdd(false)}
          onCreate={onCreate}
        />
      </div>
    </ProFeatureGuard>
  );
}
