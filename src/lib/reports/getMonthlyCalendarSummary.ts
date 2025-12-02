// src/lib/reports/getMonthlyCalendarSummary.ts
"use server";

import { createClient } from "@/lib/supabase/server";

export type CalendarDaySummary = {
  day: string;          // fecha (YYYY-MM-DD)
  total_income: number;
  total_expense: number;
  net_result: number;
  is_positive: boolean;
};

const FIXED_USER_ID = "e68c0a6b-b62a-47ed-9c33-3b591c81fb43";

export async function getMonthlyCalendarSummary(
  year: number,
  month: number
): Promise<CalendarDaySummary[]> {
  const supabase = await createClient();

  const monthStr = String(month).padStart(2, "0");
  const startDate = `${year}-${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("v_daily_movements_summary")
    .select("day,total_income,total_expense,net_result,is_positive")
    .eq("user_id", FIXED_USER_ID)          // 👈 filtro por usuario
    .gte("day", startDate)
    .lte("day", endDate)
    .order("day", { ascending: true });

  if (error) {
    console.error("Error loading monthly calendar:", error);
    // devolvemos el mes vacío para no romper la página
    return buildEmptyMonth(year, month);
  }

  // Indexamos por fecha para poder rellenar todos los días
  const byDay = new Map<string, CalendarDaySummary>();
  (data ?? []).forEach((row) => {
    const dayStr = row.day as string;
    byDay.set(dayStr, {
      day: dayStr,
      total_income: Number(row.total_income ?? 0),
      total_expense: Number(row.total_expense ?? 0),
      net_result: Number(row.net_result ?? 0),
      is_positive: Boolean(row.is_positive),
    });
  });

  const result: CalendarDaySummary[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const dayStr = `${year}-${monthStr}-${String(d).padStart(2, "0")}`;

    if (byDay.has(dayStr)) {
      result.push(byDay.get(dayStr)!);
    } else {
      result.push({
        day: dayStr,
        total_income: 0,
        total_expense: 0,
        net_result: 0,
        is_positive: true,
      });
    }
  }

  return result;
}

function buildEmptyMonth(year: number, month: number): CalendarDaySummary[] {
  const monthStr = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();

  const days: CalendarDaySummary[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const dayStr = `${year}-${monthStr}-${String(d).padStart(2, "0")}`;
    days.push({
      day: dayStr,
      total_income: 0,
      total_expense: 0,
      net_result: 0,
      is_positive: true,
    });
  }
  return days;
}
