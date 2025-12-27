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
  // 👇 En tu Next, searchParams viene como Promise
  searchParams: Promise<CalendarSearchParams>;
}) {
  // ✅ Lo resolvemos con await
  const sp = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;

  const now = new Date();

  const year = sp.year ? Number(sp.year) : now.getFullYear();
  const month = sp.month ? Number(sp.month) : now.getMonth() + 1;

  // 👇 Pasamos también el userId al helper
  const days = await getMonthlyCalendarSummary(year, month, userId);

  return <CalendarClientPage year={year} month={month} days={days} />;
}
