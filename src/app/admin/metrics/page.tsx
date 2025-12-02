// src/app/admin/metrics/page.tsx
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function AdminMetricsPage() {
  // 🔹 Usuarios totales
  const { data: usersData, error: usersError } =
    await supabaseAdmin.auth.admin.listUsers();

  if (usersError) {
    console.error(usersError);
  }

  const totalUsers = usersData?.users.length ?? 0;

  // 🔹 Planes por tipo
  const { data: planRows, error: planError } = await supabaseAdmin
    .from("user_plans")
    .select("plan");

  let free = 0,
    lifetime = 0,
    pro = 0;

  if (!planError && planRows) {
    for (const row of planRows) {
      if (row.plan === "free") free++;
      else if (row.plan === "lifetime") lifetime++;
      else if (row.plan === "pro") pro++;
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Métricas de clientes</h1>
        <p className="text-sm text-slate-400 max-w-2xl">
          Panel interno solo para vos. Más adelante podemos agregar filtros por
          fechas, ingresos, uso de la app, etc.
        </p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="Usuarios totales" value={totalUsers.toString()} />

        <KpiCard label="Plan Free" value={free.toString()} />
        <KpiCard label="Plan Lifetime" value={lifetime.toString()} />
        <KpiCard label="Plan Pro" value={pro.toString()} />
      </div>

      {/* Tabla simple de usuarios (email + creado) */}
      <div className="rounded-xl border border-slate-800 bg-[#0f1830] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="text-sm font-medium">
            Usuarios registrados recientemente
          </div>
          <div className="text-xs text-slate-500">
            Muestra los usuarios del sistema con datos básicos de alta.
          </div>
        </div>

        {totalUsers === 0 ? (
          <div className="p-6 text-sm text-slate-400">
            Todavía no hay usuarios registrados.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 px-4 py-2 text-xs uppercase tracking-wide text-slate-400 border-b border-slate-800">
              <div>Email</div>
              <div>Creado</div>
              <div>Último acceso</div>
            </div>

            {usersData?.users.map((u) => (
              <div
                key={u.id}
                className="grid grid-cols-3 px-4 py-2 border-b border-slate-900/40 text-sm"
              >
                <div className="truncate text-slate-200">{u.email}</div>
                <div className="text-slate-400 text-xs">
                  {new Date(u.created_at).toLocaleString("es-UY")}
                </div>
                <div className="text-slate-400 text-xs">
                  {u.last_sign_in_at
                    ? new Date(u.last_sign_in_at).toLocaleString("es-UY")
                    : "Nunca"}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="text-2xl font-semibold text-slate-50">{value}</div>
    </div>
  );
}
