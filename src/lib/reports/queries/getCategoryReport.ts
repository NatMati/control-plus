// src/app/reports/queries/getCategoryReport.ts
"use server";

import { createClient } from "@/lib/supabase/server";

export type CategoryReportRow = {
  categoryId: string | null;
  name: string;
  currentTotal: number;
  prevTotal: number;
  absChange: number;
  pctChange: number | null;
};

export async function getCategoryReport(params: {
  userId: string;
  year: number;
  month: number;
  type: "income" | "expense";
}): Promise<CategoryReportRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_category_report", {
    p_user_id: params.userId,
    p_year: params.year,
    p_month: params.month,
    p_type: params.type,
  });

  if (error) {
    console.error("[getCategoryReport]", error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    categoryId: row.id,
    name: row.name ?? "Sin categoría",
    currentTotal: Number(row.current_total),
    prevTotal: Number(row.prev_total),
    absChange: Number(row.abs_change),
    pctChange: row.pct_change !== null ? Number(row.pct_change) : null,
  }));
}
