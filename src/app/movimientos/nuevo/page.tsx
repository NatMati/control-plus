// src/app/movimientos/nuevo/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MovimientosNuevoClient from "./MovimientosNuevoClient";

type Account = {
  id: string;
  name: string;
  currency: string;
  type: string;
  role: string;
};

export default async function NuevoMovimientoPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  // 1) Traer cuentas
  const { data: accountsData, error: accountsError } = await supabase
    .from("accounts")
    .select("id, name, currency, type, role")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (accountsError) {
    console.error("Error cargando accounts", accountsError);
    return <div className="p-6">Error cargando cuentas.</div>;
  }

  // Normalizamos NULLs -> strings para que el Client no explote con TS
  const accounts: Account[] = (accountsData ?? []).map((a) => ({
    id: a.id,
    name: a.name ?? "Cuenta",
    currency: a.currency ?? "UYU",
    type: a.type ?? "bank",
    role: a.role ?? "default",
  }));

  // 2) Categorías existentes (dedup)
  const { data: catData, error: catError } = await supabase
    .from("movements")
    .select("category")
    .eq("user_id", user.id)
    .not("category", "is", null);

  if (catError) {
    console.warn("No se pudieron cargar categorías (continuo igual)", catError);
  }

  const categories = Array.from(
    new Set(
      (catData ?? [])
        .map((r) => (r.category ?? "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "es"));

  // Si no hay cuentas, igual renderizamos el client (podés manejar empty state ahí)
  return (
    <div className="p-6">
      <MovimientosNuevoClient accounts={accounts} categories={categories} />
    </div>
  );
}
