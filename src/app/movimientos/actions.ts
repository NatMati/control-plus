// src/app/movimientos/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type MovementDbType = "INCOME" | "EXPENSE" | "TRANSFER";

export type CreateMovementInput = {
  date: string; // "YYYY-MM-DD"
  type: Exclude<MovementDbType, "TRANSFER">;
  accountId: string;
  amount: number;
  currency: string;
  category?: string | null;
  description?: string | null;
};

export type CreateTransferInput = {
  date: string; // "YYYY-MM-DD"
  fromAccountId: string;
  toAccountId: string;
  amount: number; // positivo
  currency: string;
  description?: string | null;
  category?: string | null; // opcional, por si querés etiquetar transferencias
};

function assertPositiveAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Monto inválido.");
  }
}

export async function createMovementAction(input: CreateMovementInput) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) throw new Error("No autenticado.");

  assertPositiveAmount(input.amount);
  if (!input.date) throw new Error("Fecha requerida.");
  if (!input.accountId) throw new Error("Seleccioná una cuenta.");

  const { error } = await supabase.from("movements").insert({
    user_id: user.id,
    date: input.date,
    account_id: input.accountId,
    type: input.type, // INCOME | EXPENSE
    category: (input.category ?? "").trim(),
    amount: input.amount,
    currency: input.currency,
    description: input.description ?? null,
  });

  if (error) {
    console.error("Error al crear movimiento", error);
    throw new Error(error.message || "No se pudo crear el movimiento");
  }

  revalidatePath("/movimientos");
  revalidatePath("/movimientos/detalles");
  revalidatePath("/reportes/calendario");
}

export async function createTransferAction(input: CreateTransferInput) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) throw new Error("No autenticado.");

  assertPositiveAmount(input.amount);
  if (!input.date) throw new Error("Fecha requerida.");
  if (!input.fromAccountId || !input.toAccountId) throw new Error("Seleccioná origen y destino.");
  if (input.fromAccountId === input.toAccountId) throw new Error("Origen y destino deben ser distintos.");

  // Dos inserts: salida (negativa) + entrada (positiva).
  // Si en el futuro agregás transfer_group_id, lo sumamos acá sin romper nada.
  const rows = [
    {
      user_id: user.id,
      date: input.date,
      account_id: input.fromAccountId,
      type: "TRANSFER" as const,
      category: (input.category ?? "").trim(),
      amount: -Math.abs(input.amount),
      currency: input.currency,
      description: input.description ?? null,
    },
    {
      user_id: user.id,
      date: input.date,
      account_id: input.toAccountId,
      type: "TRANSFER" as const,
      category: (input.category ?? "").trim(),
      amount: Math.abs(input.amount),
      currency: input.currency,
      description: input.description ?? null,
    },
  ];

  const { error } = await supabase.from("movements").insert(rows);

  if (error) {
    console.error("Error al crear transferencia", error);
    throw new Error(error.message || "No se pudo crear la transferencia");
  }

  revalidatePath("/movimientos");
  revalidatePath("/movimientos/detalles");
  revalidatePath("/reportes/calendario");
}

export async function deleteMovementAction(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) throw new Error("No autenticado.");

  const { error } = await supabase
    .from("movements")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error al eliminar movimiento", error);
    throw new Error(error.message || "No se pudo eliminar el movimiento");
  }

  revalidatePath("/movimientos");
  revalidatePath("/movimientos/detalles");
  revalidatePath("/reportes/calendario");
}
