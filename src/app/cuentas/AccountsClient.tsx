// src/app/cuentas/AccountsClient.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AccountRole = "CHECKING" | "SAVINGS" | "INVESTMENT";
type AccountType = "BANK" | "CASH" | "WALLET" | "BROKER" | "OTHER";

type Account = {
  id: string;
  name: string;
  currency: string;
  type: string;
  role: string;
  balance?: number | null;
  balance_updated_at?: string | null;
  created_at?: string | null;
};

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "sky" | "emerald" | "amber" | "rose";
}) {
  const tones: Record<string, string> = {
    slate: "border-slate-700 bg-slate-900/60 text-slate-200",
    sky: "border-sky-700 bg-sky-950/40 text-sky-200",
    emerald: "border-emerald-700 bg-emerald-950/40 text-emerald-200",
    amber: "border-amber-700 bg-amber-950/40 text-amber-200",
    rose: "border-rose-700 bg-rose-950/40 text-rose-200",
  };

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function mapTypeTone(type: string) {
  const t = (type ?? "").toUpperCase();
  if (t === "BANK") return { label: "Banco", tone: "sky" as const };
  if (t === "CASH") return { label: "Efectivo", tone: "emerald" as const };
  if (t === "WALLET") return { label: "Billetera", tone: "amber" as const };
  if (t === "BROKER") return { label: "Broker", tone: "rose" as const };
  return { label: t || "Otro", tone: "slate" as const };
}

function mapRoleTone(role: string) {
  const r = (role ?? "").toUpperCase();
  if (r === "SAVINGS") return { label: "Ahorro", tone: "emerald" as const };
  if (r === "CHECKING") return { label: "Corriente", tone: "slate" as const };
  if (r === "INVESTMENT") return { label: "Inversión", tone: "sky" as const };
  return { label: r || "—", tone: "slate" as const };
}

function toNumberUY(input: string): number | null {
  const raw = (input ?? "").trim();
  if (!raw) return 0;
  // "2.771,50" -> 2771.50  /  "2771.50" -> 2771.50
  const normalized = raw.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export default function AccountsClient({ initialAccounts }: { initialAccounts: Account[] }) {
  const router = useRouter();

  const [accounts, setAccounts] = useState<Account[]>(initialAccounts ?? []);

  // Mensajes globales
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Modal saldos
  const [openBalances, setOpenBalances] = useState(false);
  const [savingBalances, setSavingBalances] = useState(false);

  const balancesDraftInit = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of accounts) map[a.id] = String(a.balance ?? 0);
    return map;
  }, [accounts]);

  const [balancesDraft, setBalancesDraft] = useState<Record<string, string>>(balancesDraftInit);

  const openBalancesModal = () => {
    setErr(null);
    setOk(null);
    const map: Record<string, string> = {};
    for (const a of accounts) map[a.id] = String(a.balance ?? 0);
    setBalancesDraft(map);
    setOpenBalances(true);
  };

  // Modal crear/editar
  const [openUpsert, setOpenUpsert] = useState(false);
  const [upsertMode, setUpsertMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [upserting, setUpserting] = useState(false);

  const [formName, setFormName] = useState("");
  const [formCurrency, setFormCurrency] = useState("UYU");
  const [formType, setFormType] = useState<AccountType>("BANK");
  const [formRole, setFormRole] = useState<AccountRole>("CHECKING");
  const [formBalance, setFormBalance] = useState("0");

  const openCreate = () => {
    setErr(null);
    setOk(null);
    setUpsertMode("create");
    setEditingId(null);
    setFormName("");
    setFormCurrency("UYU");
    setFormType("BANK");
    setFormRole("CHECKING");
    setFormBalance("0");
    setOpenUpsert(true);
  };

  const openEdit = (a: Account) => {
    setErr(null);
    setOk(null);
    setUpsertMode("edit");
    setEditingId(a.id);
    setFormName(a.name ?? "");
    setFormCurrency((a.currency ?? "UYU").toUpperCase());
    setFormType(((a.type ?? "BANK").toUpperCase() as AccountType) ?? "BANK");
    setFormRole(((a.role ?? "CHECKING").toUpperCase() as AccountRole) ?? "CHECKING");
    setFormBalance(String(a.balance ?? 0));
    setOpenUpsert(true);
  };

  const doUpsert = async () => {
    setErr(null);
    setOk(null);
    setUpserting(true);

    try {
      if (!formName.trim()) throw new Error("El nombre de la cuenta es obligatorio.");

      const balanceN = toNumberUY(formBalance);
      if (balanceN === null) throw new Error("Saldo inválido.");

      const payload = {
        name: formName.trim(),
        currency: formCurrency.toUpperCase(),
        type: formType,
        role: formRole,
        balance: balanceN,
      };

      if (upsertMode === "create") {
        const res = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Error creando cuenta.");

        setAccounts((prev) => [...prev, json.account]);
        setOk("Cuenta creada.");
        setOpenUpsert(false);
        router.refresh();
        return;
      }

      // edit
      if (!editingId) throw new Error("ID inválido.");
      const res = await fetch(`/api/accounts/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Error editando cuenta.");

      setAccounts((prev) => prev.map((x) => (x.id === editingId ? { ...x, ...json.account } : x)));
      setOk("Cuenta actualizada.");
      setOpenUpsert(false);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Error inesperado.");
    } finally {
      setUpserting(false);
    }
  };

  const saveBalances = async () => {
    setSavingBalances(true);
    setErr(null);
    setOk(null);

    try {
      for (const a of accounts) {
        const raw = balancesDraft[a.id] ?? "0";
        const value = toNumberUY(raw);
        if (value === null) throw new Error(`Saldo inválido en "${a.name}"`);

        const res = await fetch(`/api/accounts/${a.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ balance: value }),
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `Error guardando "${a.name}"`);

        setAccounts((prev) => prev.map((x) => (x.id === a.id ? { ...x, ...json.account } : x)));
      }

      setOk("Saldos guardados correctamente.");
      router.refresh();
      setTimeout(() => setOpenBalances(false), 300);
    } catch (e: any) {
      setErr(e?.message || "Error inesperado guardando saldos.");
    } finally {
      setSavingBalances(false);
    }
  };

  const toggleSavings = async (a: Account) => {
    setErr(null);
    setOk(null);

    try {
      const current = (a.role ?? "CHECKING").toUpperCase();
      const next: AccountRole = current === "SAVINGS" ? "CHECKING" : "SAVINGS";

      const res = await fetch(`/api/accounts/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Error actualizando rol.");

      setAccounts((prev) => prev.map((x) => (x.id === a.id ? { ...x, ...json.account } : x)));
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Error inesperado.");
    }
  };

  // KPIs
  const total = accounts.length;
  const banks = accounts.filter((a) => (a.type ?? "").toUpperCase() === "BANK").length;
  const cash = accounts.filter((a) => (a.type ?? "").toUpperCase() === "CASH").length;
  const savings = accounts.filter((a) => (a.role ?? "").toUpperCase() === "SAVINGS").length;

  const currencies = Array.from(
    new Set(accounts.map((a) => (a.currency ?? "").toUpperCase()).filter(Boolean))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold mb-1 text-slate-100">Cuentas</h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Administrá tus cuentas (bancos, efectivo, billeteras) y definí cuáles son de ahorro.
            El dashboard se alimenta de estas cuentas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openCreate}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800"
          >
            Crear cuenta
          </button>
          <button
            onClick={openBalancesModal}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
          >
            Cargar saldos
          </button>
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

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
          <div className="text-xs text-slate-500">Cuentas totales</div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">{total}</div>
          <div className="mt-1 text-xs text-slate-500">Bancos, efectivo y billeteras.</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
          <div className="text-xs text-slate-500">Bancos</div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">{banks}</div>
          <div className="mt-1 text-xs text-slate-500">Cuentas bancarias registradas.</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
          <div className="text-xs text-slate-500">Efectivo</div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">{cash}</div>
          <div className="mt-1 text-xs text-slate-500">Billetes / caja / bolsillo.</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
          <div className="text-xs text-slate-500">Marcadas como ahorro</div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">{savings}</div>
          <div className="mt-1 text-xs text-slate-500">Para “Ahorro real” en dashboard.</div>
        </div>
      </div>

      {/* Panel principal */}
      <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
          <div>
            <div className="text-sm font-medium text-slate-100">Cuentas registradas</div>
            <div className="text-xs text-slate-500">
              Monedas detectadas:{" "}
              <span className="text-slate-200 font-medium">
                {currencies.length ? currencies.join(", ") : "—"}
              </span>
              .
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/movimientos"
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800"
            >
              Ir a movimientos
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-slate-950/40">
              <tr className="text-left text-xs text-slate-400">
                <th className="py-2 px-3">Nombre</th>
                <th className="py-2 px-3">Moneda</th>
                <th className="py-2 px-3">Tipo</th>
                <th className="py-2 px-3">Rol</th>
                <th className="py-2 px-3 text-right">Saldo</th>
                <th className="py-2 px-3 text-right">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {accounts.map((a) => {
                const t = mapTypeTone(a.type);
                const r = mapRoleTone(a.role);
                return (
                  <tr key={a.id} className="border-t border-slate-800 hover:bg-slate-950/20">
                    <td className="py-2 px-3 text-slate-200 font-medium">{a.name}</td>
                    <td className="py-2 px-3 text-slate-300">{(a.currency ?? "").toUpperCase()}</td>
                    <td className="py-2 px-3">
                      <Badge tone={t.tone}>{t.label}</Badge>
                    </td>
                    <td className="py-2 px-3">
                      <Badge tone={r.tone}>{r.label}</Badge>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-200">
                      {(a.balance ?? 0).toLocaleString("es-UY", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(a)}
                          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 hover:bg-slate-800"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleSavings(a)}
                          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 hover:bg-slate-800"
                        >
                          {(a.role ?? "").toUpperCase() === "SAVINGS" ? "Quitar ahorro" : "Marcar ahorro"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {accounts.length === 0 && (
                <tr>
                  <td className="py-6 px-3 text-sm text-slate-500" colSpan={6}>
                    No hay cuentas registradas todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-xs text-slate-500 leading-relaxed">
          Consejo: “Importados (sin cuenta)” conviene dejarlo en 0 para que no distorsione el saldo total.
        </div>
      </div>

      {/* Modal saldos */}
      {openBalances && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-[#0b1221] p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-100">Cargar saldos iniciales</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Ingresá el saldo actual real de cada cuenta. Esto alimenta el Dashboard.
                </p>
              </div>
              <button
                onClick={() => setOpenBalances(false)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 space-y-2 max-h-[55vh] overflow-auto pr-1">
              {accounts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-100 truncate">{a.name}</p>
                    <p className="text-xs text-slate-400">
                      {(a.currency ?? "").toUpperCase()} • {(a.type ?? "").toUpperCase()} • {(a.role ?? "").toUpperCase()}
                    </p>
                  </div>

                  <input
                    value={balancesDraft[a.id] ?? "0"}
                    onChange={(e) => setBalancesDraft((prev) => ({ ...prev, [a.id]: e.target.value }))}
                    className="w-44 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none focus:border-slate-500"
                    inputMode="decimal"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setOpenBalances(false)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-100 hover:bg-slate-800"
                disabled={savingBalances}
              >
                Cancelar
              </button>
              <button
                onClick={saveBalances}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
                disabled={savingBalances}
              >
                {savingBalances ? "Guardando..." : "Guardar saldos"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear/editar */}
      {openUpsert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-[#0b1221] p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  {upsertMode === "create" ? "Crear cuenta" : "Editar cuenta"}
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Para broker/liquidez: usá tipo <strong>BROKER</strong> y moneda <strong>USD</strong>.
                </p>
              </div>
              <button
                onClick={() => setOpenUpsert(false)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-slate-400">Nombre</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                  placeholder="Ej: Hapi (USD) / Itaú / Efectivo"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Moneda</label>
                  <select
                    value={formCurrency}
                    onChange={(e) => setFormCurrency(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                  >
                    <option value="UYU">UYU</option>
                    <option value="USD">USD</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400">Tipo</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as AccountType)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                  >
                    <option value="BANK">BANK</option>
                    <option value="CASH">CASH</option>
                    <option value="WALLET">WALLET</option>
                    <option value="BROKER">BROKER</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400">Rol</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as AccountRole)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                  >
                    <option value="CHECKING">CHECKING</option>
                    <option value="SAVINGS">SAVINGS</option>
                    <option value="INVESTMENT">INVESTMENT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Saldo actual</label>
                <input
                  value={formBalance}
                  onChange={(e) => setFormBalance(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
                  inputMode="decimal"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setOpenUpsert(false)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-100 hover:bg-slate-800"
                disabled={upserting}
              >
                Cancelar
              </button>
              <button
                onClick={doUpsert}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
                disabled={upserting}
              >
                {upserting ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
