// src/app/reports/queries/getMonthlyCalendar.ts
"use server";

import { createClient } from "@/lib/supabase/server";

export type CalendarDay = {
  date: string; // '2025-11-03'
  totalIncome: number;
  totalExpense: number;
  net: number;
  investmentEvents: number;
  investmentsNet: number;
  isPositive: boolean;
};

export async function getMonthlyCalendar(params: {
  userId: string;
  year: number;
  month: number; // 1-12
}): Promise<CalendarDay[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_monthly_calendar", {
    p_user_id: params.userId,
    p_year: params.year,
    p_month: params.month,
  });

  if (error) {
    console.error("[getMonthlyCalendar]", error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    date: row.date,
    totalIncome: Number(row.total_income),
    totalExpense: Number(row.total_expense),
    net: Number(row.net),
    investmentEvents: Number(row.investment_events),
    investmentsNet: Number(row.investments_net),
    isPositive: row.is_positive,
  }));
}
