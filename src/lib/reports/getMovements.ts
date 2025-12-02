// src/lib/reports/getMovements.ts
import { createClient } from "@/lib/supabase/server";

export type MovementRow = {
  id: string;
  user_id: string;
  date: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  category: string | null;
  account_id: string | null;
  amount: number;
  currency: string;
  description: string | null;
};

export type UIMovement = {
  id: string;
  date: string; // "YYYY-MM-DD"
  type: "INGRESO" | "GASTO" | "TRANSFER";
  category: string | null;
  accountId: string | null;
  amount: number;
  currency: string;
  note: string | null;
};

function mapTypeToUI(type: MovementRow["type"]): UIMovement["type"] {
  if (type === "INCOME") return "INGRESO";
  if (type === "EXPENSE") return "GASTO";
  return "TRANSFER";
}

export async function getMovementsForUser(userId: string): Promise<UIMovement[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("movements")
    .select(
      `
      id,
      user_id,
      date,
      type,
      category,
      account_id,
      amount,
      currency,
      description
    `
    )
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error cargando movimientos:", error);
    throw error;
  }

  const rows = (data ?? []) as MovementRow[];

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    type: mapTypeToUI(row.type),
    category: row.category,
    accountId: row.account_id,
    amount: Number(row.amount),
    currency: row.currency,
    note: row.description,
  }));
}
