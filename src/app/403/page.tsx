// src/app/403/page.tsx
export default function ForbiddenPage() {
  return (
    <div className="p-10 text-center">
      <h1 className="text-3xl font-bold mb-4 text-rose-400">
        Acceso restringido
      </h1>
      <p className="text-slate-300">
        No tenés permisos para ver esta sección. Si sos el dueño de la app,
        asegurate de que tu usuario tenga <code>is_admin = true</code> en Supabase.
      </p>
    </div>
  );
}
