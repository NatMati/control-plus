// src/app/presupuestos/nuevo/page.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useBudgets } from "@/context/BudgetsContext";
import { type Currency } from "@/context/SettingsContext";

type MonthOption = {
  value: string; // YYYY-MM
  label: string; // "Noviembre de 2025"
};

export default function NuevoPresupuestoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addBudget } = useBudgets();

  const initialMonth = searchParams.get("month") ?? getCurrentMonthValue();

  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState<string>("0");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [month, setMonth] = useState(initialMonth);
  const [note, setNote] = useState("");
  const [copyFromPrev, setCopyFromPrev] = useState(false);

  const monthOptions = buildMonthOptions(month);

  const onSubmit = () => {
    const amt = parseFloat(amount || "0");
    if (!category.trim()) return alert("Ingrese una categoría.");
    if (!amt || amt <= 0)
      return alert("Ingrese un monto límite mayor a 0.");

    // 🔹 Guardar en el contexto
    addBudget({
      category: category.trim(),
      limit: amt,
      currency,
      month,
      note: note.trim() || undefined,
    });

    // (Más adelante podemos implementar la lógica real de "copiar mes anterior")

    router.push("/presupuestos");
  };

  const explainCopy = () => {
    alert(
      [
        '¿Cómo va a funcionar "Copiar categorías y montos del mes anterior"?',
        "",
        "- Cuando esté activa, el sistema buscará los presupuestos del mes anterior",
        "  al mes seleccionado.",
        "- Copiará las categorías y montos límite.",
        "- Solo creará categorías nuevas que aún no existan para ese mes.",
        "",
        "Por ahora esta opción es solo informativa.",
      ].join("\n")
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Nuevo presupuesto</h1>
        <p className="text-sm text-slate-400 max-w-2xl">
          Definí la categoría, el límite, la moneda y el mes al que pertenece
          este presupuesto. Luego vas a poder verlo y seguirlo en la sección de
          Presupuestos.
        </p>
      </div>

      <div className="max-w-3xl">
        <div className="rounded-2xl border border-slate-800 bg-[#050816] p-6 space-y-5">
          {/* Categoría */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">
              Categoría{" "}
              <span className="text-slate-500">(obligatoria)</span>
            </label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ej.: Comida, Transporte, Salidas..."
              className="bg-[#020617] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/70"
            />
          </div>

          {/* Monto + moneda */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">
                Monto límite{" "}
                <span className="text-slate-500">(obligatorio)</span>
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-[#020617] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/70"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Moneda</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="bg-[#020617] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/70"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="UYU">UYU</option>
              </select>
            </div>
          </div>

          {/* Mes del presupuesto */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">
              Mes del presupuesto{" "}
              <span className="text-slate-500">(obligatorio)</span>
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-[#020617] border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/70"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Este presupuesto se va a aplicar al mes seleccionado.
            </p>
          </div>

          {/* Copiar mes anterior */}
          <div className="rounded-lg border border-slate-800 bg-[#020617] px-4 py-3 space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={copyFromPrev}
                onChange={(e) => setCopyFromPrev(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-500"
              />
              <span>Copiar categorías y montos del mes anterior</span>
            </label>
            <p className="text-xs text-slate-400">
              Esta opción va a copiar automáticamente los presupuestos del mes
              anterior al mes seleccionado. Por ahora es solo informativa; más
              adelante vamos a activar la lógica real de copia.
            </p>
            <button
              type="button"
              onClick={explainCopy}
              className="mt-1 inline-flex items-center justify-center rounded border border-slate-600 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800/60"
            >
              Explicar cómo funcionará
            </button>
          </div>

          {/* Nota */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">
              Nota <span className="text-slate-500">(opcional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Detalle breve (ej.: tope de salidas del mes)."
              className="bg-[#020617] border border-slate-700 rounded-lg px-3 py-2 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-sky-500/70"
            />
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 rounded-lg border border-slate-700 text-sm text-slate-200 hover:bg-slate-800/60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSubmit}
              className="px-4 py-2 rounded-lg bg-[#3b82f6] hover:bg-blue-500 text-sm font-medium text-white"
            >
              Guardar presupuesto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mes actual en formato YYYY-MM para estado inicial */
function getCurrentMonthValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Construye lista de meses alrededor del mes seleccionado (12 meses hacia atrás) */
function buildMonthOptions(baseMonth: string): MonthOption[] {
  const [yearStr, monthStr] = baseMonth.split("-");
  const baseDate = new Date(Number(yearStr), Number(monthStr) - 1, 1);

  const months: MonthOption[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    months.push({
      value: `${y}-${m}`,
      label: getMonthLabel(d),
    });
  }
  return months;
}

function getMonthLabel(date: Date): string {
  const meses = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const mes = meses[date.getMonth()];
  const año = date.getFullYear();
  return `${mes} de ${año}`;
}
