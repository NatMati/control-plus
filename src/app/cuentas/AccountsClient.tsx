// src/app/cuentas/AccountsClient.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Plus, X, Pencil, Trash2, Star, MoreHorizontal,
  Building2, Banknote, Wallet, TrendingUp,
} from "lucide-react";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type AccountVM = {
  id: string; name: string; currency: string;
  type: string; role: string;
  balance: number; balance_updated_at: string | null;
  balance_calculated: number; movements_delta: number;
  is_archived?: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

function fmtMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-UY", {
    style: "currency", currency,
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
}

function norm(v: string) { return String(v ?? "").trim().toUpperCase(); }

// ── Constantes visuales ───────────────────────────────────────────────────────

const TYPE_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  BANK:   { label: "Banco",     color: "#38bdf8", bg: "rgba(56,189,248,0.08)",   border: "rgba(56,189,248,0.2)",  icon: Building2  },
  CASH:   { label: "Efectivo",  color: "#34d399", bg: "rgba(52,211,153,0.08)",   border: "rgba(52,211,153,0.2)",  icon: Banknote   },
  WALLET: { label: "Billetera", color: "#fbbf24", bg: "rgba(251,191,36,0.08)",   border: "rgba(251,191,36,0.2)",  icon: Wallet     },
  BROKER: { label: "Broker",    color: "#a78bfa", bg: "rgba(167,139,250,0.08)",  border: "rgba(167,139,250,0.2)", icon: TrendingUp },
};

const ROLE_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  CHECKING:   { label: "Corriente", color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.15)" },
  SAVINGS:    { label: "Ahorro",    color: "#2dd4bf", bg: "rgba(45,212,191,0.08)",  border: "rgba(45,212,191,0.2)"  },
  INVESTMENT: { label: "Inversión", color: "#c084fc", bg: "rgba(192,132,252,0.08)", border: "rgba(192,132,252,0.2)" },
};

const CURRENCY_FLAG: Record<string, string> = {
  UYU: "🇺🇾", USD: "🇺🇸", EUR: "🇪🇺", ARS: "🇦🇷", BRL: "🇧🇷",
};

// Colores para la barra de distribución por moneda
const CURRENCY_COLORS: string[] = ["#0d9488", "#2563eb", "#f59e0b", "#ec4899", "#8b5cf6"];

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, sub, onClose, children }: {
  title: string; sub?: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "linear-gradient(160deg,#07101f,#040c1a)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div>
            <div className="font-bold text-white text-sm">{title}</div>
            {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-slate-500 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10, padding: "8px 12px",
  color: "white", fontSize: 13, outline: "none", width: "100%",
};

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer", appearance: "none" as any };

// ── Componente principal ──────────────────────────────────────────────────────

export default function AccountsClient({ initialAccounts }: { initialAccounts: AccountVM[] }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountVM[]>(initialAccounts ?? []);
  const [q, setQ]               = useState("");
  const [flash, setFlash]       = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingId, setSavingId]     = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // ── Modal crear ──
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName]       = useState("");
  const [newType, setNewType]       = useState("BANK");
  const [newRole, setNewRole]       = useState("CHECKING");
  const [newCurrency, setNewCurrency] = useState("UYU");
  const [newBalance, setNewBalance] = useState("");
  const [creating, setCreating]     = useState(false);

  // ── Modal editar ──
  const [editOpen, setEditOpen]     = useState(false);
  const [editId, setEditId]         = useState<string | null>(null);
  const [editName, setEditName]     = useState("");
  const [editType, setEditType]     = useState("BANK");
  const [editRole, setEditRole]     = useState("CHECKING");
  const [editCurrency, setEditCurrency] = useState("UYU");

  // ── Filtro y stats ────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return accounts;
    return accounts.filter(a =>
      [a.name, a.currency, a.type, a.role].some(v => v.toLowerCase().includes(s))
    );
  }, [accounts, q]);

  const stats = useMemo(() => {
    const byCurrency: Record<string, number> = {};
    for (const a of accounts) {
      byCurrency[a.currency] = (byCurrency[a.currency] ?? 0) + a.balance_calculated;
    }
    const total = Object.values(byCurrency).reduce((s, v) => s + Math.abs(v), 0);
    return { byCurrency, total, count: accounts.length, savings: accounts.filter(a => a.role === "SAVINGS").length };
  }, [accounts]);

  function showFlash(type: "ok" | "err", msg: string) {
    setFlash({ type, msg });
    setTimeout(() => setFlash(null), 3500);
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return showFlash("err", "El nombre no puede estar vacío.");
    setCreating(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, type: norm(newType), role: norm(newRole),
          currency: norm(newCurrency), balance: newBalance !== "" ? Number(newBalance) : 0,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`);
      const created = data?.account;
      if (created) {
        setAccounts(prev => [...prev, {
          id: created.id, name: created.name, currency: created.currency,
          type: created.type, role: created.role ?? "CHECKING",
          balance: created.balance ?? 0, balance_updated_at: created.balance_updated_at ?? null,
          balance_calculated: created.balance ?? 0, movements_delta: 0,
        }]);
      }
      setCreateOpen(false);
      setNewName(""); setNewType("BANK"); setNewRole("CHECKING"); setNewCurrency("UYU"); setNewBalance("");
      showFlash("ok", "Cuenta creada correctamente.");
      router.refresh();
    } catch (e: any) {
      showFlash("err", e?.message ?? "Error inesperado.");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(a: AccountVM) {
    setEditId(a.id); setEditName(a.name);
    setEditType(norm(a.type) || "BANK"); setEditRole(norm(a.role) || "CHECKING");
    setEditCurrency(norm(a.currency) || "UYU"); setEditOpen(true);
    setOpenMenuId(null);
  }

  async function saveEdit() {
    if (!editId) return;
    setSavingId(editId);
    try {
      const res = await fetch(`/api/accounts/${editId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), type: norm(editType), role: norm(editRole), currency: norm(editCurrency) }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`);
      setAccounts(prev => prev.map(a =>
        a.id === editId ? { ...a, name: editName.trim(), type: norm(editType), role: norm(editRole), currency: norm(editCurrency) } : a
      ));
      setEditOpen(false);
      showFlash("ok", "Cuenta actualizada.");
      router.refresh();
    } catch (e: any) {
      showFlash("err", e?.message ?? "Error inesperado.");
    } finally { setSavingId(null); }
  }

  async function toggleSavings(id: string) {
    setSavingId(id); setOpenMenuId(null);
    try {
      const cur = accounts.find(a => a.id === id);
      if (!cur) throw new Error("Cuenta no encontrada.");
      if (norm(cur.role) === "INVESTMENT") throw new Error("Las cuentas de inversión no se pueden marcar como ahorro.");
      const nextRole = norm(cur.role) === "SAVINGS" ? "CHECKING" : "SAVINGS";
      const res = await fetch(`/api/accounts/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`);
      setAccounts(prev => prev.map(a => (a.id === id ? { ...a, role: nextRole } : a)));
      showFlash("ok", nextRole === "SAVINGS" ? "Marcada como ahorro." : "Quitada de ahorro.");
      router.refresh();
    } catch (e: any) {
      showFlash("err", e?.message ?? "Error inesperado.");
    } finally { setSavingId(null); }
  }

  async function onDelete(id: string) {
    if (!window.confirm("¿Eliminar esta cuenta? Se archivará.")) return;
    setDeletingId(id); setOpenMenuId(null);
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`);
      setAccounts(prev => prev.filter(a => a.id !== id));
      showFlash("ok", "Cuenta eliminada.");
      router.refresh();
    } catch (e: any) {
      showFlash("err", e?.message ?? "Error inesperado.");
    } finally { setDeletingId(null); }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-5 md:p-7 space-y-5 max-w-[1200px]">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Cuentas</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {accounts.length} cuenta{accounts.length !== 1 ? "s" : ""} · saldos calculados desde movimientos
          </p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white self-start sm:self-auto"
          style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)", boxShadow: "0 4px 14px rgba(13,148,136,0.2)" }}>
          <Plus className="w-3.5 h-3.5" /> Nueva cuenta
        </button>
      </div>

      {/* ── Flash ──────────────────────────────────────────────────────── */}
      {flash && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-medium"
          style={{
            background: flash.type === "ok" ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
            border: flash.type === "ok" ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(239,68,68,0.2)",
            color: flash.type === "ok" ? "#34d399" : "#f87171",
          }}>
          {flash.type === "ok" ? "✓" : "✕"} {flash.msg}
        </div>
      )}

      {/* ── Stats distribución ─────────────────────────────────────────── */}
      {accounts.length > 0 && (
        <div className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold text-white">Distribución por moneda</div>
            <div className="text-[11px] text-slate-500">{stats.count} cuentas · {stats.savings} de ahorro</div>
          </div>

          {/* Barra apilada */}
          <div className="h-2 rounded-full overflow-hidden flex mb-4"
            style={{ background: "rgba(255,255,255,0.06)" }}>
            {Object.entries(stats.byCurrency).map(([cur, val], i) => {
              const pct = stats.total > 0 ? (Math.abs(val) / stats.total) * 100 : 0;
              return (
                <div key={cur} style={{ width: `${pct}%`, background: CURRENCY_COLORS[i % CURRENCY_COLORS.length] }}
                  title={`${cur}: ${fmtMoney(val, cur)}`} />
              );
            })}
          </div>

          {/* Leyenda */}
          <div className="flex flex-wrap gap-4">
            {Object.entries(stats.byCurrency).map(([cur, val], i) => (
              <div key={cur} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm"
                  style={{ background: CURRENCY_COLORS[i % CURRENCY_COLORS.length] }} />
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span>{CURRENCY_FLAG[cur] ?? "💱"}</span>
                    <span className="font-medium text-white">{cur}</span>
                  </div>
                  <div className="text-[10px] text-slate-600 font-mono">{fmtMoney(val, cur)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Buscador ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar cuenta…"
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs text-slate-200 outline-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
          {q && (
            <button onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        {q && <span className="text-[11px] text-slate-600">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>}
      </div>

      {/* ── Cards de cuentas ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(a => {
          const typeCfg = TYPE_CFG[norm(a.type)] ?? TYPE_CFG.BANK;
          const roleCfg = ROLE_CFG[norm(a.role)] ?? ROLE_CFG.CHECKING;
          const TypeIcon = typeCfg.icon;
          const isPositive = a.balance_calculated >= 0;
          const menuOpen = openMenuId === a.id;

          return (
            <div key={a.id} className="group relative rounded-2xl p-5 flex flex-col gap-4 transition-all"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}>

              {/* Ahorro glow indicator */}
              {norm(a.role) === "SAVINGS" && (
                <div className="absolute top-4 right-12 w-1.5 h-1.5 rounded-full"
                  style={{ background: "#2dd4bf", boxShadow: "0 0 8px rgba(45,212,191,0.6)" }} />
              )}

              {/* Top row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: typeCfg.bg, border: `1px solid ${typeCfg.border}` }}>
                    <TypeIcon className="w-4.5 h-4.5" style={{ color: typeCfg.color, width: 18, height: 18 }} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-white text-sm truncate">{a.name}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ color: typeCfg.color, background: typeCfg.bg, border: `1px solid ${typeCfg.border}` }}>
                        {typeCfg.label}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ color: roleCfg.color, background: roleCfg.bg, border: `1px solid ${roleCfg.border}` }}>
                        {roleCfg.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Menú */}
                <div className="relative shrink-0">
                  <button onClick={() => setOpenMenuId(menuOpen ? null : a.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                      <div className="absolute right-0 top-8 z-20 w-44 rounded-xl overflow-hidden shadow-2xl py-1"
                        style={{ background: "rgba(4,9,24,0.97)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <MenuAction icon={Pencil} label="Editar" onClick={() => openEdit(a)} />
                        {norm(a.role) !== "INVESTMENT" && (
                          <MenuAction
                            icon={Star}
                            label={norm(a.role) === "SAVINGS" ? "Quitar ahorro" : "Marcar ahorro"}
                            onClick={() => toggleSavings(a.id)}
                            disabled={savingId === a.id}
                            accent
                          />
                        )}
                        <div className="mx-2 my-1 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }} />
                        <MenuAction
                          icon={Trash2} label="Eliminar"
                          onClick={() => onDelete(a.id)}
                          disabled={deletingId === a.id}
                          danger
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Saldo */}
              <div>
                <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Saldo actual</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums"
                    style={{ color: isPositive ? "white" : "#f87171" }}>
                    {fmtMoney(a.balance_calculated, a.currency)}
                  </span>
                  <span className="text-xs text-slate-600 font-mono">{CURRENCY_FLAG[a.currency] ?? ""} {a.currency}</span>
                </div>
                {a.movements_delta !== 0 && (
                  <div className="flex items-center gap-1 mt-1.5 text-[11px] font-mono"
                    style={{ color: a.movements_delta > 0 ? "#10b981" : "#f97316" }}>
                    {a.movements_delta > 0 ? "▲" : "▼"} {fmtMoney(Math.abs(a.movements_delta), a.currency)} en movimientos
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                  {a.balance_updated_at
                    ? <>Actualizado {new Date(a.balance_updated_at).toLocaleDateString("es-UY", { day: "2-digit", month: "short" })}</>
                    : "Sin snapshot previo"
                  }
                </div>
                <button onClick={() => openEdit(a)}
                  className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-teal-400 transition-colors">
                  <Pencil className="w-3 h-3" /> Editar
                </button>
              </div>
            </div>
          );
        })}

        {/* Empty */}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl py-16 text-center"
            style={{ background: "rgba(255,255,255,0.015)", border: "1px dashed rgba(255,255,255,0.07)" }}>
            <div className="text-slate-600 text-sm">
              {q ? "Sin cuentas con ese nombre." : "Todavía no hay cuentas. Creá una."}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          Modal: Crear cuenta
      ══════════════════════════════════════════ */}
      {createOpen && (
        <Modal title="Nueva cuenta" sub="Banco, efectivo, billetera o broker" onClose={() => setCreateOpen(false)}>
          <div className="px-5 py-5 space-y-4">
            <Field label="Nombre *">
              <input value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Ej: Itaú UYU, Efectivo, IBKR…"
                style={inputStyle} autoFocus />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Moneda">
                <select value={newCurrency} onChange={e => setNewCurrency(e.target.value)} style={selectStyle}>
                  <option value="UYU">🇺🇾 UYU</option>
                  <option value="USD">🇺🇸 USD</option>
                  <option value="EUR">🇪🇺 EUR</option>
                  <option value="ARS">🇦🇷 ARS</option>
                  <option value="BRL">🇧🇷 BRL</option>
                </select>
              </Field>
              <Field label="Tipo">
                <select value={newType} onChange={e => setNewType(e.target.value)} style={selectStyle}>
                  <option value="BANK">Banco</option>
                  <option value="CASH">Efectivo</option>
                  <option value="WALLET">Billetera</option>
                  <option value="BROKER">Broker</option>
                </select>
              </Field>
              <Field label="Rol">
                <select value={newRole} onChange={e => setNewRole(e.target.value)} style={selectStyle}>
                  <option value="CHECKING">Corriente</option>
                  <option value="SAVINGS">Ahorro</option>
                  <option value="INVESTMENT">Inversión</option>
                </select>
              </Field>
            </div>
            <Field label="Saldo inicial (opcional)">
              <input type="number" value={newBalance} onChange={e => setNewBalance(e.target.value)}
                placeholder="0" style={{ ...inputStyle, fontFamily: "monospace" }} />
              <p className="text-[10px] text-slate-600 mt-1.5">Ingresá tu saldo actual para partir desde un punto real.</p>
            </Field>
          </div>
          <div className="flex gap-2 px-5 py-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <button onClick={() => setCreateOpen(false)}
              className="flex-1 py-2.5 text-xs rounded-xl text-slate-400 hover:text-white transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
              Cancelar
            </button>
            <button onClick={handleCreate} disabled={creating || !newName.trim()}
              className="flex-1 py-2.5 text-xs rounded-xl font-bold text-white transition-all disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)" }}>
              {creating ? "Creando…" : "Crear cuenta"}
            </button>
          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════
          Modal: Editar cuenta
      ══════════════════════════════════════════ */}
      {editOpen && (
        <Modal title="Editar cuenta" sub="Modificá nombre, tipo, rol o moneda" onClose={() => setEditOpen(false)}>
          <div className="px-5 py-5 space-y-4">
            <Field label="Nombre *">
              <input value={editName} onChange={e => setEditName(e.target.value)} style={inputStyle} autoFocus />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Moneda">
                <select value={editCurrency} onChange={e => setEditCurrency(e.target.value)} style={selectStyle}>
                  <option value="UYU">🇺🇾 UYU</option>
                  <option value="USD">🇺🇸 USD</option>
                  <option value="EUR">🇪🇺 EUR</option>
                  <option value="ARS">🇦🇷 ARS</option>
                  <option value="BRL">🇧🇷 BRL</option>
                </select>
              </Field>
              <Field label="Tipo">
                <select value={editType} onChange={e => setEditType(e.target.value)} style={selectStyle}>
                  <option value="BANK">Banco</option>
                  <option value="CASH">Efectivo</option>
                  <option value="WALLET">Billetera</option>
                  <option value="BROKER">Broker</option>
                </select>
              </Field>
              <Field label="Rol">
                <select value={editRole} onChange={e => setEditRole(e.target.value)} style={selectStyle}>
                  <option value="CHECKING">Corriente</option>
                  <option value="SAVINGS">Ahorro</option>
                  <option value="INVESTMENT">Inversión</option>
                </select>
              </Field>
            </div>
          </div>
          <div className="flex gap-2 px-5 py-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <button onClick={() => setEditOpen(false)}
              className="flex-1 py-2.5 text-xs rounded-xl text-slate-400 hover:text-white transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
              Cancelar
            </button>
            <button onClick={saveEdit} disabled={savingId === editId || !editName.trim()}
              className="flex-1 py-2.5 text-xs rounded-xl font-bold text-white transition-all disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)" }}>
              {savingId === editId ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── MenuAction ────────────────────────────────────────────────────────────────

function MenuAction({ icon: Icon, label, onClick, danger, accent, disabled }: {
  icon: any; label: string; onClick?: () => void;
  danger?: boolean; accent?: boolean; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors disabled:opacity-40"
      style={{ color: danger ? "#f87171" : accent ? "#2dd4bf" : "#94a3b8" }}
      onMouseEnter={e => (e.currentTarget.style.background = danger ? "rgba(239,68,68,0.08)" : accent ? "rgba(45,212,191,0.06)" : "rgba(255,255,255,0.05)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {label}
    </button>
  );
}
