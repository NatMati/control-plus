"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type AssetType = "Acción" | "ETFs" | "Cripto" | "Metales" | "Bonos";

type SnapshotPosition = {
  symbol: string;
  type?: string;
  quantity: number;
  buyPrice: number;
  currentPrice?: number;
};

type UiPosition = {
  symbol: string;
  type: AssetType;
  quantity: number;
  buyPrice: number;
  currentPrice: number | null;
  invested: number;
  valueNow: number;
  pnl: number;
  pnlPct: number;
};

type HistoryPoint = {
  date: string;
  value: number;
  contributed: number;
  performance: number;
};

type QuoteResponse = {
  symbol?: string;
  price: number | null;
  cached?: boolean;
  updated_at?: string;
  error?: string;
};

function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatUsd(n: number) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}US$ ${abs.toLocaleString("es-UY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPct(n: number) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}${abs.toLocaleString("es-UY", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function monthLabel(dateIso: string) {
  const d = new Date(dateIso + "T00:00:00Z");
  const fmt = new Intl.DateTimeFormat("es-UY", { month: "short" });
  const m = fmt.format(d);
  return m.charAt(0).toUpperCase() + m.slice(1);
}

const CRYPTO_SET = new Set(["BTC", "ETH", "ADA", "XRP", "SOL"]);
const METALS_SET = new Set(["SLV", "IAU", "GLD"]);
const ETF_SET = new Set([
  "VOO",
  "QQQ",
  "QQQM",
  "RSP",
  "VTI",
  "SPY",
  "IVV",
  "VT",
  "VEA",
  "VWO",
  "AVUV",
]);

function inferType(symbolRaw: string): AssetType {
  const s = String(symbolRaw || "").trim().toUpperCase();
  if (!s) return "Acción";
  if (CRYPTO_SET.has(s) || s.endsWith("-USD")) return "Cripto";
  if (METALS_SET.has(s)) return "Metales";
  if (ETF_SET.has(s)) return "ETFs";
  return "Acción";
}

function classPnl(n: number) {
  return n >= 0 ? "text-emerald-400" : "text-rose-400";
}

const PIE_COLORS = [
  "#60A5FA",
  "#A78BFA",
  "#34D399",
  "#F59E0B",
  "#F87171",
  "#22D3EE",
  "#E5E7EB",
];

type ChartMode = "VALOR" | "RENDIMIENTO" | "AMBOS";
type PieMode = "TIPO" | "ACTIVO";
type TimeRange = "1M" | "3M" | "6M" | "1Y" | "TODO";

/** ✅ Ajustá paths si tus routes son distintos */
const CLEAR_ENDPOINT = "/api/investments/clear";
/** ✅ Import CSV */
const IMPORT_ENDPOINT = "/api/investments/import-csv";
/** ✅ Route por símbolo (DELETE) */
const DELETE_SYMBOL_ENDPOINT = (symbol: string) =>
  `/api/investments/positions/${encodeURIComponent(symbol)}`;

export default function InversionesPage() {
  const [activeTab, setActiveTab] = useState<AssetType | "Todas">("Todas");
  const [chartMode, setChartMode] = useState<ChartMode>("AMBOS");
  const [pieMode, setPieMode] = useState<PieMode>("TIPO");
  const [range, setRange] = useState<TimeRange>("TODO");

  const [snapshotRaw, setSnapshotRaw] = useState<SnapshotPosition[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [quotes, setQuotes] = useState<Record<string, number | null>>({});

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Limpiar inversiones (global)
  const [clearing, setClearing] = useState(false);
  const [clearErr, setClearErr] = useState<string | null>(null);

  // ✅ Import CSV
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [importOk, setImportOk] = useState<string | null>(null);

  // ✅ Eliminación por activo (fila)
  const [deletingSymbol, setDeletingSymbol] = useState<string | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const refreshTimer = useRef<number | null>(null);

  async function fetchSnapshot(): Promise<SnapshotPosition[]> {
    const res = await fetch("/api/investments/snapshot", { cache: "no-store" });
    if (!res.ok) throw new Error(`Snapshot error HTTP ${res.status}`);
    const json = await res.json();
    return (json?.positions ?? []) as SnapshotPosition[];
  }

  async function fetchHistory(): Promise<HistoryPoint[]> {
    const res = await fetch("/api/investments/history", { cache: "no-store" });
    if (!res.ok) throw new Error(`History error HTTP ${res.status}`);
    const json = await res.json();
    return (json?.points ?? []) as HistoryPoint[];
  }

  async function fetchQuote(symbol: string): Promise<number | null> {
    const res = await fetch(`/api/quotes/${encodeURIComponent(symbol)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as QuoteResponse;
    return typeof data.price === "number" ? data.price : null;
  }

  async function refreshQuotes(symbols: string[]) {
    if (symbols.length === 0) return;
    const uniq = Array.from(
      new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))
    );

    const results = await Promise.all(
      uniq.map(async (s) => {
        try {
          const p = await fetchQuote(s);
          return [s, p] as const;
        } catch {
          return [s, null] as const;
        }
      })
    );

    setQuotes((prev) => {
      const next = { ...prev };
      for (const [s, p] of results) next[s] = p;
      return next;
    });
  }

  async function reloadAll() {
    const [snap, hist] = await Promise.all([fetchSnapshot(), fetchHistory()]);
    setSnapshotRaw(snap);
    setHistory(hist);

    const symbols = snap.map((p) => String(p.symbol || "").toUpperCase());
    await refreshQuotes(symbols);

    if (refreshTimer.current) window.clearInterval(refreshTimer.current);
    refreshTimer.current = window.setInterval(() => {
      refreshQuotes(symbols);
    }, 60_000);
  }

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        setLoading(true);
        setErr(null);

        await reloadAll();

        if (!cancelled) setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message ?? "Error cargando inversiones");
          setLoading(false);
        }
      }
    };

    boot();

    return () => {
      cancelled = true;
      if (refreshTimer.current) window.clearInterval(refreshTimer.current);
    };
  }, []);

  async function handleClearInvestments() {
    const ok = window.confirm(
      "Esto va a eliminar TODAS tus operaciones de inversión importadas.\n\n¿Querés continuar?"
    );
    if (!ok) return;

    try {
      setClearing(true);
      setClearErr(null);

      const res = await fetch(CLEAR_ENDPOINT, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body?.error ?? `Error limpiando inversiones (${res.status})`);
      }

      setSnapshotRaw([]);
      setHistory([]);
      setQuotes({});
      await reloadAll();
      setActiveTab("Todas");
    } catch (e: any) {
      setClearErr(e?.message ?? "Error limpiando inversiones");
    } finally {
      setClearing(false);
    }
  }

  /** ✅ Import CSV (multipart/form-data -> route.ts) */
  async function handleImportCsvFile(file: File) {
    try {
      setImporting(true);
      setImportErr(null);
      setImportOk(null);

      // DEBUG mínimo (lo ves en DevTools)
      console.log("[CSV] selected:", {
        name: file.name,
        size: file.size,
        type: file.type,
      });

      const form = new FormData();
      form.append("file", file);

      const res = await fetch(IMPORT_ENDPOINT, {
        method: "POST",
        body: form,
        cache: "no-store",
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body?.error ?? `Error importando CSV (${res.status})`);
      }

      const inserted = Number(body?.inserted ?? 0);
      const received = Number(body?.received ?? 0);
      const valid = Number(body?.valid ?? inserted);

      setImportOk(
        `Importación OK: ${inserted} operaciones insertadas (válidas: ${valid}/${received}).`
      );

      // recargar UI
      await reloadAll();
      setActiveTab("Todas");
    } catch (e: any) {
      setImportErr(e?.message ?? "Error importando CSV");
    } finally {
      setImporting(false);

      // permitir re-seleccionar el mismo archivo
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /** ✅ NUEVO: borrar por símbolo */
  async function handleDeleteSymbol(symbol: string) {
    const ok = window.confirm(
      `Vas a eliminar todas las operaciones de "${symbol}" del registro.\n\n¿Querés continuar?`
    );
    if (!ok) return;

    try {
      setDeletingSymbol(symbol);
      setDeleteErr(null);

      const res = await fetch(DELETE_SYMBOL_ENDPOINT(symbol), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body?.error ?? `Error eliminando ${symbol} (${res.status})`);
      }

      await reloadAll();
    } catch (e: any) {
      setDeleteErr(e?.message ?? "Error eliminando activo");
    } finally {
      setDeletingSymbol(null);
    }
  }

  const positions: UiPosition[] = useMemo(() => {
    const out: UiPosition[] = [];

    for (const p of snapshotRaw) {
      const symbol = String(p.symbol || "").trim().toUpperCase();
      if (!symbol) continue;

      const type = inferType(symbol);
      const qty = toNum(p.quantity);
      const buyPrice = toNum(p.buyPrice);

      const live = quotes[symbol];
      const currentPrice = typeof live === "number" ? live : null;

      const invested = qty * buyPrice;
      const valueNow = qty * (currentPrice ?? 0);
      const pnl = valueNow - invested;
      const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

      out.push({
        symbol,
        type,
        quantity: qty,
        buyPrice,
        currentPrice,
        invested,
        valueNow,
        pnl,
        pnlPct,
      });
    }

    return out;
  }, [snapshotRaw, quotes]);

  const filteredPositions = useMemo(() => {
    if (activeTab === "Todas") return positions;
    return positions.filter((p) => p.type === activeTab);
  }, [positions, activeTab]);

  const kpis = useMemo(() => {
    const list = positions;
    const totalValue = list.reduce((a, p) => a + p.valueNow, 0);
    const totalInvested = list.reduce((a, p) => a + p.invested, 0);
    const totalPnl = totalValue - totalInvested;
    const totalPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    const gains = list.filter((p) => p.pnl > 0).reduce((a, p) => a + p.pnl, 0);
    const losses = list.filter((p) => p.pnl < 0).reduce((a, p) => a + Math.abs(p.pnl), 0);

    return {
      totalValue,
      totalInvested,
      totalPnl,
      totalPct,
      gains,
      losses,
      count: list.length,
    };
  }, [positions]);

  const filteredHistory = useMemo(() => {
    const pts = [...(history ?? [])];
    if (pts.length === 0) return pts;

    pts.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const lastN = (n: number) => (pts.length <= n ? pts : pts.slice(pts.length - n));

    switch (range) {
      case "1M":
        return lastN(1);
      case "3M":
        return lastN(3);
      case "6M":
        return lastN(6);
      case "1Y":
        return lastN(12);
      case "TODO":
      default:
        return pts;
    }
  }, [history, range]);

  const chartData = useMemo(() => {
    return (filteredHistory ?? []).map((p) => ({
      ...p,
      month: monthLabel(p.date),
    }));
  }, [filteredHistory]);

  const pieData = useMemo(() => {
    const list = positions
      .filter((p) => p.valueNow > 0)
      .map((p) => ({
        key: p.symbol,
        label: p.symbol,
        type: p.type,
        value: p.valueNow,
      }));

    const total = list.reduce((a, x) => a + x.value, 0);

    if (pieMode === "TIPO") {
      const byType = new Map<AssetType, number>();
      for (const x of list) byType.set(x.type, (byType.get(x.type) ?? 0) + x.value);

      const arr = Array.from(byType.entries())
        .map(([t, v]) => ({
          key: t,
          label: t,
          value: v,
          pct: total > 0 ? (v / total) * 100 : 0,
        }))
        .sort((a, b) => b.value - a.value);

      return { total, items: arr };
    }

    const sorted = [...list].sort((a, b) => b.value - a.value);
    const TOP_N = 12;
    const top = sorted.slice(0, TOP_N);

    const topSum = top.reduce((a, x) => a + x.value, 0);
    const rest = total - topSum;

    const items = top.map((x) => ({
      key: x.key,
      label: x.label,
      value: x.value,
      pct: total > 0 ? (x.value / total) * 100 : 0,
    }));

    const OTHER_MIN_PCT = 1.5;
    const otherPct = total > 0 ? (rest / total) * 100 : 0;

    if (rest > 0 && otherPct >= OTHER_MIN_PCT) {
      items.push({ key: "Otros", label: "Otros", value: rest, pct: otherPct });
    }

    return { total, items };
  }, [positions, pieMode]);

  return (
    <div className="px-6 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-100">Inversiones</h1>
        <p className="text-slate-400">
          Gestioná tus activos y mirá la evolución de tu portfolio en tiempo real.
        </p>
      </div>

      {/* Import CSV */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-100">
              Importar operaciones de inversión desde CSV
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Exportá tu hoja de Inversiones en formato .csv. Este importador agrega operaciones
              a la tabla de inversiones.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClearInvestments}
              disabled={clearing}
              className={
                "rounded-lg border px-3 py-2 text-sm font-medium " +
                (clearing
                  ? "border-white/10 bg-white/5 text-slate-400 cursor-not-allowed"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15")
              }
              title="Eliminar todas las operaciones y volver a importar el CSV"
            >
              {clearing ? "Limpiando..." : "Limpiar inversiones"}
            </button>

            <label
              className={
                "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm " +
                (importing
                  ? "border-white/10 bg-white/5 text-slate-400 cursor-not-allowed"
                  : "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10")
              }
              title="Seleccioná tu CSV exportado desde tu hoja"
            >
              {importing ? "Importando..." : "Elegir archivo CSV"}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={importing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  console.log("[CSV] onChange fired", { hasFile: !!f });
                  if (!f) return;
                  void handleImportCsvFile(f);
                }}
              />
            </label>
          </div>
        </div>

        {clearErr && (
          <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            {clearErr}
          </div>
        )}

        {importErr && (
          <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            {importErr}
          </div>
        )}

        {importOk && (
          <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            {importOk}
          </div>
        )}

        {deleteErr && (
          <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            {deleteErr}
          </div>
        )}
      </div>

      {err && (
        <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">
          {err}
        </div>
      )}

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-slate-400">Valor actual del portfolio</div>
          <div className="mt-2 text-xl font-semibold text-slate-100">
            {formatUsd(kpis.totalValue)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Invertido: {formatUsd(kpis.totalInvested)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-slate-400">Ganancia / pérdida total</div>
          <div className={"mt-2 text-xl font-semibold " + classPnl(kpis.totalPnl)}>
            {formatUsd(kpis.totalPnl)}
          </div>
          <div className={"mt-1 text-xs " + classPnl(kpis.totalPnl)}>
            {formatPct(kpis.totalPct)} rentabilidad
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-slate-400">Ganancias vs pérdidas</div>
          <div className="mt-2 text-sm">
            <span className="text-emerald-400">+ {formatUsd(kpis.gains)}</span>{" "}
            <span className="text-slate-400">/</span>{" "}
            <span className="text-rose-400">- {formatUsd(kpis.losses)}</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">Suma de PnL por activo</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-slate-400">Cantidad de activos</div>
          <div className="mt-2 text-xl font-semibold text-slate-100">{kpis.count}</div>
          <div className="mt-1 text-xs text-slate-400">Posiciones abiertas</div>
        </div>
      </div>

      {/* Charts */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-100">Evolución del portfolio</div>
              <div className="mt-1 text-xs text-slate-400">
                Azul: valor total (con aportes). Verde: rendimiento (sin aportes).
              </div>
            </div>

            <div className="flex gap-2">
              {(["VALOR", "RENDIMIENTO", "AMBOS"] as ChartMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setChartMode(m)}
                  className={
                    "rounded-md px-2 py-1 text-xs border " +
                    (chartMode === m
                      ? "border-slate-200/40 bg-white/10 text-slate-100"
                      : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10")
                  }
                >
                  {m === "VALOR" ? "Valor" : m === "RENDIMIENTO" ? "Rendimiento" : "Ambos"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "rgba(226,232,240,0.7)", fontSize: 12 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                  tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
                />
                <YAxis
                  tick={{ fill: "rgba(226,232,240,0.7)", fontSize: 12 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                  tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
                />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row: any = payload[0]?.payload;
                    const val = toNum(row?.value);
                    const perf = toNum(row?.performance);
                    const cont = toNum(row?.contributed);

                    return (
                      <div className="rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2 text-xs text-slate-100 shadow-lg">
                        <div className="mb-1 font-semibold">{label}</div>
                        <div className="flex flex-col gap-1">
                          <div>Valor: {formatUsd(val)}</div>
                          <div className={classPnl(perf)}>Rendimiento: {formatUsd(perf)}</div>
                          <div className="text-slate-400">Aportes netos: {formatUsd(cont)}</div>
                        </div>
                      </div>
                    );
                  }}
                />

                {(chartMode === "VALOR" || chartMode === "AMBOS") && (
                  <Line type="monotone" dataKey="value" stroke="#60A5FA" strokeWidth={2.2} dot={false} />
                )}
                {(chartMode === "RENDIMIENTO" || chartMode === "AMBOS") && (
                  <Line type="monotone" dataKey="performance" stroke="#34D399" strokeWidth={2.2} dot={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            {(["1M", "3M", "6M", "1Y", "TODO"] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={
                  "rounded-md px-2 py-1 text-xs border " +
                  (range === r
                    ? "border-slate-200/40 bg-white/10 text-slate-100"
                    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10")
                }
              >
                {r === "TODO" ? "Todo" : r}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-100">Distribución</div>
              <div className="mt-1 text-xs text-slate-400">
                {pieMode === "TIPO" ? "Por tipo de activo" : "Por activo (Top + resto)"}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPieMode("TIPO")}
                className={
                  "rounded-md px-2 py-1 text-xs border " +
                  (pieMode === "TIPO"
                    ? "border-slate-200/40 bg-white/10 text-slate-100"
                    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10")
                }
              >
                Por tipo
              </button>
              <button
                onClick={() => setPieMode("ACTIVO")}
                className={
                  "rounded-md px-2 py-1 text-xs border " +
                  (pieMode === "ACTIVO"
                    ? "border-slate-200/40 bg-white/10 text-slate-100"
                    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10")
                }
              >
                Por activo
              </button>
            </div>
          </div>

          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData.items}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {pieData.items.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>

                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p: any = payload[0]?.payload;
                    const value = toNum(p?.value);
                    const pct = toNum(p?.pct);

                    return (
                      <div className="rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2 text-xs text-slate-100 shadow-lg">
                        <div className="mb-1 font-semibold">{String(p?.label ?? "")}</div>
                        <div>Valor: {formatUsd(value)}</div>
                        <div className="text-slate-300">
                          % del portfolio:{" "}
                          {pct.toLocaleString("es-UY", {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}
                          %
                        </div>
                      </div>
                    );
                  }}
                />

                <Legend
                  verticalAlign="bottom"
                  height={80}
                  formatter={(value: any, entry: any) => {
                    const payload: any = entry?.payload;
                    const pct = toNum(payload?.pct);
                    const label = String(value);
                    return (
                      <span className="text-xs text-slate-200">
                        {label}{" "}
                        <span className="text-slate-400">
                          ({pct.toLocaleString("es-UY", { maximumFractionDigits: 1 })}%)
                        </span>
                      </span>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-100">Detalle de posiciones</div>
            <div className="mt-1 text-xs text-slate-400">
              Tabla con scroll para ver todo. Precios actuales se refrescan cada 60s.
            </div>
          </div>

          <button className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500">
            Agregar
          </button>
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {(["Acción", "ETFs", "Cripto", "Bonos", "Metales"] as AssetType[]).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={
                  "rounded-md px-3 py-1.5 text-sm border " +
                  (activeTab === t
                    ? "border-sky-500 bg-sky-500/10 text-sky-300"
                    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10")
                }
              >
                {t === "Acción" ? "Acciones" : t}
              </button>
            ))}
            <button
              onClick={() => setActiveTab("Todas")}
              className={
                "rounded-md px-3 py-1.5 text-sm border " +
                (activeTab === "Todas"
                  ? "border-sky-500 bg-sky-500/10 text-sky-300"
                  : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10")
              }
            >
              Todas
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[1060px] overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr className="text-left text-xs font-semibold text-slate-300">
                  <th className="px-3 py-2">Símbolo</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Cantidad</th>
                  <th className="px-3 py-2">Precio compra</th>
                  <th className="px-3 py-2">Precio actual</th>
                  <th className="px-3 py-2">Invertido</th>
                  <th className="px-3 py-2">Valor actual</th>
                  <th className="px-3 py-2">Ganancia / pérdida</th>
                  <th className="px-3 py-2">% Rent.</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5">
                {loading && (
                  <tr>
                    <td colSpan={10} className="px-3 py-6 text-center text-slate-300">
                      Cargando...
                    </td>
                  </tr>
                )}

                {!loading && filteredPositions.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-6 text-center text-slate-300">
                      No hay posiciones para mostrar.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredPositions.map((p) => {
                    const isDeleting = deletingSymbol === p.symbol;

                    return (
                      <tr key={p.symbol} className="text-slate-100">
                        <td className="px-3 py-2 font-semibold text-sky-300">{p.symbol}</td>
                        <td className="px-3 py-2 text-slate-300">{p.type}</td>
                        <td className="px-3 py-2">
                          {p.quantity.toLocaleString("es-UY", { maximumFractionDigits: 6 })}
                        </td>
                        <td className="px-3 py-2">{formatUsd(p.buyPrice)}</td>
                        <td className="px-3 py-2">
                          {p.currentPrice == null ? (
                            <span className="text-slate-500">—</span>
                          ) : (
                            formatUsd(p.currentPrice)
                          )}
                        </td>
                        <td className="px-3 py-2">{formatUsd(p.invested)}</td>
                        <td className="px-3 py-2">
                          {p.currentPrice == null ? (
                            <span className="text-slate-500">—</span>
                          ) : (
                            formatUsd(p.valueNow)
                          )}
                        </td>
                        <td className={"px-3 py-2 font-medium " + classPnl(p.pnl)}>
                          {p.currentPrice == null ? (
                            <span className="text-slate-500">—</span>
                          ) : (
                            formatUsd(p.pnl)
                          )}
                        </td>
                        <td className={"px-3 py-2 font-medium " + classPnl(p.pnlPct)}>
                          {p.currentPrice == null ? (
                            <span className="text-slate-500">—</span>
                          ) : (
                            formatPct(p.pnlPct)
                          )}
                        </td>

                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => handleDeleteSymbol(p.symbol)}
                            disabled={isDeleting}
                            className={
                              "rounded-md border px-2 py-1 text-xs font-medium " +
                              (isDeleting
                                ? "border-white/10 bg-white/5 text-slate-400 cursor-not-allowed"
                                : "border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15")
                            }
                            title="Eliminar este activo del registro (borra sus operaciones)"
                          >
                            {isDeleting ? "Eliminando..." : "Eliminar"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
