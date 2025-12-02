export default function AdminPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-3xl font-bold mb-2">Panel de administración</h1>
      <p className="text-slate-400 max-w-2xl text-sm">
        Esta sección es solo para administradores. Acá vas a ver métricas
        generales de usuarios, planes y actividad del sistema.
      </p>

      <div className="grid gap-3 mt-4">
        <a
          href="/admin/metrics"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-sm text-white"
        >
          Ver métricas de clientes →
        </a>
      </div>
    </div>
  );
}
