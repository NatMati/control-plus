// src/lib/reports/types.ts
export type DailyInvestmentSummary = {
  buys: number;
  sells: number;
  dividends: number;
  interest: number;
};

export type DailyFinancialDay = {
  date: string;          // '2025-12-05'
  income: number;
  expenses: number;
  net: number;
  investments: DailyInvestmentSummary;
  isPositive: boolean;
};

export type MonthlyCalendarResult = {
  month: number;         // 1–12
  year: number;
  days: DailyFinancialDay[];
};
