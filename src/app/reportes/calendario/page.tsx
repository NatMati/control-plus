import {
  getMonthlyCalendarSummary,
} from "@/lib/reports/getMonthlyCalendarSummary";
import CalendarClientPage from "./page.client";

export default async function CalendarReportsPage(props: any) {
  const searchParams = await props.searchParams;

  const now = new Date();

  const year = searchParams?.year
    ? Number(searchParams.year)
    : now.getFullYear();

  const month = searchParams?.month
    ? Number(searchParams.month)
    : now.getMonth() + 1;

  const days = await getMonthlyCalendarSummary(year, month);

  return <CalendarClientPage year={year} month={month} days={days} />;
}
