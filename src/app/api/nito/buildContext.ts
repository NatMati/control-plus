// src/lib/nito/buildContext.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function buildNitoContext(
  supabase: SupabaseClient,
  userId: string,
) {
  // Movimientos últimos X meses
  const { data: movements } = await supabase
    .from("movements")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(500);

  // Cuentas
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId);

  // Presupuestos, deudas, inversiones, etc. (lo que ya tengas)
  // ...

  // Podés agregar un pequeño resumen pre-calculado:
  const totalIncome = movements
    ?.filter((m) => m.type === "INCOME")
    .reduce((acc, m) => acc + Number(m.amount), 0) ?? 0;

  const totalExpense = movements
    ?.filter((m) => m.type === "EXPENSE")
    .reduce((acc, m) => acc + Number(m.amount), 0) ?? 0;

  return {
    summary: {
      totalIncome,
      totalExpense,
      net: totalIncome - totalExpense,
    },
    movements,
    accounts,
    // budgets,
    // debts,
    // investments,
  };
}
