// src/lib/reports/calendar.ts
import { createClient } from "@/lib/supabaseBrowser";
import { MonthlyCalendarResult, DailyFinancialDay } from "./types";

export async function getMonthlyCalendar(
  params: { userId: string; year: number; month: number }
): Promise<MonthlyCalendarResult> {
  const { userId, year, month } = params;

  const supabase = createClient();

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  // 1) Transactions reales (usando occurred_at)
  const { data: txs, error: txError } = await supabase
    .from("transactions")
    .select("occurred_at, type, amount")
    .eq("user_id", userId)
    .gte("occurred_at", startStr)
    .lte("occurred_at", endStr);

  if (txError) throw txError;

  // 2) Investment events reales (si tu tabla tiene estos nombres)
  const { data: events, error: evError } = await supabase
    .from("investment_events")
    .select("date, event_type, total_amount")
    .eq("user_id", userId)
    .gte("date", startStr)
    .lte("date", endStr);

  if (evError) throw evError;

  // 3) Mapa día → datos agregados
  const map = new Map<string, DailyFinancialDay>();

  // Inicializamos días vacíos
  for (let d = 1; d <= endDate.getDate(); d++) {
    const current = new Date(year, month - 1, d);
    const dateStr = current.toISOString().slice(0, 10);

    map.set(dateStr, {
      date: dateStr,
      income: 0,
      expenses: 0,
      net: 0,
      investments: { buys: 0, sells: 0, dividends: 0, interest: 0 },
      isPositive: true,
    });
  }

  // 4) Agregar transacciones
  for (const tx of txs ?? []) {
    const dateStr = tx.occurred_at as string;
    const day = map.get(dateStr);
    if (!day) continue;

    const amount = Number(tx.amount ?? 0);

    if (tx.type === "income") {
      day.income += amount;
    } else if (tx.type === "expense") {
      day.expenses += amount;
    }
  }

  // 5) Agregar eventos de inversión
  for (const ev of events ?? []) {
    const dateStr = ev.date as string;
    const day = map.get(dateStr);
    if (!day) continue;

    const amount = Number(ev.total_amount ?? 0);

    switch (ev.event_type) {
      case "buy":
        day.investments.buys += amount;
        break;
      case "sell":
        day.investments.sells += amount;
        break;
      case "dividend":
        day.investments.dividends += amount;
        break;
      case "interest":
        day.investments.interest += amount;
        break;
    }
  }

  // 6) Recalcular neto del día
  const days: DailyFinancialDay[] = [];
  for (const day of map.values()) {
    day.net = day.income - day.expenses;
    day.isPositive = day.net >= 0;
    days.push(day);
  }

  // 7) Ordenar días
  days.sort((a, b) => (a.date < b.date ? -1 : 1));

  return { year, month, days };
}
