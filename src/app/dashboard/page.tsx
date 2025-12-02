// src/app/dashboard/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient, { type UIMovement } from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Usuario logueado
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // Traer movimientos del usuario (MISMA TABLA Y CAMPOS QUE EN /movimientos)
  const { data, error: movementsError } = await supabase
    .from("movements") // 👈 si tu tabla se llama distinto, cámbialo aquí
    .select(
      "id, date, type, category, amount, currency, description, account_id"
    )
    .eq("user_id", user.id)
    .order("date", { ascending: true }); // orden ascendente para el gráfico

  if (movementsError) {
    console.error("Error cargando movimientos para dashboard", movementsError);
  }

  const movements: UIMovement[] =
    (data ?? []).map((m) => ({
      id: m.id,
      date: m.date, // "YYYY-MM-DD"
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
    })) ?? [];

  return <DashboardClient initialMovements={movements} />;
}
