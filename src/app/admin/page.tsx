"use client";

import React from "react";
import useSWR from "swr";

type Metrics = {
  totalUsers: number;
  freeUsers: number;
  proActiveUsers: number;
  proExpiredUsers: number;
  lifetimeUsers: number;
  paidThisMonth: number;
  unpaidThisMonth: number;
  currency: string;
};

type ApiError = {
  message: string;
  status?: number;
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const parts: string[] = [];
    if ((data as any)?.error) parts.push((data as any).error);
    if ((data as any)?.detail) parts.push(String((data as any).detail));

    const err: ApiError = {
      message: parts.join(" | ") || `Error HTTP ${res.status}`,
      status: res.status,
    };
    throw err;
  }

  return data as Metrics;
};

function AdminContent() {
  const { data, error, isLoading } = useSWR<Metrics, ApiError>(
    "/api/admin/metrics",
    fetcher
  );

  if (isLoading) {
    return <div className="p-6 text-slate-400">Cargando métricas...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-400">Error cargando métricas.</p>
        <p className="text-xs text-slate-500 mt-2">
          Detalle: {error.message}{" "}
          {error.status && `(HTTP ${error.status})`}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-slate-400">
        No se recibieron datos de métricas.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Panel de administración</h1>
        <p className="text-sm text-slate-400 max-w-2xl">
          Métricas internas de tus usuarios y planes.
        </p>
      </header>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Usuarios totales" value={data.totalUsers} />
        <Card title="Usuarios Free" value={data.freeUsers} />
        <Card title="Usuarios PRO (activos)" value={data.proActiveUsers} />
      </div>

      {/* Segunda fila */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="PRO vencidos" value={data.proExpiredUsers} />
        <Card title="Usuarios Lifetime" value={data.lifetimeUsers} />
        <Card title="Pagaron este mes" value={data.paidThisMonth} />
      </div>

      {/* Tercera fila */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="No pagaron este mes" value={data.unpaidThisMonth} />
      </div>

      {/* Debug */}
      <pre className="text-xs text-slate-500 mt-6 border border-slate-700 p-3 rounded">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
      <div className="text-xs text-slate-400 mb-1">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

// 👇 Esto es lo que Next espera: un componente React como export default
export default function AdminPage() {
  return <AdminContent />;
}
