export type InvestmentOp = {
  id: string;
  type: "BUY" | "SELL";
  date: string;   // ISO o algo parseable por Date
  qty: number;
  price: number;  // precio por unidad
  fee?: number | null;
};

export type HistoryPoint = {
  date: string;           // YYYY-MM-DD
  price: number | null;   // close
};

export type ChartPoint = {
  date: string; // YYYY-MM-DD
  price: number | null;

  // Rendimientos con baselines precalculados
  returnPct_entry: number | null;
  returnPct_avg: number | null;

  // Compras agregadas por día
  buyQty: number | null;
  buyAmount: number | null;
  hasBuy: boolean;
};

function toDayKey(input: string | Date) {
  const d = input instanceof Date ? input : new Date(input);
  // Normaliza a día en UTC para que join histórico/compras sea estable
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Baseline "Desde entrada": precio ponderado del primer día de compra.
 */
function computeEntryBaseline(ops: InvestmentOp[]) {
  const buys = ops
    .filter(o => o.type === "BUY" && o.qty > 0 && o.price > 0)
    .map(o => ({ ...o, day: toDayKey(o.date) }))
    .sort((a, b) => a.day.localeCompare(b.day));

  if (buys.length === 0) return { firstBuyDay: null as string | null, entryPrice: null as number | null };

  const firstDay = buys[0].day;
  const sameDay = buys.filter(b => b.day === firstDay);

  const totalQty = sameDay.reduce((acc, b) => acc + b.qty, 0);
  const totalCost = sameDay.reduce((acc, b) => acc + b.qty * b.price, 0);

  const entryPrice = totalQty > 0 ? totalCost / totalQty : null;
  return { firstBuyDay: firstDay, entryPrice };
}

/**
 * Baseline "Promedio": avgCost actual bajo costo promedio móvil (simple).
 * BUY suma costo, SELL reduce costo usando el avgCost vigente al momento del sell.
 */
function computeAvgCostBaseline(ops: InvestmentOp[]) {
  const sorted = [...ops]
    .filter(o => o.qty > 0 && o.price > 0)
    .sort((a, b) => toDayKey(a.date).localeCompare(toDayKey(b.date)));

  let netQty = 0;
  let netCost = 0; // costo total asociado a netQty (incluye fees si querés)

  for (const op of sorted) {
    const fee = op.fee ?? 0;

    if (op.type === "BUY") {
      netCost += op.qty * op.price + fee;
      netQty += op.qty;
    } else {
      // SELL: reduce costo por costo promedio vigente
      if (netQty <= 0) continue;
      const avgCostNow = netCost / netQty;
      const sellQty = Math.min(op.qty, netQty);
      netCost -= sellQty * avgCostNow;
      netQty -= sellQty;
    }
  }

  if (netQty <= 0) return null;
  return netCost / netQty;
}

/**
 * Agrega compras por día: buyQty y buyAmount (monto de compra del día).
 */
function aggregateBuysByDay(ops: InvestmentOp[]) {
  const map = new Map<string, { buyQty: number; buyAmount: number }>();

  for (const op of ops) {
    if (op.type !== "BUY") continue;
    if (op.qty <= 0 || op.price <= 0) continue;

    const day = toDayKey(op.date);
    const fee = op.fee ?? 0;
    const amount = op.qty * op.price + fee;

    const prev = map.get(day) || { buyQty: 0, buyAmount: 0 };
    prev.buyQty += op.qty;
    prev.buyAmount += amount;
    map.set(day, prev);
  }

  return map;
}

/**
 * Construye el chartData unificado (1 fila por día del histórico)
 * con price, retornos y compras agregadas.
 */
export function buildChartData(history: HistoryPoint[], ops: InvestmentOp[]): {
  chartData: ChartPoint[];
  firstBuyDay: string | null;
  entryPrice: number | null;
  avgCost: number | null;
} {
  const { firstBuyDay, entryPrice } = computeEntryBaseline(ops);
  const avgCost = computeAvgCostBaseline(ops);
  const buysByDay = aggregateBuysByDay(ops);

  const chartData: ChartPoint[] = history.map(h => {
    const buyAgg = buysByDay.get(h.date);

    const price = h.price;

    const returnPct_entry =
      price == null || entryPrice == null || firstBuyDay == null
        ? null
        : (h.date < firstBuyDay ? null : ((price / entryPrice - 1) * 100));

    const returnPct_avg =
      price == null || avgCost == null
        ? null
        : ((price / avgCost - 1) * 100);

    const buyQty = buyAgg ? buyAgg.buyQty : null;
    const buyAmount = buyAgg ? buyAgg.buyAmount : null;
    const hasBuy = Boolean(buyAgg && buyAgg.buyQty > 0);

    return {
      date: h.date,
      price,
      returnPct_entry: returnPct_entry == null ? null : round2(returnPct_entry),
      returnPct_avg: returnPct_avg == null ? null : round2(returnPct_avg),
      buyQty: buyQty == null ? null : round2(buyQty),
      buyAmount: buyAmount == null ? null : round2(buyAmount),
      hasBuy,
    };
  });

  return { chartData, firstBuyDay, entryPrice, avgCost };
}
