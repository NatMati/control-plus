// src/app/reportes/cashflow/page.tsx
import CashflowPageClient from "./page.client";
import { createClient } from "@/utils/supabase/server";

type RawSearchParams = {
  from?: string; // "YYYY-MM"
  to?: string;   // "YYYY-MM"
};

type MovementRow = {
  id: string;
  date: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  category: string | null;
};

type CashflowSankeyNode = {
  id: string;
  name: string;
  type?: string;
};

type CashflowSankeyLink = {
  source: string;
  target: string;
  value: number;
};

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

// Construye los nodos y links del sankey a partir de los movimientos
function buildSankey(
  movements: MovementRow[]
): { nodes: CashflowSankeyNode[]; links: CashflowSankeyLink[] } {
  const nodesMap = new Map<string, CashflowSankeyNode>();
  const linksMap = new Map<string, number>(); // key: "source->target"

  const ensureNode = (id: string, name: string, type?: string) => {
    if (!nodesMap.has(id)) {
      nodesMap.set(id, { id, name, type });
    }
  };

  // Nodos raíz
  ensureNode("income_root", "Ingresos", "income");
  ensureNode("expense_root", "Gastos", "expense");

  for (const m of movements) {
    const rawCat =
      m.category && m.category.trim() !== "" ? m.category : "Sin categoría";
    const catId = `cat_${rawCat}`;
    ensureNode(catId, rawCat, "category");

    const value = Math.abs(Number(m.amount) || 0);
    if (!value) continue;

    if (m.type === "INCOME") {
      const key = `income_root->${catId}`;
      linksMap.set(key, (linksMap.get(key) ?? 0) + value);
    } else if (m.type === "EXPENSE") {
      const key = `${catId}->expense_root`;
      linksMap.set(key, (linksMap.get(key) ?? 0) + value);
    }
  }

  const links: CashflowSankeyLink[] = [];
  for (const [key, value] of linksMap.entries()) {
    const [source, target] = key.split("->");
    links.push({ source, target, value });
  }

  return {
    nodes: Array.from(nodesMap.values()),
    links,
  };
}

export default async function CashflowPage({
  searchParams,
}: {
  searchParams: RawSearchParams;
}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // from / to en formato "YYYY-MM"
  const fromParam =
    searchParams.from ?? `${currentYear}-${pad2(currentMonth)}`;
  const toParam =
    searchParams.to ?? `${currentYear}-${pad2(currentMonth)}`;

  const [fromYear, fromMonth] = fromParam.split("-").map(Number);
  const [toYear, toMonth] = toParam.split("-").map(Number);

  // rango de fechas (primer día del from, último día del to)
  const fromDate = new Date(fromYear, fromMonth - 1, 1);
  const toDate = new Date(toYear, toMonth, 0);

  const fromStr = fromDate.toISOString().slice(0, 10);
  const toStr = toDate.toISOString().slice(0, 10);

  // 👇 AHORA SÍ: una sola declaración y con await
  const supabase = await createClient();

  const { data: movements, error } = await supabase
    .from("movements")
    .select("id, date, type, amount, category")
    .gte("date", fromStr)
    .lte("date", toStr)
    .order("date", { ascending: true });

  let nodes: CashflowSankeyNode[] = [];
  let links: CashflowSankeyLink[] = [];
  let debugInfo = "";

  if (error) {
    debugInfo = `Error Supabase: ${error.message}`;
  } else if (movements) {
    const sankey = buildSankey(movements as MovementRow[]);
    nodes = sankey.nodes;
    links = sankey.links;
    debugInfo = `Rango: ${fromStr} → ${toStr} | filas: ${
      movements.length
    } | nodos: ${nodes.length} | links: ${links.length}`;
  }

  return (
    <CashflowPageClient
      fromYear={fromYear}
      fromMonth={fromMonth}
      toYear={toYear}
      toMonth={toMonth}
      initialNodes={nodes}
      initialLinks={links}
      initialDebugInfo={debugInfo}
    />
  );
}
