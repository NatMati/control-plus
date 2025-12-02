// src/app/movimientos/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const FIXED_USER_ID = "e68c0a6b-b62a-47ed-9c33-3b591c81fb43";

export type MovementType = "INCOME" | "EXPENSE";

export type CreateMovementInput = {
  date: string;              // "2025-11-27"
  accountId: string;
  type: MovementType;
  category?: string | null;
  amount: number;
  currency: string;
  description?: string | null;
};

export async function createMovementAction(input: CreateMovementInput) {
  const supabase = await createClient();

  const { date, accountId, type, category, amount, currency, description } =
    input;

  const { error } = await supabase.from("movements").insert({
    user_id: FIXED_USER_ID,
    date,
    account_id: accountId,
    type, // "INCOME" o "EXPENSE"
    category: category ?? "",
    amount,
    currency,
    description: description ?? null,
  });

  if (error) {
    console.error("Error al crear movimiento", error);
    throw new Error("No se pudo crear el movimiento");
  }

  // Revalidar las páginas afectadas
  revalidatePath("/movimientos");
  revalidatePath("/reportes/calendario");
}

export async function deleteMovementAction(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("movements").delete().eq("id", id);

  if (error) {
    console.error("Error al eliminar movimiento", error);
    throw new Error("No se pudo eliminar el movimiento");
  }

  revalidatePath("/movimientos");
  revalidatePath("/reportes/calendario");
}
