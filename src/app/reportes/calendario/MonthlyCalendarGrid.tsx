"use client";

import { type CalendarDaySummary } from "@/lib/reports/getMonthlyCalendarSummary";

export default function MonthlyCalendarGrid({
  days,
}: {
  days: CalendarDaySummary[];
}) {
  if (!days || days.length === 0) {
    return (
      <div className="bg-slate-950/40 border border-slate-800 rounded-xl py-10 flex items-center justify-center text-sm text-slate-500">
        No hay movimientos este mes.
      </div>
    );
  }

  const firstDate = new Date(days[0].day);
  const firstWeekDay = (firstDate.getDay() + 6) % 7; // Ajuste para que Lunes sea 0
  const placeholders = Array.from({ length: firstWeekDay });

  return (
    <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 mt-4">
      {/* Encabezado de días */}
      <div className="grid grid-cols-7 gap-2 text-xs mb-2 text-slate-400">
        <span>Lun</span>
        <span>Mar</span>
        <span>Mié</span>
        <span>Jue</span>
        <span>Vie</span>
        <span>Sáb</span>
        <span>Dom</span>
      </div>

      <div className="grid grid-cols-7 gap-2 text-xs">
        {/* Placeholders del inicio de mes */}
        {placeholders.map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {/* Días del mes */}
        {days.map((day) => {
          const d = new Date(day.day).getDate();
          const income = Number(day.total_income) || 0;
          const expense = Number(day.total_expense) || 0;
          const net = Number(day.net_result) || 0;
          const positive = day.is_positive;
          const hasActivity = income !== 0 || expense !== 0;

          return (
            <div
              key={day.day}
              className={[
                "rounded-lg border px-2 py-1.5 flex flex-col gap-1 min-h-[80px]",
                hasActivity
                  ? positive
                    ? "border-emerald-500/40 bg-emerald-950/40"
                    : "border-rose-500/40 bg-rose-950/40"
                  : "border-slate-800 bg-slate-950/40",
              ].join(" ")}
            >
              {/* Día y etiqueta */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">{d}</span>
                {hasActivity && (
                  <span
                    className={`text-[10px] ${
                      positive ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {positive ? "Positivo" : "Negativo"}
                  </span>
                )}
              </div>

              {/* Contenido */}
              <div className="flex flex-col gap-0.5 text-[10px] text-slate-300">
                {!hasActivity ? (
                  <span className="text-slate-500 italic">
                    Sin movimientos
                  </span>
                ) : (
                  <>
                    <span>Ingresos: {income.toFixed(2)}</span>
                    <span>Gastos: {expense.toFixed(2)}</span>
                    <span
                      className={
                        net >= 0 ? "text-emerald-300" : "text-rose-300"
                      }
                    >
                      Resultado: {net.toFixed(2)}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
