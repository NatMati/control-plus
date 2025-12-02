// src/app/movimientos/MovimientosClient.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSettings } from "@/context/SettingsContext";
import { useAccounts } from "@/context/AccountsContext";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

// ===== Tipo que usa el server (page.tsx) =====
export type UIMovement = {
  id: string;
  date: string; // "YYYY-MM-DD"
  type: "INGRESO" | "GASTO" | "TRANSFER";
  category?: string;
  amount: number;
  currency: string; // mantenemos string y casteamos donde haga falta
  note?: string;
  accountId?: string;
};

type Props = {
  initialMovements: UIMovement[];
};

// ================== Componente principal (client) ==================
export default function MovimientosClient({ initialMovements }: Props) {
  const { convert, format, currency } = useSettings();
  const { deleteMovement } = useAccounts();

  // ahora los movimientos vienen del server y los guardamos en estado local
  const [movements, setMovements] = useState<UIMovement[]>(initialMovements);

  // Filtros UI
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<"" | "INGRESO" | "GASTO" | "TRANSFER">("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [categoria, setCategoria] = useState("");

  // Detalle analítico (qué card se abrió)
  const [detailType, setDetailType] = useState<
    "" | "INGRESO" | "GASTO" | "TRANSFER"
  >("");

  // Catálogo categorías
  const categorias = useMemo(() => {
    return Array.from(new Set(movements.map((m) => m.category || "")))
      .filter(Boolean)
      .sort();
  }, [movements]);

  // Aplicar filtros
  const filtrados = useMemo(() => {
    return movements
      .filter((m) => {
        if (q) {
          const texto = `${m.category ?? ""} ${m.accountId ?? ""} ${
            m.note ?? ""
          }`.toLowerCase();
          if (!texto.includes(q.toLowerCase())) return false;
        }
        if (tipo && m.type !== tipo) return false;
        if (categoria && m.category !== categoria) return false;
        if (desde && m.date < desde) return false;
        if (hasta && m.date > hasta) return false;
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [movements, q, tipo, categoria, desde, hasta]);

  // Totales convertidos (sobre los filtrados)
  const totals = useMemo(() => {
    let ingreso = 0,
      gasto = 0,
      transfer = 0;

    for (const m of filtrados) {
      const monto = convert(m.amount, {
        from: m.currency as any,
        to: currency,
      });

      if (m.type === "INGRESO") ingreso += monto;
      else if (m.type === "GASTO") gasto += monto;
      else transfer += monto;
    }

    return { ingreso, gasto, transfer };
  }, [filtrados, convert, currency]);

  // ==== Datos agregados por mes (para gráfico) ====
  const monthlySummary = useMemo(() => {
    if (!movements.length) return [];

    const map = new Map<
      string,
      { income: number; expense: number; net: number }
    >();

    for (const m of movements) {
      const monthKey = m.date.slice(0, 7); // "YYYY-MM"
      const bucket =
        map.get(monthKey) || { income: 0, expense: 0, net: 0 };
      const amount = convert(m.amount, {
        from: m.currency as any,
        to: currency,
      });

      if (m.type === "INGRESO") {
        bucket.income += amount;
      } else if (m.type === "GASTO") {
        bucket.expense += amount;
      }

      bucket.net = bucket.income - bucket.expense;
      map.set(monthKey, bucket);
    }

    const ordered = Array.from(map.entries()).sort(([a], [b]) =>
      a > b ? 1 : -1
    );

    const last6 = ordered.slice(-6);

    return last6.map(([key, val]) => ({
      monthKey: key,
      monthLabel: monthLabelFromKey(key),
      income: val.income,
      expense: val.expense,
      net: val.net,
    }));
  }, [movements, convert, currency]);

  // Insight de gastos vs mes anterior
  const spendingInsight = useMemo(() => {
    if (monthlySummary.length < 2) return null;

    const current = monthlySummary[monthlySummary.length - 1];
    const previous = monthlySummary[monthlySummary.length - 2];

    const currentKey = current.monthKey;
    const previousKey = previous.monthKey;

    const prevCat = new Map<string, number>();
    const currCat = new Map<string, number>();

    for (const m of movements) {
      if (m.type !== "GASTO" || !m.category) continue;
      const key = m.date.slice(0, 7);
      const amount = convert(m.amount, {
        from: m.currency as any,
        to: currency,
      });

      if (key === previousKey) {
        prevCat.set(m.category, (prevCat.get(m.category) || 0) + amount);
      }
      if (key === currentKey) {
        currCat.set(m.category, (currCat.get(m.category) || 0) + amount);
      }
    }

    let worstCat = "";
    let worstDiffAbs = 0;
    let worstDiffPct = 0;

    for (const [cat, currVal] of currCat.entries()) {
      const prevVal = prevCat.get(cat) || 0;
      const diff = currVal - prevVal;
      if (diff > worstDiffAbs) {
        worstDiffAbs = diff;
        worstDiffPct = prevVal > 0 ? (diff / prevVal) * 100 : 100;
        worstCat = cat;
      }
    }

    const totalDiff = current.expense - previous.expense;
    const totalPct =
      previous.expense > 0 ? (totalDiff / previous.expense) * 100 : 0;

    return {
      current,
      previous,
      worstCat,
      worstDiffAbs,
      worstDiffPct,
      totalDiff,
      totalPct,
    };
  }, [monthlySummary, movements, convert, currency]);

  // Scroll helpers
  const scrollToDetail = () => {
    document
      .getElementById("detalle-movimientos")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToTable = () => {
    document
      .getElementById("tabla-movimientos")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Handler eliminar (sincroniza contexto + estado local)
  const handleDelete = async (id: string) => {
    try {
      await deleteMovement(id);
      setMovements((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      console.error("Error eliminando movimiento", e);
      // acá después podemos meter un toast
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header + CTA */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold mr-auto">Movimientos</h1>

        <Link
          href="/movimientos/nuevo"
          className="bg-[#3b82f6] hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm"
        >
          Registrar movimiento
        </Link>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-[#0f1830] border border-slate-800 rounded-xl p-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por categoría, nota, cuenta…"
          className="col-span-1 md:col-span-2 bg-[#0b1221] border border-slate-700 rounded-lg px-3 py-2 text-sm"
        />

        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as any)}
          className="bg-[#0b1221] border border-slate-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Tipo: todos</option>
          <option value="INGRESO">Ingreso</option>
          <option value="GASTO">Gasto</option>
          <option value="TRANSFER">Transferencia</option>
        </select>

        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="bg-[#0b1221] border border-slate-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Categoría: todas</option>
          {categorias.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>

        <div className="flex gap-3">
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="flex-1 bg-[#0b1221] border border-slate-700 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="flex-1 bg-[#0b1221] border border-slate-700 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Totales (cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card
          title="Ingresos"
          value={format(totals.ingreso)}
          tone="green"
          onMore={() => {
            setTipo("INGRESO");
            setCategoria("");
            setDetailType("INGRESO");
            scrollToDetail();
          }}
        />
        <Card
          title="Gastos"
          value={format(totals.gasto)}
          tone="red"
          onMore={() => {
            setTipo("GASTO");
            setCategoria("");
            setDetailType("GASTO");
            scrollToDetail();
          }}
        />
        <Card
          title="Transferencias"
          value={format(totals.transfer)}
          tone="blue"
          onMore={() => {
            setTipo("TRANSFER");
            setCategoria("");
            setDetailType("TRANSFER");
            scrollToDetail();
          }}
        />
      </div>

      {/* ================= Detalle analítico ================= */}
      {detailType && (
        <div
          id="detalle-movimientos"
          className="rounded-xl border border-slate-800 bg-[#0f1830] p-4 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">
                Análisis detallado de ingresos y gastos
              </div>
              <div className="text-xs text-slate-500">
                Comparación simple de lo que entra y sale cada mes. Los datos se
                basan en todos los movimientos registrados.
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDetailType("")}
              className="text-[11px] px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              Cerrar detalle
            </button>
          </div>

          {/* Gráfico ingresos vs gastos */}
          <div className="h-56">
            {monthlySummary.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Todavía no hay datos suficientes para mostrar el gráfico.
                Registrá algunos movimientos primero.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySummary}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="monthLabel"
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
                    formatter={(value: number) => format(value)}
                    labelFormatter={(label) => `Mes: ${label}`}
                    contentStyle={{
                      backgroundColor: "#020617",
                      border: "1px solid #1f2937",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend />
                  <Bar dataKey="income" name="Ingresos" fill="#22c55e" />
                  <Bar dataKey="expense" name="Gastos" fill="#f97316" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Insights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-[#050816] border border-slate-800 rounded-lg p-3">
              <div className="text-slate-300 font-medium mb-1">
                Último mes vs anterior
              </div>
              {spendingInsight ? (
                <>
                  <p className="text-slate-400">
                    En{" "}
                    <span className="font-semibold">
                      {spendingInsight.current.monthLabel}
                    </span>{" "}
                    gastaste{" "}
                    <span
                      className={
                        spendingInsight.totalDiff >= 0
                          ? "text-rose-400 font-semibold"
                          : "text-emerald-400 font-semibold"
                      }
                    >
                      {format(Math.abs(spendingInsight.totalDiff))}{" "}
                      {spendingInsight.totalDiff >= 0 ? "más" : "menos"}
                    </span>{" "}
                    que en{" "}
                    <span className="font-semibold">
                      {spendingInsight.previous.monthLabel}
                    </span>
                    .
                  </p>
                  {spendingInsight.totalDiff > 0 &&
                    spendingInsight.current.expense >
                      spendingInsight.current.income && (
                      <p className="mt-1 text-rose-400">
                        El mes pasado tus gastos superaron tus ingresos. Tené
                        cuidado este mes y revisá tus categorías más fuertes.
                      </p>
                    )}
                </>
              ) : (
                <p className="text-slate-500">
                  Necesitamos al menos dos meses con datos para comparar.
                </p>
              )}
            </div>

            <div className="bg-[#050816] border border-slate-800 rounded-lg p-3">
              <div className="text-slate-300 font-medium mb-1">
                Categoría que más creció
              </div>
              {spendingInsight && spendingInsight.worstCat ? (
                <>
                  <p className="text-slate-400">
                    La categoría que más aumentó sus gastos fue{" "}
                    <span className="font-semibold">
                      {spendingInsight.worstCat}
                    </span>
                    .
                  </p>
                  <p className="text-slate-400 mt-1">
                    Aumentó aproximadamente{" "}
                    <span className="font-semibold">
                      {format(spendingInsight.worstDiffAbs)}
                    </span>{" "}
                    (
                    {spendingInsight.worstDiffPct.toFixed(0)}
                    % aprox.) frente al mes anterior.
                  </p>
                </>
              ) : (
                <p className="text-slate-500">
                  Cuando tengas más gastos registrados podremos decirte en qué
                  categoría se te está yendo más dinero.
                </p>
              )}
            </div>

            <div className="bg-[#050816] border border-slate-800 rounded-lg p-3">
              <div className="text-slate-300 font-medium mb-1">
                Tip rápido para este mes
              </div>
              {spendingInsight ? (
                spendingInsight.totalDiff > 0 ? (
                  <p className="text-slate-400">
                    Este mes podrías fijarte un{" "}
                    <span className="font-semibold">tope mental</span> para la
                    categoría que más creció y registrar cada gasto ahí. Si ves
                    que te acercás al valor del mes pasado, frenás a tiempo.
                  </p>
                ) : (
                  <p className="text-slate-400">
                    Vas bien: tus gastos no vienen por encima del mes anterior.
                    Aprovechá para mantener este ritmo y reforzar tus hábitos
                    que funcionaron.
                  </p>
                )
              ) : (
                <p className="text-slate-500">
                  A medida que registres más meses con datos, acá vas a ver
                  recomendaciones concretas sobre cómo mejorar.
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={scrollToTable}
              className="text-[11px] text-sky-400 hover:text-sky-300"
            >
              Ir a la tabla de movimientos ↓
            </button>
          </div>
        </div>
      )}

      {/* ================= Tabla ================= */}
      <div
        id="tabla-movimientos"
        className="bg-[#0f1830] border border-slate-800 rounded-xl overflow-hidden"
      >
        <div className="grid grid-cols-12 px-4 py-3 text-xs uppercase tracking-wide text-slate-400 border-b border-slate-800">
          <div className="col-span-2">Fecha</div>
          <div className="col-span-2">Tipo</div>
          <div className="col-span-2">Categoría</div>
          <div className="col-span-2">Cuenta</div>
          <div className="col-span-2">Monto</div>
          <div className="col-span-1">Nota</div>
          <div className="col-span-1 text-right">Acciones</div>
        </div>

        {filtrados.length === 0 && (
          <div className="p-6 text-sm text-slate-400">Sin resultados.</div>
        )}

        {filtrados.map((m) => {
          const monto = convert(m.amount, {
            from: m.currency as any,
            to: currency,
          });

          return (
            <div
              key={m.id}
              className="grid grid-cols-12 px-4 py-3 border-b border-slate-900/30 text-sm"
            >
              <div className="col-span-2">{formatDate(m.date)}</div>
              <div className="col-span-2">
                <Badge tipo={m.type} />
              </div>
              <div className="col-span-2">{m.category || "-"}</div>
              <div className="col-span-2">{resolveAccountName(m)}</div>
              <div className="col-span-2 font-medium">
                {format(monto)}
                <span className="ml-2 text-xs text-slate-500">
                  ({m.currency})
                </span>
              </div>
              <div className="col-span-1 text-slate-400 truncate">
                {m.note || "-"}
              </div>

              {/* Botón eliminar */}
              <div className="col-span-1 flex justify-end">
                <button
                  onClick={() => handleDelete(m.id)}
                  className="text-red-400 hover:text-red-300 text-xs"
                >
                  Eliminar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --------------------- Helpers UI ---------------------

function resolveAccountName(mov: UIMovement) {
  if (mov.type === "TRANSFER") {
    return "Transferencia";
  }
  return mov.accountId || "-";
}

function Card({
  title,
  value,
  tone,
  onMore,
}: {
  title: string;
  value: string;
  tone: "green" | "red" | "blue";
  onMore?: () => void;
}) {
  const toneMap = {
    green: "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-600/30",
    red: "bg-rose-500/10 text-rose-300 ring-1 ring-rose-600/30",
    blue: "bg-sky-500/10 text-sky-300 ring-1 ring-sky-600/30",
  } as const;

  return (
    <div className="rounded-xl border border-slate-800 p-4 bg-[#0f1830]">
      <div className="text-slate-400 text-sm">{title}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>

      <div className="mt-3 flex items-center justify-between">
        <span
          className={`inline-flex px-2 py-1 rounded ${toneMap[tone]} text-xs`}
        >
          {title}
        </span>

        {onMore && (
          <button
            type="button"
            onClick={onMore}
            className="text-[11px] text-sky-400 hover:text-sky-300"
          >
            Ver detalle →
          </button>
        )}
      </div>
    </div>
  );
}

function Badge({ tipo }: { tipo: string }) {
  const map = {
    INGRESO: "text-emerald-300 bg-emerald-500/10 ring-1 ring-emerald-600/30",
    GASTO: "text-rose-300 bg-rose-500/10 ring-1 ring-rose-600/30",
    TRANSFER: "text-sky-300 bg-sky-500/10 ring-1 ring-sky-600/30",
  } as any;

  return (
    <span className={`px-2 py-1 rounded text-xs ${map[tipo]}`}>{tipo}</span>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function monthLabelFromKey(key: string) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("es-UY", { month: "short" });
}
