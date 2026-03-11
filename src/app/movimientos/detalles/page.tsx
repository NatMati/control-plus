// src/app/movimientos/detalles/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import MovimientosClient, { type UIMovement } from "../MovimientosClient";
import ImportCsv from "../ImportCsv";

export default async function MovimientosDetallesPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/login");

  const { data, error: movementsError } = await supabase
    .from("movements")
    .select("id, date, type, category, amount, currency, description, account_id")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (movementsError) {
    console.error("Error cargando movimientos", movementsError);
    return <div className="p-6">Error cargando movimientos.</div>;
  }

  const movements: UIMovement[] = (data ?? []).map((m: any) => ({
    id: m.id,
    date: m.date,
    type: m.type === "INCOME" ? "INGRESO" : m.type === "EXPENSE" ? "GASTO" : "TRANSFER",
    category: m.category ?? undefined,
    amount: Number(m.amount ?? 0),
    currency: (m.currency ?? "UYU") as any,
    note: m.description ?? undefined,
    accountId: m.account_id ?? undefined,
  }));

  return (
    <div className="p-6 space-y-4">
      <ImportCsv />
      <MovimientosClient initialMovements={movements} />
    </div>
  );
}
