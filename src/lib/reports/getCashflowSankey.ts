// src/lib/reports/getCashflowSankey.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type CashflowSankeyNodeType = "income" | "account" | "category";

export type CashflowSankeyNode = {
  id: string;   // id interno para el gráfico
  name: string; // etiqueta visible
  type: CashflowSankeyNodeType;
};

export type CashflowSankeyLink = {
  source: string;
  target: string;
  value: number;
};

export type GetCashflowParams = {
  userId: string;
  year: number;
  month: number; // 1–12
};

// Tipos “nuestros” para trabajar con los datos
type MovementRow = {
  type: "INCOME" | "EXPENSE";
  amount: number;
  category: string | null;
  account_id: string | null;
};

type AccountRow = {
  id: string;
  name: string;
};

export async function getCashflowSankey(
  supabase: SupabaseClient,
  { userId, year, month }: GetCashflowParams
): Promise<{ nodes: CashflowSankeyNode[]; links: CashflowSankeyLink[] }> {
  // 1) Rango de fechas del mes
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1); // primer día del mes siguiente

  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  // 2) Movimientos del usuario en ese mes (ingresos + gastos)
  const { data: movementsRaw, error: movementsError } = await supabase
    .from("movements")
    .select("type, amount, category, account_id")
    .eq("user_id", userId)
    .gte("date", startStr)
    .lt("date", endStr)
    .in("type", ["INCOME", "EXPENSE"]);

  if (movementsError) {
    console.error("Error cargando movimientos para cashflow:", movementsError);
    return { nodes: [], links: [] };
  }

  const movements = (movementsRaw ?? []) as MovementRow[];

  if (!movements.length) {
    return { nodes: [], links: [] };
  }

  // 3) Cuentas (para mostrar nombres en el nodo intermedio)
  const { data: accountsRaw, error: accountsError } = await supabase
    .from("accounts")
    .select("id, name")
    .eq("user_id", userId);

  if (accountsError) {
    console.error("Error cargando cuentas:", accountsError);
    return { nodes: [], links: [] };
  }

  const accounts = (accountsRaw ?? []) as AccountRow[];

  const accountById = new Map<string, AccountRow>();
  accounts.forEach((a) => accountById.set(a.id, a));

  // 4) Helpers para nodos y links únicos
  const nodeMap = new Map<string, CashflowSankeyNode>();
  const linkMap = new Map<string, CashflowSankeyLink>();

  const ensureNode = (
    id: string,
    name: string,
    type: CashflowSankeyNodeType
  ) => {
    if (!nodeMap.has(id)) {
      nodeMap.set(id, { id, name, type });
    }
  };

  const addLink = (source: string, target: string, value: number) => {
    const key = `${source}->${target}`;
    const existing = linkMap.get(key);
    if (existing) {
      existing.value += value;
    } else {
      linkMap.set(key, { source, target, value });
    }
  };

  // 5) Construir flujo:
  //    - INCOME:  IncomeCategory  -> Account
  //    - EXPENSE: Account -> Category (gasto / inversión / ahorro, etc.)
  for (const m of movements) {
    const amount = Number(m.amount) || 0;
    if (amount <= 0) continue;

    const rawCategory = (m.category ?? "").trim();
    const categoryName =
      rawCategory || (m.type === "INCOME" ? "Ingresos" : "Gastos");

    // Nodo de cuenta
    const accountId = m.account_id ?? "unknown";
    const account = accountById.get(accountId);
    const accountName = account ? account.name : "Cuenta desconocida";
    const accountNodeId = `account:${accountId}`;
    ensureNode(accountNodeId, accountName, "account");

    if (m.type === "INCOME") {
      // Ingreso → Cuenta
      const incomeNodeId = `income:${categoryName}`;
      ensureNode(incomeNodeId, categoryName, "income");
      addLink(incomeNodeId, accountNodeId, amount);
    } else if (m.type === "EXPENSE") {
      // Cuenta → Categoría (gasto, inversión, ahorro, etc.)
      const categoryNodeId = `category:${categoryName}`;
      ensureNode(categoryNodeId, categoryName, "category");
      addLink(accountNodeId, categoryNodeId, amount);
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    links: Array.from(linkMap.values()),
  };
}
