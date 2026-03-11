"use client";

import { useMemo, useState } from "react";
import { useMovements, Movement } from "@/lib/hooks/useMovements";

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-UY", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export default function MovementsTable() {
  const { movements, isLoading, error, reload } = useMovements({ limit: 500 });
  const [q, setQ] = useState("");
  const [type, setType] = useState<"ALL" | Movement["type"]>("ALL");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return movements.filter((m) => {
      if (type !== "ALL" && m.type !== type) return false;
      if (!needle) return true;
      const hay =
        `${m.category ?? ""} ${m.description ?? ""} ${m.currency} ${m.type} ${m.movement_type ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [movements, q, type]);

  if (isLoading) return <div className="p-4 text-sm opacity-80">Cargando movimientos…</div>;
  if (error) return <div className="p-4 text-sm text-red-400">Error cargando movimientos.</div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2">
          <input
            className="w-full md:w-72 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
            placeholder="Buscar por categoría, nota, tipo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
            value={type}
            onChange={(e) => setType(e.target.value as any)}
          >
            <option value="ALL">Todos</option>
            <option value="INCOME">Ingresos</option>
            <option value="EXPENSE">Gastos</option>
            <option value="TRANSFER">Transfer</option>
          </select>
        </div>

        <button
          onClick={() => reload()}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
        >
          Refrescar
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#0b1220]">
              <tr className="text-left text-xs uppercase tracking-wide opacity-70">
                <th className="p-3">Fecha</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Categoría</th>
                <th className="p-3">Nota</th>
                <th className="p-3 text-right">Monto</th>
                <th className="p-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-white/5">
                  <td className="p-3 whitespace-nowrap">{m.date}</td>
                  <td className="p-3 whitespace-nowrap">
                    {m.type}
                    {m.movement_type ? <span className="opacity-70"> · {m.movement_type}</span> : null}
                  </td>
                  <td className="p-3">{m.category ?? "—"}</td>
                  <td className="p-3 max-w-[420px] truncate">{m.description ?? "—"}</td>
                  <td className="p-3 text-right whitespace-nowrap">{formatMoney(m.amount, m.currency)}</td>
                  <td className="p-3">
                    <button
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                      onClick={() => alert("Siguiente paso: abrir modal de edición")}
                    >
                      Editar
                    </button>
                    <button
                      className="ml-2 rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs text-red-200 hover:bg-red-500/20"
                      onClick={() => alert("Siguiente paso: delete con confirm")}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td className="p-4 text-sm opacity-70" colSpan={6}>
                    No hay movimientos para esos filtros.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
