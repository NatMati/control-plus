// src/lib/reports/getMonthlyCalendar.ts
"use server";

import { createClient } from "@/lib/supabase/server";

export type CalendarDaySummary = {
  user_id: string;
  day: string;
  total_income: number;
  total_expense: number;
  net_result: number;
  is_positive: boolean;
  transactions: {
    id: string;
    type: string;
    amount: number;
    category: string | null;
    description: string | null;
  }[];
};

export async function getMonthlyCalendarSummary(
  userId: string,
  year: number,
  month: number
) {
  const supabase = await createClient();

  const monthStr = String(month).padStart(2, "0");
  const startDate = `${year}-${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("v_daily_movements_summary")
    .select("*")
    .eq("user_id", userId)
    .gte("day", startDate)
    .lte("day", endDate)
    .order("day", { ascending: true });

  if (error) {
    console.error("Error loading monthly calendar:", error);
    return [];
  }

  return (data ?? []) as CalendarDaySummary[];
}
