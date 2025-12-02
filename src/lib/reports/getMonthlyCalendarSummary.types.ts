// src/lib/reports/getMonthlyCalendarSummary.types.ts

// Este tipo corresponde a la vista v_daily_movements_summary
// NO CAMBIES nombres hasta confirmar qué campos devuelve tu vista.

export type CalendarDaySummary = {
  day: string;              // YYYY-MM-DD
  total_income: number;     // ingresos del día
  total_expense: number;    // gastos del día
  net_result: number;       // income - expense
  is_positive: boolean;     // true si net_result >= 0
};
