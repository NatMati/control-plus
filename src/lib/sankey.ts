// src/lib/sankey.ts

export type SankeyLink = {
  source: number;
  target: number;
  value: number;
};

export type SankeyData = {
  /** Etiquetas de los nodos, en el mismo orden que los índices usados en los links */
  nodes: string[];
  links: SankeyLink[];
};

export type SankeyMovement = {
  id: string;
  date: string;
  amount: number;
  type: string | null; // INCOME | EXPENSE | TRANSFER (legacy)
  movement_type?: string | null; // INCOME, EXPENSE, INVESTMENT_BUY, LOAN_OUT, etc
  instrument_type?: string | null; // CRYPTO | STOCK | ETF | METAL
  ticker?: string | null;
  category?: string | null;
  description?: string | null;
  counterparty?: string | null;
};

/**
 * Normaliza el tipo de movimiento usando movement_type si existe,
 * y cayendo a type (legacy) si no.
 */
function getKind(m: SankeyMovement): string {
  const mt = (m.movement_type ?? m.type ?? "").toUpperCase();

  if (mt === "INCOME") return "INCOME";
  if (mt === "EXPENSE") return "EXPENSE";
  if (mt === "TRANSFER") return "TRANSFER";
  if (mt === "INVESTMENT_BUY") return "INVESTMENT_BUY";
  if (mt === "INVESTMENT_SELL") return "INVESTMENT_SELL";
  if (mt === "LOAN_OUT") return "LOAN_OUT";
  if (mt === "LOAN_IN") return "LOAN_IN";

  // Heurística suave para datos viejos:
  if (!mt) {
    if (m.amount > 0) return "INCOME";
    if (m.amount < 0) return "EXPENSE";
  }

  return mt || "OTHER";
}

// Mapea el tipo de instrumento a un nombre “lindo” para el nodo
function prettyInstrument(instRaw: string | null | undefined): string {
  const inst = (instRaw ?? "OTRO").toUpperCase();

  switch (inst) {
    case "CRYPTO":
      return "Cripto";
    case "STOCK":
      return "Acciones";
    case "ETF":
      return "ETFs";
    case "METAL":
      return "Metales";
    default:
      return "Otros";
  }
}

// Arma una etiqueta prolija para una inversión concreta
function buildInvestmentLabel(m: SankeyMovement): string {
  const instLabel = prettyInstrument(m.instrument_type);
  const base =
    (m.ticker ||
      m.description ||
      m.category ||
      "Inversión") // fallback amigable
      .toString()
      .trim();

  return `${instLabel}: ${base}`;
}

export function buildCashflowSankey(
  movements: SankeyMovement[]
): SankeyData | null {
  if (!movements || movements.length === 0) {
    return null;
  }

  // --- Helpers de nodos y links ---
  const labels: string[] = [];
  const nodeIndex = new Map<string, number>();

  const addNode = (key: string, label: string): number => {
    if (nodeIndex.has(key)) return nodeIndex.get(key)!;
    const idx = labels.length;
    labels.push(label);
    nodeIndex.set(key, idx);
    return idx;
  };

  const links: SankeyLink[] = [];

  const addLink = (
    sourceKey: string,
    sourceLabel: string,
    targetKey: string,
    targetLabel: string,
    value: number
  ) => {
    if (value <= 0) return;
    const s = addNode(sourceKey, sourceLabel);
    const t = addNode(targetKey, targetLabel);
    links.push({ source: s, target: t, value });
  };

  // --- Nodos raíz ---
  const INCOME_KEY = "root_income";
  const FLOW_KEY = "root_flow";
  const SAVINGS_KEY = "root_savings";
  const INVEST_KEY = "root_investments";
  const LOANS_KEY = "root_loans";
  const EXP_KEY = "root_expenses";

  addNode(INCOME_KEY, "Ingresos");
  addNode(FLOW_KEY, "Flujo de caja");
  addNode(SAVINGS_KEY, "Ahorros");
  addNode(INVEST_KEY, "Inversiones");
  addNode(LOANS_KEY, "Préstamos");
  addNode(EXP_KEY, "Gastos");

  // --- Acumuladores ---
  let totalIncome = 0;
  let totalSavings = 0;
  let totalInvest = 0;
  let totalLoans = 0;

  const expensesByCategory = new Map<string, number>();
  const investByInstrument = new Map<string, number>();
  const loansByCounterparty = new Map<string, number>();

  // --- Clasificación normal ---
  for (const m of movements) {
    const kind = getKind(m);
    const absAmount = Math.abs(m.amount);

    if (absAmount === 0) continue;

    switch (kind) {
      case "INCOME":
        totalIncome += absAmount;
        break;

      case "INVESTMENT_BUY": {
        totalInvest += absAmount;
        const label = buildInvestmentLabel(m);
        investByInstrument.set(
          label,
          (investByInstrument.get(label) ?? 0) + absAmount
        );
        break;
      }

      case "LOAN_OUT": {
        totalLoans += absAmount;
        const who = m.counterparty || m.description || "Préstamo";
        const label = `Préstamo a ${who}`;
        loansByCounterparty.set(
          label,
          (loansByCounterparty.get(label) ?? 0) + absAmount
        );
        break;
      }

      case "EXPENSE": {
        // ¿Parece inversión?
        const isInvestmentLike =
          (m.instrument_type && m.instrument_type !== "") ||
          /invers/i.test(m.category || "") ||
          /etf|cripto|crypto|stock|acción|acciones|metal/i.test(
            (m.description || "") + " " + (m.category || "")
          );

        if (isInvestmentLike) {
          totalInvest += absAmount;
          const label = buildInvestmentLabel(m);
          investByInstrument.set(
            label,
            (investByInstrument.get(label) ?? 0) + absAmount
          );
          break;
        }

        // ¿Parece ahorro?
        const isSavingsLike =
          /ahorro/i.test(m.description || "") ||
          /ahorro/i.test(m.category || "");

        if (isSavingsLike) {
          totalSavings += absAmount;
          break;
        }

        // Gasto normal
        const cat =
          (m.category || "Otros gastos").toString().trim() || "Otros gastos";
        expensesByCategory.set(
          cat,
          (expensesByCategory.get(cat) ?? 0) + absAmount
        );
        break;
      }

      case "TRANSFER":
        // Sólo lo consideramos ahorro si lo dice la descripción/categoría
        if (
          /ahorro/i.test(m.description || "") ||
          /ahorro/i.test(m.category || "")
        ) {
          totalSavings += absAmount;
        }
        break;

      default:
        // Por ahora, otros tipos se ignoran en la clasificación fuerte
        break;
    }
  }

  const totalExpenses = Array.from(expensesByCategory.values()).reduce(
    (acc, v) => acc + v,
    0
  );
  const totalOut = totalSavings + totalInvest + totalLoans + totalExpenses;

  // Fallback total: si no hay nada clasificado, dibujamos algo mínimo
  if (totalIncome <= 0 && totalOut <= 0) {
    let fallbackTotal = 0;
    for (const m of movements) {
      fallbackTotal += Math.abs(m.amount);
    }

    if (fallbackTotal <= 0) {
      return null;
    }

    const FLOW_ONLY = "root_flow_fallback";
    const OTHERS = "root_others_fallback";

    addNode(FLOW_ONLY, "Flujo de caja");
    addNode(OTHERS, "Otros movimientos");

    links.push({
      source: nodeIndex.get(FLOW_ONLY)!,
      target: nodeIndex.get(OTHERS)!,
      value: fallbackTotal,
    });

    return { nodes: labels, links };
  }

  // --- Enlaces de alto nivel ---
  if (totalIncome > 0) {
    addLink(INCOME_KEY, "Ingresos", FLOW_KEY, "Flujo de caja", totalIncome);
  }

  if (totalSavings > 0) {
    addLink(FLOW_KEY, "Flujo de caja", SAVINGS_KEY, "Ahorros", totalSavings);
  }
  if (totalInvest > 0) {
    addLink(FLOW_KEY, "Flujo de caja", INVEST_KEY, "Inversiones", totalInvest);
  }
  if (totalLoans > 0) {
    addLink(FLOW_KEY, "Flujo de caja", LOANS_KEY, "Préstamos", totalLoans);
  }
  if (totalExpenses > 0) {
    addLink(FLOW_KEY, "Flujo de caja", EXP_KEY, "Gastos", totalExpenses);
  }

  // --- Detalle de gastos: ordenados de mayor a menor ---
  const sortedExpenses = Array.from(expensesByCategory.entries()).sort(
    (a, b) => b[1] - a[1]
  );
  for (const [cat, value] of sortedExpenses) {
    const key = `exp_cat_${cat}`;
    addLink(EXP_KEY, "Gastos", key, cat, value);
  }

  // --- Detalle de inversiones: ordenadas ---
  const sortedInvest = Array.from(investByInstrument.entries()).sort(
    (a, b) => b[1] - a[1]
  );
  for (const [label, value] of sortedInvest) {
    const key = `inv_${label}`;
    addLink(INVEST_KEY, "Inversiones", key, label, value);
  }

  // --- Detalle de préstamos: ordenados ---
  const sortedLoans = Array.from(loansByCounterparty.entries()).sort(
    (a, b) => b[1] - a[1]
  );
  for (const [loanLabel, value] of sortedLoans) {
    const key = `loan_${loanLabel}`;
    addLink(LOANS_KEY, "Préstamos", key, loanLabel, value);
  }

  if (links.length === 0) return null;

  return { nodes: labels, links };
}
