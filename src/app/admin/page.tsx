// src/app/admin/page.tsx
"use client";

import React, { useState } from "react";
import useSWR from "swr";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Metrics = {
  totalUsers: number; freeUsers: number; proActiveUsers: number;
  proExpiredUsers: number; lifetimeUsers: number;
  paidThisMonth: number; unpaidThisMonth: number; currency: string;
};

type AccessCode = {
  id: string; code: string; plan: "PRO" | "DELUXE";
  duration_months: number | null; max_uses: number; uses: number;
  expires_at: string | null; created_at: string;
};

type ApiError = { message: string; status?: number };

// ── Fetchers ──────────────────────────────────────────────────────────────────

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: ApiError = { message: (data as any)?.error ?? `Error HTTP ${res.status}`, status: res.status };
    throw err;
  }
  return data;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLAN_META: Record<string, { color: string; bg: string; border: string }> = {
  PRO:    { color: "#60a5fa", bg: "rgba(59,130,246,0.1)",   border: "rgba(59,130,246,0.3)" },
  DELUXE: { color: "#fbbf24", bg: "rgba(245,158,11,0.1)",   border: "rgba(245,158,11,0.3)" },
};

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
      <div className="text-xs text-slate-400 mb-1">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

// ── Sección de códigos ────────────────────────────────────────────────────────

function AccessCodesSection() {
  const { data, error, isLoading, mutate } = useSWR<{ codes: AccessCode[] }, ApiError>(
    "/api/admin/access-codes", fetcher
  );

  const [form, setForm] = useState({
    code: "", plan: "PRO", max_uses: 1, duration_months: "", expires_at: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true); setCreateError(null);
    try {
      const res = await fetch("/api/admin/access-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          plan: form.plan,
          max_uses: Number(form.max_uses),
          duration_months: form.duration_months ? Number(form.duration_months) : null,
          expires_at: form.expires_at || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setCreateError(d.error); return; }
      setForm({ code: "", plan: "PRO", max_uses: 1, duration_months: "", expires_at: "" });
      mutate();
    } catch { setCreateError("Error de conexión."); }
    finally { setCreating(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este código?")) return;
    setDeleting(id);
    try {
      await fetch("/api/admin/access-codes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      mutate();
    } finally { setDeleting(null); }
  }

  const codes = data?.codes ?? [];

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Códigos de acceso</h2>
        <p className="text-xs text-slate-500">Creá y gestioná códigos para dar acceso gratuito a planes.</p>
      </div>

      {/* Formulario crear */}
      <form onSubmit={handleCreate}
        className="rounded-xl border border-slate-800 bg-[#0f1830] p-5 space-y-4">
        <div className="text-sm font-medium text-slate-300">Nuevo código</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Código *</label>
            <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="FOUNDERS10" maxLength={32} required
              className="w-full px-3 py-2 rounded-lg text-sm bg-slate-900 border border-slate-700 text-white outline-none font-mono focus:border-teal-600" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Plan *</label>
            <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm bg-slate-900 border border-slate-700 text-white outline-none focus:border-teal-600">
              <option value="PRO">Pro</option>
              <option value="DELUXE">Deluxe</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Cupos máx *</label>
            <input type="number" min={1} value={form.max_uses}
              onChange={e => setForm(f => ({ ...f, max_uses: Number(e.target.value) }))}
              className="w-full px-3 py-2 rounded-lg text-sm bg-slate-900 border border-slate-700 text-white outline-none focus:border-teal-600" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Duración (meses)</label>
            <input type="number" min={1} value={form.duration_months}
              onChange={e => setForm(f => ({ ...f, duration_months: e.target.value }))}
              placeholder="Vacío = para siempre"
              className="w-full px-3 py-2 rounded-lg text-sm bg-slate-900 border border-slate-700 text-white outline-none focus:border-teal-600" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Vence el</label>
            <input type="date" value={form.expires_at}
              onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm bg-slate-900 border border-slate-700 text-white outline-none focus:border-teal-600" />
          </div>
        </div>
        {createError && <div className="text-xs text-red-400">{createError}</div>}
        <button type="submit" disabled={creating}
          className="px-5 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50 transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)" }}>
          {creating ? "Creando..." : "Crear código"}
        </button>
      </form>

      {/* Tabla de códigos */}
      {isLoading ? (
        <div className="text-slate-500 text-sm">Cargando códigos...</div>
      ) : error ? (
        <div className="text-red-400 text-sm">{error.message}</div>
      ) : codes.length === 0 ? (
        <div className="text-slate-600 text-sm">No hay códigos creados.</div>
      ) : (
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                {["Código", "Plan", "Cupos", "Duración", "Vence", "Creado", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {codes.map(c => {
                const cuposLeft = c.max_uses - c.uses;
                const meta = PLAN_META[c.plan];
                return (
                  <tr key={c.id} className="bg-[#0f1830] hover:bg-slate-900/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-white">{c.code}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}>
                        {c.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-800 max-w-[60px]">
                          <div className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, (c.uses / c.max_uses) * 100)}%`,
                              background: cuposLeft === 0 ? "#ef4444" : cuposLeft <= 2 ? "#f59e0b" : "#10b981",
                            }} />
                        </div>
                        <span className={`text-xs font-medium ${cuposLeft === 0 ? "text-red-400" : cuposLeft <= 2 ? "text-amber-400" : "text-emerald-400"}`}>
                          {c.uses}/{c.max_uses}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {c.duration_months ? `${c.duration_months} meses` : "Para siempre"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {c.expires_at ? new Date(c.expires_at).toLocaleDateString("es-UY") : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {new Date(c.created_at).toLocaleDateString("es-UY")}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id}
                        className="text-xs text-slate-600 hover:text-red-400 transition-colors disabled:opacity-40">
                        {deleting === c.id ? "..." : "Eliminar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Admin page principal ──────────────────────────────────────────────────────

function AdminContent() {
  const { data, error, isLoading } = useSWR<Metrics, ApiError>("/api/admin/metrics", fetcher);

  if (isLoading) return <div className="p-6 text-slate-400">Cargando métricas...</div>;
  if (error) return (
    <div className="p-6">
      <p className="text-red-400">Error cargando métricas.</p>
      <p className="text-xs text-slate-500 mt-2">Detalle: {error.message} {error.status && `(HTTP ${error.status})`}</p>
    </div>
  );
  if (!data) return <div className="p-6 text-slate-400">No se recibieron datos de métricas.</div>;

  return (
    <div className="p-6 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Panel de administración</h1>
        <p className="text-sm text-slate-400 max-w-2xl">Métricas internas de tus usuarios y planes.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Usuarios totales"      value={data.totalUsers} />
        <Card title="Usuarios Free"         value={data.freeUsers} />
        <Card title="Usuarios PRO (activos)" value={data.proActiveUsers} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="PRO vencidos"          value={data.proExpiredUsers} />
        <Card title="Usuarios Lifetime"     value={data.lifetimeUsers} />
        <Card title="Pagaron este mes"      value={data.paidThisMonth} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="No pagaron este mes"   value={data.unpaidThisMonth} />
      </div>

      <div className="border-t border-slate-800 pt-8">
        <AccessCodesSection />
      </div>
    </div>
  );
}

export default function AdminPage() {
  return <AdminContent />;
}
