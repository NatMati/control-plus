// src/app/movimientos/MovimientosNuevoClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  categories: string[];
};

type MovementType = "INCOME" | "EXPENSE" | "TRANSFER";

type LastState = {
  currency?: string;
  accountId?: string;
  category?: string;
  fromId?: string;
  toId?: string;
};

const LS_KEY = "controlplus:lastMovementState:v1";

function readLS(): Record<MovementType, LastState> {
  if (typeof window === "undefined") return { INCOME: {}, EXPENSE: {}, TRANSFER: {} };
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return { INCOME: {}, EXPENSE: {}, TRANSFER: {} };
    const parsed = JSON.parse(raw);
    return {
      INCOME: parsed?.INCOME ?? {},
      EXPENSE: parsed?.EXPENSE ?? {},
      TRANSFER: parsed?.TRANSFER ?? {},
    };
  } catch {
    return { INCOME: {}, EXPENSE: {}, TRANSFER: {} };
  }
}

function writeLS(next: Record<MovementType, LastState>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

// Acepta: "10.000,50", "10000.50", "10 000,50", etc.
function parseAmountUY(input: string): number {
  const s = (input ?? "")
    .toString()
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function formatAmountUY(n: number): string {
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeCategory(input: string) {
  const v = (input ?? "").trim();
  return v.length ? v : "";
}

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

export default function MovimientosNuevoClient({ accounts, categories }: Props) {
  const router = useRouter();

  const firstAccId = accounts[0]?.id ?? "";
  const secondAccId = accounts[1]?.id ?? firstAccId;

  const [type, setType] = useState<MovementType>("EXPENSE");
  const [date, setDate] = useState<string>(() => todayISO());

  const [amount, setAmount] = useState<string>("");
  const amountRef = useRef<HTMLInputElement | null>(null);

  const [currency, setCurrency] = useState<string>(() => accounts[0]?.currency ?? "UYU");

  // INCOME/EXPENSE
  const [accountId, setAccountId] = useState<string>(() => firstAccId);
  const [category, setCategory] = useState<string>("");
  const [note, setNote] = useState<string>("");

  // TRANSFER
  const [fromId, setFromId] = useState<string>(() => firstAccId);
  const [toId, setToId] = useState<string>(() => secondAccId);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const categoryOptions = useMemo(() => {
    const set = new Set(
      (categories ?? [])
        .map((c) => (c ?? "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "es"))
    );
    return Array.from(set);
  }, [categories]);

  const quickChips = useMemo(() => categoryOptions.slice(0, 8), [categoryOptions]);

  // Restore LS al montar + foco
  useEffect(() => {
    const all = readLS();
    const st = all[type] ?? {};

    if (st.currency) setCurrency(st.currency);

    if (type === "TRANSFER") {
      if (st.fromId) setFromId(st.fromId);
      if (st.toId) setToId(st.toId);
    } else {
      if (st.accountId) setAccountId(st.accountId);
      if (st.category) setCategory(st.category);
    }

    setTimeout(() => amountRef.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al cambiar type, aplicamos “último usado” de ese tipo si existe
  useEffect(() => {
    const all = readLS();
    const st = all[type] ?? {};

    if (st.currency) setCurrency(st.currency);

    if (type === "TRANSFER") {
      setFromId(st.fromId ?? firstAccId);
      setToId(st.toId ?? secondAccId);
    } else {
      setAccountId(st.accountId ?? firstAccId);
      setCategory(st.category ?? "");
    }

    setErr(null);
    setOk(null);
    setTimeout(() => amountRef.current?.focus(), 30);
  }, [type, firstAccId, secondAccId]);

  // Persistir cambios relevantes en LS
  useEffect(() => {
    const all = readLS();
    const next: Record<MovementType, LastState> = {
      ...all,
      [type]: {
        ...all[type],
        currency,
        ...(type === "TRANSFER"
          ? { fromId, toId }
          : { accountId, category: (category ?? "").trim() || undefined }),
      },
    };
    writeLS(next);
  }, [type, currency, accountId, category, fromId, toId]);

  const onBlurAmount = () => {
    const n = parseAmountUY(amount);
    if (!Number.isFinite(n)) return;
    setAmount(formatAmountUY(n));
  };

  const swapTransfer = () => {
    setFromId(toId);
    setToId(fromId);
  };

  const submit = async (mode: "goBack" | "keepCreating") => {
    setSaving(true);
    setErr(null);
    setOk(null);

    try {
      if (!date) throw new Error("Fecha requerida.");

      const n = parseAmountUY(amount);
      if (!Number.isFinite(n) || n <= 0) throw new Error("Monto inválido.");

      if (type === "TRANSFER") {
        if (!fromId || !toId) throw new Error("Seleccioná cuentas de origen y destino.");
        if (fromId === toId) throw new Error("Seleccioná cuentas distintas para la transferencia.");
      } else {
        if (!accountId) throw new Error("Seleccioná una cuenta.");
      }

      const body =
        type === "TRANSFER"
          ? {
              date,
              type: "TRANSFER",
              amount: n,
              currency,
              fromAccountId: fromId,
              toAccountId: toId,
              description: (note ?? "").trim() || null,
            }
          : {
              date,
              type, // INCOME | EXPENSE
              amount: n,
              currency,
              accountId, // ✅ ESTE ES EL CAMBIO CLAVE
              category: normalizeCategory(category) || null,
              description: (note ?? "").trim() || null,
            };

      const res = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Error guardando movimiento (HTTP ${res.status})`);

      setOk("Movimiento guardado.");

      if (mode === "keepCreating") {
        setAmount("");
        setNote("");
        setTimeout(() => amountRef.current?.focus(), 40);
        router.refresh();
        return;
      }

      router.push("/movimientos");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Error inesperado.");
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (!saving) void submit("goBack");
    }
  };

  const subtitle =
    type === "INCOME"
      ? "Ej: sueldo, regalos, reembolsos…"
      : type === "EXPENSE"
      ? "Ej: supermercado, transporte, suscripciones…"
      : "Transferencia entre cuentas (sin afectar el neto).";

  return (
    <div className="p-6" onKeyDown={onKeyDown}>
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">Registrar movimiento</h1>
            <p className="text-sm text-slate-400">Rápido, claro y cómodo. Menos fricción para cargar.</p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/movimientos")}
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800"
          >
            Volver
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {([
            { k: "INCOME", label: "Ingreso" },
            { k: "EXPENSE", label: "Gasto" },
            { k: "TRANSFER", label: "Transferencia" },
          ] as const).map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setType(t.k)}
              className={cn(
                "rounded-xl border px-4 py-2 text-sm",
                type === t.k
                  ? "border-slate-500 bg-slate-900/60 text-slate-100"
                  : "border-slate-800 bg-transparent text-slate-300 hover:bg-slate-900/40"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#0f1830] px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "rounded-full px-2 py-1 text-xs ring-1",
                type === "INCOME" && "bg-emerald-500/10 text-emerald-200 ring-emerald-600/30",
                type === "EXPENSE" && "bg-orange-500/10 text-orange-200 ring-orange-600/30",
                type === "TRANSFER" && "bg-sky-500/10 text-sky-200 ring-sky-600/30"
              )}
            >
              {type === "INCOME" ? "Ingreso" : type === "EXPENSE" ? "Gasto" : "Transfer"}
            </span>
            <span className="text-slate-300">{subtitle}</span>
          </div>
          <div className="text-xs text-slate-500">Atajo: Ctrl+Enter para guardar</div>
        </div>

        <div
          className={cn(
            "rounded-2xl border bg-[#0f1830] p-5",
            type === "EXPENSE" ? "border-orange-700/30" : type === "INCOME" ? "border-emerald-700/30" : "border-sky-700/30"
          )}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs text-slate-400">Monto (obligatorio)</label>
              <input
                ref={amountRef}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={onBlurAmount}
                inputMode="decimal"
                placeholder="0,00"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-slate-500"
              />
              <div className="mt-1 text-[11px] text-slate-500">Admite coma o punto. Ej: 10.000,50</div>
            </div>

            <div>
              <label className="text-xs text-slate-400">Moneda</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-slate-500"
              >
                {Array.from(new Set(accounts.map((a) => a.currency))).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-1">
              <label className="text-xs text-slate-400">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-slate-500"
              />
            </div>

            {type === "TRANSFER" ? (
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Origen (descuenta)</label>
                  <select
                    value={fromId}
                    onChange={(e) => setFromId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-slate-500"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.currency})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400">Destino (recibe)</label>
                  <select
                    value={toId}
                    onChange={(e) => setToId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-slate-500"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.currency})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="button"
                    onClick={swapTransfer}
                    className="mt-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
                    title="Intercambiar origen y destino"
                  >
                    Swap origen/destino
                  </button>
                </div>
              </div>
            ) : (
              <div className="md:col-span-2">
                <label className="text-xs text-slate-400">Cuenta</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-slate-500"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {type !== "TRANSFER" && (
              <div className="md:col-span-3">
                <label className="text-xs text-slate-400">Categoría (opcional)</label>
                <input
                  list="cat-options"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder={type === "INCOME" ? "Ej: Sueldo, Regalos…" : "Ej: Comida, Servicios…"}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-slate-500"
                />
                <datalist id="cat-options">
                  {categoryOptions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>

                {quickChips.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {quickChips.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategory(c)}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs ring-1",
                          category === c
                            ? "bg-slate-900/70 text-slate-100 ring-slate-500"
                            : "bg-slate-900/30 text-slate-200 ring-slate-700 hover:bg-slate-900/50"
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="md:col-span-3">
              <label className="text-xs text-slate-400">Nota (opcional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej: Pago tarjeta, Fondo PC, etc."
                className="mt-1 w-full min-h-[120px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-slate-500"
              />
            </div>
          </div>

          {err && (
            <div className="mt-4 rounded-xl border border-red-700 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {err}
            </div>
          )}
          {ok && (
            <div className="mt-4 rounded-xl border border-emerald-700 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
              {ok}
            </div>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => router.push("/movimientos")}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => submit("keepCreating")}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800 disabled:opacity-60"
              title="Guarda y deja el formulario listo para cargar otro"
            >
              {saving ? "Guardando..." : "Guardar y crear otro"}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => submit("goBack")}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60",
                type === "INCOME" && "bg-emerald-600 hover:bg-emerald-500",
                type === "EXPENSE" && "bg-blue-600 hover:bg-blue-500",
                type === "TRANSFER" && "bg-sky-600 hover:bg-sky-500"
              )}
            >
              {saving ? "Guardando..." : type === "EXPENSE" ? "Guardar gasto" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
