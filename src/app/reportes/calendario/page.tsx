// src/app/reportes/calendario/page.tsx
import { getMonthlyCalendarSummary } from "@/lib/reports/getMonthlyCalendarSummary";
import CalendarClientPage from "./page.client";
import { createClient } from "@/lib/supabase/server";

type CalendarSearchParams = {
  month?: string;
  year?: string;
};

export default async function CalendarReportsPage({
  searchParams,
}: {
  searchParams: Promise<CalendarSearchParams>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  // Plan del usuario — ajustá el campo según tu tabla de profiles
  let isPremium = false;
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .single();
    isPremium = profile?.plan === "DELUXE" || profile?.plan === "PREMIUM";
  }

  const now = new Date();
  const year  = sp.year  ? Number(sp.year)  : now.getFullYear();
  const month = sp.month ? Number(sp.month) : now.getMonth() + 1;

  const days = await getMonthlyCalendarSummary(year, month, userId);

  return (
    <CalendarClientPage
      year={year}
      month={month}
      days={days}
      isPremium={isPremium}
    />
  );
}
