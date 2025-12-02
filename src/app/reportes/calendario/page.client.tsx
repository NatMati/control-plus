import MonthYearSelector from "@/components/MonthYearSelector";
import MonthlyCalendarGrid from "./MonthlyCalendarGrid";

export default function CalendarClientPage({
  days,
  year,
  month,
}: {
  days: any[];
  year: number;
  month: number;
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

      <MonthlyCalendarGrid days={days} />
    </div>
  );
}
