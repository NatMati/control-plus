"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Account = {
  id: string;
  name: string;
  currency: string;
  type: string;
  role: string;
};

type Props = {
  accounts: Account[];
  // lista de categorías existentes detectadas (puede ser [])
  categories: string[];
};

type MovementType = "INCOME" | "EXPENSE" | "TRANSFER";

function normalizeCategory(input: string) {
  const v = (input ?? "").trim();
  return v.length ? v : ""; // el API decide si lo guarda como null
}

export default function MovimientosNuevoClient({ accounts, categories }: Props) {
  const router = useRouter();

  const [type, setType] = useState<MovementType>("INCOME");
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [amount, setAmount] = useState<string>("0");
  const [currency, setCurrency] = useState<string>(() => accounts[0]?.currency ?? "UYU");

  // cuenta “impacto” (para income/expense). Para transfer después lo extendemos a from/to.
  const [accountId, setAccountId] = useState<string>(() => accounts[0]?.id ?? "");

  const [category, setCategory] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const categoryOptions = useMemo(() => {
    // Normaliza y dedup
    const set = new Set(
      (categories ?? [])
        .map((c) => (c ?? "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "es"))
    );
    return Array.from(set);
  }, [categories]);

  const submit = async () => {
    setSaving(true);
    setErr(null);
    setOk(null);

    try {
      if (!date) throw new Error("Fecha requerida.");
      if (!accountId) throw new Error("Seleccioná una cuenta.");

      const normalizedAmount = Number(
        (amount ?? "")
          .toString()
          .replace(/\s/g, "")
          .replace(/\./g, "")
          .replace(",", ".")
      );

      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        throw new Error("Monto inválido.");
      }

      const body: any = {
        date,
        type,
        amount: normalizedAmount,
        currency,
        account_id: accountId,
        category: normalizeCategory(category), // "" o "Comida"
        description: (note ?? "").trim() || null,
      };

      // IMPORTANTE:
      // Si tu API espera "note" en vez de "description" o espera "accountId" en vez de "account_id",
      // lo ajustamos cuando me pegues tu route actual.
      const res = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || `Error guardando movimiento (HTTP ${res.status})`);
      }

      setOk("Movimiento guardado.");
      router.push("/movimientos");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Error inesperado.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-slate-100">Registrar movimiento</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["INCOME", "EXPENSE", "TRANSFER"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={[
              "rounded-lg border px-3 py-2 text-sm",
              type === t
                ? "border-slate-500 bg-slate-800 text-white"
                : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800/60",
            ].join(" ")}
          >
            {t === "INCOME" ? "INGRESO" : t === "EXPENSE" ? "GASTO" : "TRANSFER"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-slate-400">Fecha (obligatorio)</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400">Moneda (del movimiento)</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
          >
            {Array.from(new Set(accounts.map((a) => a.currency))).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-400">Monto (obligatorio)</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-xs text-slate-400">
            Cuenta (impacto) {type === "TRANSFER" ? "(por ahora una sola; luego from/to)" : ""}
          </label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-400">Categoría (opcional)</label>

          {/* Selector libre + sugerencias */}
          <input
            list="cat-options"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Ej: Sueldo, Comida, Servicios…"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
          />
          <datalist id="cat-options">
            {categoryOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div className="md:col-span-3">
          <label className="text-xs text-slate-400">Nota (opcional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Detalle del movimiento (ej: Fondo PC, Pago tarjeta, etc.)"
            className="mt-1 w-full min-h-[110px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
          />
        </div>
      </div>

      {err && (
        <div className="rounded-lg border border-red-700 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {err}
        </div>
      )}
      {ok && (
        <div className="rounded-lg border border-emerald-700 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
          {ok}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/movimientos")}
          className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
