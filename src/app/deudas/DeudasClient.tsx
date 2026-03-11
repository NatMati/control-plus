// src/app/deudas/DeudasClient.tsx
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSettings } from "@/context/SettingsContext";

type DebtType = "LOAN" | "CREDIT_CARD" | "INFORMAL" | "MORTGAGE";
type DebtStatus = "ACTIVE" | "PAID" | "OVERDUE";

type Debt = {
  id: string;
  name: string;
  type: DebtType;
  status: DebtStatus;
  currency: string;
  total_amount: number;
  remaining_amount: number;
  monthly_payment: number | null;
  interest_rate: number | null;
  first_due_date: string;
  next_due_date: string | null;
  end_date: string | null;
  account_id: string | null;
  creditor: string | null;
  note: string | null;
  created_at: string;
};

type Account = { id: string; name: string; currency: string };
type Props = { initialDebts: Debt[]; accounts: Account[] };

const TYPE_META: Record<DebtType, {
  label: string; icon: string;
  gradient: string; accent: string; ring: string;
  cardGlow: string; barColor: string;
}> = {
  LOAN:        { label: "Préstamo",       icon: "🏦", gradient: "from-blue-600/25 to-blue-950/20",    accent: "text-blue-300",   ring: "ring-blue-500/25",   cardGlow: "hover:shadow-blue-500/10",   barColor: "#3b82f6" },
  CREDIT_CARD: { label: "Tarjeta",        icon: "💳", gradient: "from-violet-600/25 to-violet-950/20", accent: "text-violet-300", ring: "ring-violet-500/25", cardGlow: "hover:shadow-violet-500/10", barColor: "#8b5cf6" },
  INFORMAL:    { label: "Deuda informal", icon: "🤝", gradient: "from-amber-600/25 to-amber-950/20",   accent: "text-amber-300",  ring: "ring-amber-500/25",  cardGlow: "hover:shadow-amber-500/10",  barColor: "#f59e0b" },
  MORTGAGE:    { label: "Hipoteca",       icon: "🏠", gradient: "from-teal-600/25 to-teal-950/20",     accent: "text-teal-300",   ring: "ring-teal-500/25",   cardGlow: "hover:shadow-teal-500/10",   barColor: "#14b8a6" },
};

const STATUS_META: Record<DebtStatus, { label: string; color: string; dot: string }> = {
  ACTIVE:  { label: "Activa",  color: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30", dot: "bg-emerald-400" },
  PAID:    { label: "Pagada",  color: "text-slate-400 bg-slate-500/10 border-slate-500/30",       dot: "bg-slate-400" },
  OVERDUE: { label: "Vencida", color: "text-rose-300 bg-rose-500/10 border-rose-500/30",          dot: "bg-rose-400 animate-pulse" },
};

const CURRENCIES = ["UYU", "USD", "EUR", "ARS", "BRL"];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });
}

function pctPaid(remaining: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.round(((total - remaining) / total) * 100));
}

// ─────────────────────────────────────────────────────────────────────────────

export default function DeudasClient({ initialDebts, accounts }: Props) {
  const { convert, format, currency } = useSettings();
  const router = useRouter();

  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  const [showModal, setShowModal] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<DebtStatus | "ALL">("ALL");

  const kpis = useMemo(() => {
    const active = debts.filter(d => d.status !== "PAID");
    const totalDebt = active.reduce((s, d) => s + convert(d.remaining_amount, { from: d.currency as any, to: currency }), 0);
    const now = new Date();
    const thisMonth = active.reduce((s, d) => {
      if (!d.monthly_payment) return s;
      const due = d.next_due_date ? new Date(d.next_due_date + "T00:00:00") : null;
      if (due && due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth())
        return s + convert(d.monthly_payment, { from: d.currency as any, to: currency });
      return s;
    }, 0);
    const totalOriginal = active.reduce((s, d) => s + convert(d.total_amount, { from: d.currency as any, to: currency }), 0);
    const paid = debts.filter(d => d.status === "PAID").length;
    const overdue = debts.filter(d => d.status === "OVERDUE").length;
    const globalPct = totalOriginal > 0 ? Math.round(((totalOriginal - totalDebt) / totalOriginal) * 100) : 0;
    return { totalDebt, thisMonth, paid, overdue, count: active.length, globalPct, totalOriginal };
  }, [debts, convert, currency]);

  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of debts.filter(x => x.status !== "PAID")) {
      const amt = convert(d.remaining_amount, { from: d.currency as any, to: currency });
      map[d.type] = (map[d.type] || 0) + amt;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [debts, convert, currency]);

  const filtered = useMemo(() =>
    filterStatus === "ALL" ? debts : debts.filter(d => d.status === filterStatus),
    [debts, filterStatus]
  );

  async function handleSave(data: Partial<Debt>) {
    setSaving(true); setError(null);
    try {
      if (editingDebt) {
        const res = await fetch(`/api/debts/${editingDebt.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setDebts(prev => prev.map(d => d.id === editingDebt.id ? json.debt : d));
      } else {
        const res = await fetch("/api/debts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setDebts(prev => [json.debt, ...prev]);
      }
      setShowModal(false); setEditingDebt(null); router.refresh();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta deuda?")) return;
    const res = await fetch(`/api/debts/${id}`, { method: "DELETE" });
    if (res.ok) { setDebts(prev => prev.filter(d => d.id !== id)); router.refresh(); }
  }

  async function handleMarkPaid(debt: Debt) {
    const res = await fetch(`/api/debts/${debt.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "PAID", remaining_amount: 0 }) });
    const json = await res.json();
    if (res.ok) setDebts(prev => prev.map(d => d.id === debt.id ? json.debt : d));
  }

  function openNew() { setEditingDebt(null); setError(null); setShowModal(true); }
  function openEdit(d: Debt) { setEditingDebt(d); setError(null); setShowModal(true); }

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deudas</h1>
          <p className="text-sm text-slate-400 mt-0.5">Préstamos, tarjetas, hipotecas y deudas informales.</p>
        </div>
        <button onClick={openNew} className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-5 py-2.5 text-sm font-semibold transition-all shadow-lg shadow-blue-500/20">
          + Registrar deuda
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-[#0f1830] p-5 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-blue-500/5 blur-2xl pointer-events-none" />
          <div className="text-xs uppercase tracking-widest text-slate-500 font-medium">Deuda total activa</div>
          <div className="mt-2 text-3xl font-bold text-white tracking-tight">{format(kpis.totalDebt)}</div>
          <div className="text-xs text-slate-500 mt-1">de {format(kpis.totalOriginal)} original</div>
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Progreso global</span>
              <span className="text-slate-300 font-semibold">{kpis.globalPct}% pagado</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-400 transition-all duration-700" style={{ width: `${kpis.globalPct}%` }} />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {[{ v: kpis.count, l: "Activas", c: "text-white" }, { v: kpis.overdue, l: "Vencidas", c: kpis.overdue > 0 ? "text-rose-400" : "text-white" }, { v: kpis.paid, l: "Pagadas", c: "text-emerald-400" }].map(x => (
              <div key={x.l} className="rounded-xl bg-slate-800/60 px-2 py-2">
                <div className={`text-lg font-bold ${x.c}`}>{x.v}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{x.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-violet-900/20 to-slate-900 p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-violet-500/10 blur-2xl pointer-events-none" />
          <div className="text-xs uppercase tracking-widest text-slate-500 font-medium">Cuotas este mes</div>
          <div className="mt-2 text-2xl font-bold text-violet-300">{format(kpis.thisMonth)}</div>
          <div className="text-xs text-slate-500 mt-1">con vencimiento en {new Date().toLocaleDateString("es-UY", { month: "long" })}</div>
          <div className="mt-4 text-xs text-slate-400">{kpis.thisMonth === 0 ? "✓ Sin cuotas pendientes este mes" : "Asegurate de tener fondos disponibles"}</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0f1830] p-5">
          <div className="text-xs uppercase tracking-widest text-slate-500 font-medium mb-3">Por tipo</div>
          {byType.length === 0 ? <div className="text-xs text-slate-500 mt-2">Sin deudas activas</div> : (
            <div className="space-y-3">
              {byType.map(([type, amt]) => {
                const meta = TYPE_META[type as DebtType];
                const p = kpis.totalDebt > 0 ? Math.round((amt / kpis.totalDebt) * 100) : 0;
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="flex items-center gap-1.5"><span>{meta.icon}</span><span className={meta.accent}>{meta.label}</span></span>
                      <span className="text-slate-300 font-mono">{format(amt)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p}%`, backgroundColor: meta.barColor }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500">Filtrar:</span>
        {(["ALL", "ACTIVE", "OVERDUE", "PAID"] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${filterStatus === s ? "border-blue-500/50 bg-blue-500/10 text-blue-300" : "border-slate-800 text-slate-400 hover:bg-slate-900/60 hover:border-slate-700"}`}>
            {s === "ALL" ? `Todas (${debts.length})` : `${STATUS_META[s].label} (${debts.filter(d => d.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-14 text-center">
          <div className="text-4xl mb-3">📋</div>
          <div className="text-sm text-slate-300 font-medium">No hay deudas registradas</div>
          <div className="text-xs text-slate-500 mt-1 mb-4">Registrá tu primer deuda para empezar a hacer seguimiento</div>
          <button onClick={openNew} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors">+ Registrar primera deuda</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(d => (
            <DebtCard key={d.id} debt={d} accounts={accounts}
              onEdit={() => openEdit(d)} onDelete={() => handleDelete(d.id)} onMarkPaid={() => handleMarkPaid(d)}
              convert={convert} currency={currency} format={format} />
          ))}
        </div>
      )}

      {showModal && (
        <DebtModal debt={editingDebt} accounts={accounts} error={error} saving={saving}
          onSave={handleSave} onClose={() => { setShowModal(false); setEditingDebt(null); setError(null); }} />
      )}
    </div>
  );
}

// ── DebtCard ──────────────────────────────────────────────────────────────────

function DebtCard({ debt, accounts, onEdit, onDelete, onMarkPaid, convert, currency, format }: {
  debt: Debt; accounts: Account[];
  onEdit: () => void; onDelete: () => void; onMarkPaid: () => void;
  convert: any; currency: string; format: any;
}) {
  const meta = TYPE_META[debt.type];
  const statusMeta = STATUS_META[debt.status];
  const paid = pctPaid(debt.remaining_amount, debt.total_amount);
  const isPaid = debt.status === "PAID";
  const account = accounts.find(a => a.id === debt.account_id);

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${meta.gradient} relative overflow-hidden transition-all hover:scale-[1.01] hover:shadow-xl ${meta.cardGlow} ${isPaid ? "opacity-50 border-slate-800/40" : `border-slate-800 ring-1 ${meta.ring}`}`}>
      <div className="absolute top-0 right-0 text-7xl opacity-[0.04] pointer-events-none select-none pr-3 pt-1 leading-none">{meta.icon}</div>
      <div className="p-5 space-y-4 relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 bg-slate-900/60 ring-1 ${meta.ring}`}>{meta.icon}</div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-100 truncate">{debt.name}</div>
              <div className={`text-xs font-medium ${meta.accent}`}>{meta.label}{debt.creditor && ` · ${debt.creditor}`}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
            <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${statusMeta.color}`}>{statusMeta.label}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-black/20 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Saldo pendiente</div>
            <div className="text-lg font-bold text-rose-300 leading-tight">{format(convert(debt.remaining_amount, { from: debt.currency as any, to: currency }))}</div>
            <div className="text-[10px] text-slate-600 mt-0.5">{debt.currency} {debt.remaining_amount.toLocaleString("es-UY", { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="rounded-xl bg-black/20 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Total original</div>
            <div className="text-lg font-semibold text-slate-300 leading-tight">{format(convert(debt.total_amount, { from: debt.currency as any, to: currency }))}</div>
            {debt.monthly_payment && <div className="text-[10px] text-slate-500 mt-0.5">Cuota: {format(convert(debt.monthly_payment, { from: debt.currency as any, to: currency }))}</div>}
          </div>
        </div>

        {!isPaid && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Progreso de pago</span>
              <span className={`font-semibold ${meta.accent}`}>{paid}%</span>
            </div>
            <div className="h-2 rounded-full bg-black/30 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${paid}%`, backgroundColor: meta.barColor }} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
          {debt.next_due_date && <span>📅 Próx. venc: <span className="text-slate-300">{fmtDate(debt.next_due_date)}</span></span>}
          {debt.interest_rate && <span>📈 Tasa: <span className="text-slate-300">{debt.interest_rate}% anual</span></span>}
          {account && <span>🏦 <span className="text-slate-300">{account.name}</span></span>}
          {debt.end_date && <span>🏁 Fin: <span className="text-slate-300">{fmtDate(debt.end_date)}</span></span>}
        </div>

        {debt.note && <div className="text-[11px] text-slate-500 bg-black/20 rounded-lg px-3 py-2 italic">{debt.note}</div>}

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
          {!isPaid && <button onClick={onMarkPaid} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition-colors font-medium">✓ Pagada</button>}
          <button onClick={onEdit} className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors">Editar</button>
          <button onClick={onDelete} className="px-3 py-1.5 text-xs rounded-lg border border-rose-800/40 text-rose-400 hover:bg-rose-950/30 transition-colors">Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ── DebtModal PREMIUM ─────────────────────────────────────────────────────────

function DebtModal({ debt, accounts, error, saving, onSave, onClose }: {
  debt: Debt | null; accounts: Account[];
  error: string | null; saving: boolean;
  onSave: (data: any) => void; onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [step, setStep] = useState(0); // 0 = tipo, 1 = datos
  const [form, setForm] = useState({
    name: debt?.name ?? "",
    type: debt?.type ?? "LOAN" as DebtType,
    currency: debt?.currency ?? "UYU",
    total_amount: debt?.total_amount?.toString() ?? "",
    remaining_amount: debt?.remaining_amount?.toString() ?? "",
    monthly_payment: debt?.monthly_payment?.toString() ?? "",
    interest_rate: debt?.interest_rate?.toString() ?? "",
    first_due_date: debt?.first_due_date ?? today,
    end_date: debt?.end_date ?? "",
    account_id: debt?.account_id ?? "",
    creditor: debt?.creditor ?? "",
    note: debt?.note ?? "",
    status: debt?.status ?? "ACTIVE",
  });

  function set(field: string, value: string) {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === "total_amount" && !debt) next.remaining_amount = value;
      return next;
    });
  }

  const meta = TYPE_META[form.type];

  // Si es edición, saltar directo al paso 1
  const showStep = debt ? 1 : step;

  function handleSubmit() {
    onSave({
      name: form.name.trim(), type: form.type, currency: form.currency,
      total_amount: Number(form.total_amount),
      remaining_amount: Number(form.remaining_amount || form.total_amount),
      monthly_payment: form.monthly_payment ? Number(form.monthly_payment) : null,
      interest_rate: form.interest_rate ? Number(form.interest_rate) : null,
      first_due_date: form.first_due_date || null,
      end_date: form.end_date || null,
      account_id: form.account_id || null,
      creditor: form.creditor.trim() || null,
      note: form.note.trim() || null,
      status: form.status,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border border-slate-700/60 bg-[#06091a] shadow-2xl overflow-hidden">

        {/* Fondo decorativo del header */}
        <div className={`relative bg-gradient-to-br ${meta.gradient} border-b border-white/5 px-6 pt-6 pb-5`}>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: meta.barColor }} />
            <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-10 blur-2xl" style={{ backgroundColor: meta.barColor }} />
          </div>

          <div className="relative flex items-start justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-medium mb-1">
                {debt ? "Editar deuda" : "Nueva deuda"}
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {showStep === 0 ? "¿Qué tipo de deuda?" : (form.name || "Registrar deuda")}
              </h2>
              {showStep === 1 && (
                <div className={`flex items-center gap-1.5 mt-1 text-xs ${meta.accent}`}>
                  <span>{meta.icon}</span>
                  <span>{meta.label}</span>
                  {!debt && <button onClick={() => setStep(0)} className="ml-2 text-slate-500 hover:text-slate-300 underline text-[10px]">cambiar</button>}
                </div>
              )}
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-200 w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors text-lg">✕</button>
          </div>

          {/* Step indicator */}
          {!debt && (
            <div className="relative flex gap-2 mt-4">
              {[0, 1].map(i => (
                <div key={i} className={`h-1 rounded-full flex-1 transition-all duration-300 ${i <= showStep ? "opacity-100" : "opacity-25"}`}
                  style={{ backgroundColor: i <= showStep ? meta.barColor : "#475569" }} />
              ))}
            </div>
          )}
        </div>

        {/* ── PASO 0: elegir tipo ── */}
        {showStep === 0 && (
          <div className="p-6 space-y-3">
            <p className="text-xs text-slate-400 mb-4">Elegí el tipo de deuda para personalizarlo.</p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(TYPE_META) as [DebtType, typeof TYPE_META[DebtType]][]).map(([type, m]) => (
                <button
                  key={type}
                  onClick={() => { set("type", type); setStep(1); }}
                  className={`relative rounded-2xl border p-4 text-left transition-all hover:scale-[1.02] bg-gradient-to-br ${m.gradient} ${form.type === type ? `border-slate-500 ring-2 ${m.ring}` : "border-slate-800 hover:border-slate-700"}`}
                >
                  <div className="absolute top-2 right-3 text-2xl opacity-20 pointer-events-none">{m.icon}</div>
                  <div className="text-2xl mb-2">{m.icon}</div>
                  <div className={`text-xs font-semibold ${m.accent}`}>{m.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── PASO 1: formulario ── */}
        {showStep === 1 && (
          <div className="overflow-y-auto max-h-[65vh]">
            <div className="p-6 space-y-4">
              {error && <div className="rounded-xl border border-rose-700/50 bg-rose-950/20 px-3 py-2.5 text-xs text-rose-300">{error}</div>}

              {/* Nombre */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nombre <span className="text-rose-400">*</span></label>
                <input value={form.name} onChange={e => set("name", e.target.value)}
                  placeholder="Ej: Préstamo auto, Tarjeta VISA..."
                  className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
              </div>

              {/* Acreedor + Moneda */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Acreedor</label>
                  <input value={form.creditor} onChange={e => set("creditor", e.target.value)}
                    placeholder="Banco, persona..."
                    className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Moneda <span className="text-rose-400">*</span></label>
                  <select value={form.currency} onChange={e => set("currency", e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500/50 transition-all">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Montos — bloque visual */}
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 space-y-3">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Montos</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5">Total original <span className="text-rose-400">*</span></label>
                    <input type="number" min="0" step="0.01" value={form.total_amount} onChange={e => set("total_amount", e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5">Saldo pendiente <span className="text-rose-400">*</span></label>
                    <input type="number" min="0" step="0.01" value={form.remaining_amount} onChange={e => set("remaining_amount", e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5">Cuota mensual</label>
                    <input type="number" min="0" step="0.01" value={form.monthly_payment} onChange={e => set("monthly_payment", e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5">Tasa anual %</label>
                    <input type="number" min="0" step="0.01" value={form.interest_rate} onChange={e => set("interest_rate", e.target.value)}
                      placeholder="Ej: 12.5"
                      className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500/50 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Primer vencimiento <span className="text-rose-400">*</span></label>
                  <input type="date" value={form.first_due_date} onChange={e => set("first_due_date", e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Fecha fin estimada</label>
                  <input type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                </div>
              </div>

              {/* Cuenta + Estado */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Cuenta de pago</label>
                  <select value={form.account_id} onChange={e => set("account_id", e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500/50 transition-all">
                    <option value="">Sin cuenta</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                {debt && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Estado</label>
                    <select value={form.status} onChange={e => set("status", e.target.value)}
                      className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500/50 transition-all">
                      <option value="ACTIVE">Activa</option>
                      <option value="PAID">Pagada</option>
                      <option value="OVERDUE">Vencida</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Nota */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nota</label>
                <textarea rows={2} value={form.note} onChange={e => set("note", e.target.value)}
                  placeholder="Condiciones especiales, recordatorios..."
                  className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between gap-3 px-6 py-4 border-t border-slate-800/60 sticky bottom-0 bg-[#06091a]">
              <button onClick={onClose} className="px-4 py-2.5 text-xs rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !form.name || !form.total_amount}
                className="flex-1 py-2.5 text-xs rounded-xl font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
                style={{ backgroundColor: meta.barColor, boxShadow: `0 4px 20px ${meta.barColor}30` }}
              >
                {saving ? "Guardando..." : debt ? "Guardar cambios" : `Registrar ${meta.label}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
