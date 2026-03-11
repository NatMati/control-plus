// src/app/reportes/calendario/page.client.tsx
import MonthYearSelector from "@/components/MonthYearSelector";
import MonthlyCalendarGrid from "./MonthlyCalendarGrid";
import { type CalendarDaySummary } from "@/lib/reports/getMonthlyCalendarSummary";

export default function CalendarClientPage({
  days,
  year,
  month,
  isPremium = false,
}: {
  days: CalendarDaySummary[];
  year: number;
  month: number;
  isPremium?: boolean;
}) {
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendario financiero</h1>
          <p className="text-sm text-slate-400">
            Resumen diario de ingresos y gastos para {month}/{year}.
          </p>
        </div>
        <MonthYearSelector year={year} month={month} />
      </header>

      <MonthlyCalendarGrid
        days={days}
        year={year}
        month={month}
        isPremium={isPremium}
      />
    </div>
  );
}
