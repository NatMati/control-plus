"use client";

import { months } from "@/lib/constants/months";

export default function MonthYearSelector({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const currentYear = new Date().getFullYear();

  const prevMonth = month === 1 ? 12 : month - 1;
  const nextMonth = month === 12 ? 1 : month + 1;

  const prevYear = month === 1 ? year - 1 : year;
  const nextYear = month === 12 ? year + 1 : year;

  const years = Array.from({ length: 12 }, (_, i) => currentYear - 6 + i);

  return (
    <div className="flex items-center gap-3 text-sm">

      {/* Flecha izquierda */}
      <a
        href={`/reportes/calendario?month=${prevMonth}&year=${prevYear}`}
        className="px-2 py-1 border rounded-lg hover:bg-slate-800"
      >
        ←
      </a>

      {/* Select de mes */}
      <select
        value={month}
        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
        onChange={(e) => {
          const newMonth = Number(e.target.value);
          window.location.href = `/reportes/calendario?month=${newMonth}&year=${year}`;
        }}
      >
        {months.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label.charAt(0).toUpperCase() + m.label.slice(1)}
          </option>
        ))}
      </select>

      {/* Select de año */}
      <select
        value={year}
        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
        onChange={(e) => {
          const newYear = Number(e.target.value);
          window.location.href = `/reportes/calendario?month=${month}&year=${newYear}`;
        }}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      {/* Flecha derecha */}
      <a
        href={`/reportes/calendario?month=${nextMonth}&year=${nextYear}`}
        className="px-2 py-1 border rounded-lg hover:bg-slate-800"
      >
        →
      </a>

    </div>
  );
}
