// src/app/movimientos/nuevo/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccounts } from "@/context/AccountsContext";
import { useSettings, Currency } from "@/context/SettingsContext";

type UITipoMovimiento = "INGRESO" | "GASTO" | "TRANSFER";

type MovementApiRow = {
  id: string;
  type: string;
  category: string | null;
};

export default function NuevoMovimientoPage() {
  const router = useRouter();
  const { accounts, addMovement, addAccount } = useAccounts();
  const { currency } = useSettings();

  const [type, setType] = useState<UITipoMovimiento>("TRANSFER");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState<string>("0");
  const [movCurrency, setMovCurrency] = useState<Currency>(currency);

  const [accountId, setAccountId] = useState<string>(accounts[0]?.id || "");
  const [fromId, setFromId] = useState<string>(accounts[0]?.id || "");
  const [toId, setToId] = useState<string>(accounts[1]?.id || "");
  const [category, setCategory] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const [newAccName, setNewAccName] = useState<string>("");
  const [newAccCurrency, setNewAccCurrency] = useState<Currency>("USD");

  // =========================
  // Categorías (sugerencias)
  // =========================
  const [knownCategories, setKnownCategories] = useState<string[]>([]);
  const [catLoading, setCatLoading] = useState(false);

  // Trae categorías existentes desde /api/movements (tu endpoint ya existe)
  useEffect(() => {
    let active = true;

    async function loadCategories() {
      try {
        setCatLoading(true);
        const res = await fetch("/api/movements", { method: "GET" });
        if (!res.ok) return;

        const json = await res.json();
        const rows = (json?.movements ?? []) as MovementApiRow[];

        const cats = rows
          .map((m) => (m.category ?? "").trim())
          .filter(Boolean);

        const uniq = Array.from(new Set(cats)).sort((a, b) =>
          a.localeCompare(b, "es")
        );

        if (active) setKnownCategories(uniq);
      } catch {
        // silencioso: si falla, igual podés escribir categoría manual
      } finally {
        if (active) setCatLoading(false);
      }
    }

    loadCategories();
    return () => {
      active = false;
    };
  }, []);

  // Opcional: si querés sugerencias distintas según INGRESO/GASTO
  const categorySuggestions = useMemo(() => {
    // hoy no filtramos por tipo porque tu DB guarda categorías para ambos
    // y no estás guardando un catálogo separado por type.
    // Si después querés, filtramos con más data en API.
    return knownCategories;
  }, [knownCategories]);

  const addNewAccount = async () => {
    const name = newAccName.trim();
    if (!name) return alert("Ingresá un nombre válido");

    const exists = accounts.some(
      (a) =>
        a.name.trim().toLowerCase() === name.toLowerCase() &&
        a.currency === newAccCurrency
    );

    if (exists) {
      const confirmar = window.confirm(
        `Ya tenés una cuenta "${name}" en ${newAccCurrency}.\n\n¿Querés crear otra con el mismo nombre?`
      );
      if (!confirmar) return;
    }

    await addAccount({
      name,
      currency: newAccCurrency,
    });

    setNewAccName("");
  };

  const handleDeleteAccount = async (id: string, name: string) => {
    const ok = window.confirm(
      `¿Seguro que querés eliminar la cuenta "${name}"?\n\nSi tiene movimientos asociados, el sistema no la dejará borrar.`
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Error al eliminar cuenta:", text);
        alert(
          "No se pudo eliminar la cuenta. Asegurate de que no tenga movimientos asociados."
        );
        return;
      }

      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Ocurrió un error al eliminar la cuenta.");
    }
  };

  const onSubmit = async () => {
    const amt = parseFloat(amount || "0");
    if (!amt || amt <= 0) return alert("Monto inválido");

    try {
      if (type === "TRANSFER") {
        if (!fromId || !toId || fromId === toId) {
          return alert("Seleccioná cuentas distintas para la transferencia");
        }

        addMovement({
          type,
          date,
          fromId,
          toId,
          amount: amt,
          currency: movCurrency,
          note,
        });

        const res = await fetch("/api/movements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            type: "TRANSFER",
            fromAccountId: fromId,
            toAccountId: toId,
            amount: amt,
            currency: movCurrency,
            description: note,
          }),
        });

        if (!res.ok) {
          console.error("Error al guardar TRANSFER en Supabase", await res.text());
          alert(
            "La transferencia se actualizó localmente pero falló al guardarse en el servidor."
          );
        }
      } else if (type === "INGRESO" || type === "GASTO") {
        if (!accountId) return alert("Seleccioná cuenta");

        const cat = category.trim();

        addMovement({
          type,
          date,
          accountId,
          amount: amt,
          currency: movCurrency,
          category: cat,
          note,
        });

        const res = await fetch("/api/movements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            accountId,
            type, // "INGRESO" | "GASTO" (API lo mapea)
            category: cat || null,
            amount: amt,
            currency: movCurrency,
            description: note,
          }),
        });

        if (!res.ok) {
          console.error("Error al guardar en Supabase", await res.text());
          alert(
            "El movimiento se guardó localmente pero falló al guardarse en el servidor."
          );
        } else {
          // Si guardó y hay categoría nueva, la agregamos a sugerencias sin recargar
          if (cat) {
            setKnownCategories((prev) => {
              const next = new Set(prev);
              next.add(cat);
              return Array.from(next).sort((a, b) => a.localeCompare(b, "es"));
            });
          }
        }
      }

      router.push("/movimientos");
    } catch (error) {
      console.error(error);
      alert("Ocurrió un error al registrar el movimiento.");
    }
  };

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-semibold mb-6">Registrar movimiento</h1>

      {/* Tipo */}
      <div className="flex gap-2 mb-6">
        {(["INGRESO", "GASTO", "TRANSFER"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`px-3 py-2 rounded border text-sm tracking-wide
            ${
              type === t
                ? "bg-slate-800 border-slate-500"
                : "border-slate-700 hover:bg-slate-800/60"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Fecha / Moneda / Monto */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Fecha (obligatorio)</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-[#0f1830] border border-slate-700 rounded px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Moneda (del movimiento)</label>
          <select
            value={movCurrency}
            onChange={(e) => setMovCurrency(e.target.value as Currency)}
            className="bg-[#0f1830] border border-slate-700 rounded px-3 py-2"
          >
            {(["USD", "EUR", "UYU", "ARS", "BRL"] as Currency[]).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Monto (obligatorio)</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-[#0f1830] border border-slate-700 rounded px-3 py-2"
          />
        </div>
      </div>

      {/* Campos según tipo */}
      {type === "TRANSFER" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <div className="flex flex-col">
            <label className="text-xs text-slate-400">Origen (cuenta que descuenta)</label>
            <select
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
              className="bg-[#0f1830] border border-slate-700 rounded px-3 py-2"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-slate-400">Destino (cuenta que recibe)</label>
            <select
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              className="bg-[#0f1830] border border-slate-700 rounded px-3 py-2"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <div className="flex flex-col">
            <label className="text-xs text-slate-400">Cuenta (impacto)</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="bg-[#0f1830] border border-slate-700 rounded px-3 py-2"
            >
              <option value="">Seleccionar…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </div>

          {/* Categoría con sugerencias */}
          <div className="flex flex-col">
            <label className="text-xs text-slate-400">Categoría (opcional)</label>

            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ej.: Sueldo, Comida, Servicios…"
              list="known-categories"
              className="bg-[#0f1830] border border-slate-700 rounded px-3 py-2"
            />

            <datalist id="known-categories">
              {categorySuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>

            <div className="mt-1 text-[11px] text-slate-500">
              {catLoading
                ? "Cargando categorías…"
                : categorySuggestions.length
                ? "Podés seleccionar una existente o escribir una nueva."
                : "Escribí una categoría (se guardará para futuras sugerencias)."}
            </div>
          </div>
        </div>
      )}

      {/* Nota */}
      <div className="flex flex-col gap-1 mb-6">
        <label className="text-xs text-slate-400">Nota (opcional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Detalle del movimiento (ej.: Fondo PC, Pago tarjeta, etc.)"
          className="w-full h-24 bg-[#0f1830] border border-slate-700 rounded px-3 py-2"
        />
      </div>

      <hr className="my-8 border-slate-800" />

      <h3 className="text-slate-300 text-sm font-medium mb-3">Gestión de bancos y cuentas</h3>

      <div className="border border-slate-800 bg-[#0f1830] rounded-xl p-4 mb-8">
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Usá nombres simples para tus cuentas (ejemplo:
          <span className="italic text-slate-300"> “Banco Itaú”</span>,
          <span className="italic text-slate-300"> “Tarjeta Prex”</span>,
          <span className="italic text-slate-300"> “Efectivo”</span>). No ingreses números de cuenta,
          CBU, tarjetas ni datos sensibles.
        </p>

        <div className="flex flex-col md:flex-row gap-3 mb-3">
          <input
            type="text"
            value={newAccName}
            onChange={(e) => setNewAccName(e.target.value)}
            placeholder="Nombre de la cuenta (ej.: Banco Itaú)"
            className="flex-1 bg-[#0b1221] border border-slate-700 rounded px-3 py-2"
          />

          <select
            value={newAccCurrency}
            onChange={(e) => setNewAccCurrency(e.target.value as Currency)}
            className="bg-[#0b1221] border border-slate-700 rounded px-3 py-2 w-[90px]"
          >
            {(["USD", "EUR", "UYU", "ARS", "BRL"] as Currency[]).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <button
            onClick={addNewAccount}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded px-4 py-2 whitespace-nowrap"
          >
            Agregar banco / cuenta
          </button>
        </div>

        <div className="text-xs text-slate-400 mt-4">
          <span className="block mb-1 text-slate-300 font-medium">Cuentas guardadas:</span>
          {accounts.length === 0 ? (
            <span className="italic text-slate-500">Todavía no agregaste ninguna cuenta.</span>
          ) : (
            <ul className="space-y-1">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  <span>
                    {a.name} ({a.currency})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(a.id, a.name)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          className="bg-blue-600 hover:bg-blue-500 text-white rounded px-4 py-2"
        >
          Guardar
        </button>
        <button
          onClick={() => router.back()}
          className="border border-slate-700 rounded px-4 py-2"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
