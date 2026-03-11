// src/app/movimientos/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MovimientosDashboardClient, { type UIMovement } from "./MovimientosDashboardClient";

export default async function MovimientosPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/login");

  // Movimientos
  const { data, error: movementsError } = await supabase
    .from("movements")
    .select("id, date, type, category, amount, currency, description, account_id")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (movementsError) {
    console.error("Error cargando movimientos", movementsError);
    return <div className="p-6">Error cargando movimientos.</div>;
  }

  // Cuentas (para el importador)
  const { data: accountsData } = await supabase
    .from("accounts")
    .select("id, name, currency")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .order("created_at", { ascending: true });

  const movements: UIMovement[] = (data ?? []).map((m) => ({
    id: m.id,
    date: m.date,
    type:
      m.type === "INCOME"
        ? "INGRESO"
        : m.type === "EXPENSE"
        ? "GASTO"
        : "TRANSFER",
    category: m.category ?? undefined,
    amount: Number(m.amount ?? 0),
    currency: (m.currency ?? "UYU") as any,
    note: m.description ?? undefined,
    accountId: m.account_id ?? undefined,
  }));

  const accounts = (accountsData ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency,
  }));

  return (
    <MovimientosDashboardClient
      initialMovements={movements}
      accounts={accounts}
    />
  );
}
