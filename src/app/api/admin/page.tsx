"use client";

import { useEffect, useState } from "react";

type Metrics = {
  totalClients: number;
  plansAgg: { plan: string; count: number }[];
  lifetimeCount: number;
  newLast30: number;
};

export default function AdminPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/admin/metrics");
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Error al cargar métricas");
        }
        const data = await res.json();
        setMetrics(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-400">Cargando métricas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-rose-400">
          Error cargando métricas: {error}
        </p>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Panel de administración</h1>
        <p className="text-sm text-slate-400 mt-1">
          Resumen de clientes y planes de Control+.
        </p>
      </div>

      {/* Cards principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card
          title="Clientes totales"
          value={metrics.totalClients.toString()}
        />
        <Card
          title="Clientes nuevos (30 días)"
          value={metrics.newLast30.toString()}
        />
        <Card
          title="Lifetime vendidos"
          value={metrics.lifetimeCount.toString()}
        />
        <Card
          title="Planes registrados"
          value={metrics.plansAgg.length.toString()}
        />
      </div>

      {/* Detalle planes */}
      <div className="rounded-xl border border-slate-800 bg-[#0f1830] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="text-sm font-medium">Clientes por plan</div>
          <div className="text-xs text-slate-500">
            Basado en la tabla <code>user_plans</code>.
          </div>
        </div>

        <div className="grid grid-cols-3 px-4 py-2 text-xs uppercase text-slate-400 border-b border-slate-800">
          <div>Plan</div>
          <div>Cantidad</div>
          <div>Notas</div>
        </div>

        {metrics.plansAgg.map((p) => (
          <div
            key={p.plan}
            className="grid grid-cols-3 px-4 py-2 text-sm border-b border-slate-900/40"
          >
            <div className="capitalize">{p.plan}</div>
            <div>{p.count}</div>
            <div className="text-xs text-slate-500">
              {p.plan === "free" && "Usuarios en plan gratuito"}
              {p.plan === "lifetime" && "Pago único, acceso de por vida"}
              {p.plan === "pro" && "Suscripción PRO activa"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
      <div className="text-xs text-slate-400 mb-2">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
