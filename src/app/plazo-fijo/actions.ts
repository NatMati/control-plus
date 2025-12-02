// src/app/plazo-fijo/actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";

export type TermDeposit = {
  id: string;
  user_id: string;
  account_id: string;
  currency: string;
  principal: number;
  rate_annual: number;
  start_date: string;
  end_date: string;
  status: "active" | "completed" | "cancelled";
  created_at: string;
};

/**
 * Devuelve los plazos fijos del usuario logueado.
 * Si no hay sesión o hay error, devuelve [] para no romper la UI.
 */
export async function getTermDeposits(): Promise<TermDeposit[]> {
  const supabase = await createClient(); // 👈 CAMBIO

  try {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      return [];
    }

    const userId = data.user.id;

    const { data: deposits, error: depositsError } = await supabase
      .from("term_deposits")
      .select("*")
      .eq("user_id", userId)
      .order("start_date", { ascending: false });

    if (depositsError) {
      console.error("[getTermDeposits] error", depositsError);
      return [];
    }

    return (deposits ?? []) as TermDeposit[];
  } catch (err) {
    console.error("[getTermDeposits] auth error", err);
    return [];
  }
}

/**
 * Crea un nuevo plazo fijo a partir del <form> de /plazo-fijo.
 * Calcula automáticamente la fecha de fin sumando "months" a start_date.
 */
export async function createTermDeposit(formData: FormData): Promise<void> {
  const supabase = await createClient(); // 👈 CAMBIO

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[createTermDeposit] usuario no autenticado", userError);
    throw new Error("Tenés que estar logueado para crear un plazo fijo.");
  }

  const principal = Number(formData.get("principal") ?? 0);
  const rate_annual = Number(formData.get("rate_annual") ?? 0);
  const months = Number(formData.get("months") ?? 0);
  const currency = String(formData.get("currency") ?? "USD");
  const account_id = String(formData.get("account_id") ?? "");

  let start_date =
    (formData.get("start_date") as string | null) ??
    new Date().toISOString().slice(0, 10);

  if (!start_date) {
    start_date = new Date().toISOString().slice(0, 10);
  }

  // Calcular fecha de fin sumando "months" meses
  const start = new Date(start_date);
  const end = new Date(start);
  if (!Number.isNaN(months) && months > 0) {
    end.setMonth(end.getMonth() + months);
  }
  const end_date = end.toISOString().slice(0, 10);

  const { error: insertError } = await supabase.from("term_deposits").insert({
    user_id: user.id,
    account_id,
    currency,
    principal,
    rate_annual,
    start_date,
    end_date,
    status: "active",
  });

  if (insertError) {
    console.error("[createTermDeposit] error al insertar", insertError);
    throw new Error("No se pudo guardar el plazo fijo.");
  }
}

/**
 * Marca un plazo fijo como completado.
 */
export async function completeTermDeposit(id: string): Promise<void> {
  const supabase = await createClient(); // 👈 CAMBIO

  const { error } = await supabase
    .from("term_deposits")
    .update({ status: "completed" })
    .eq("id", id);

  if (error) {
    console.error("[completeTermDeposit] error", error);
    throw new Error("No se pudo marcar el plazo fijo como completado.");
  }
}
