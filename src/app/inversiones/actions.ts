// src/app/inversiones/actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";

export type InvestmentPosition = {
  id: string;
  symbol: string;
  name: string;
  asset_class: string;
  quantity: number;
  avg_buy_price: number;
  currency: string;
};

export type PortfolioPoint = {
  date: string; // "2025-11-20"
  total_value: number;
};

export type AllocationSlice = {
  asset_class: string; // "acciones", "etfs", etc.
  value: number;
};

export type InvestmentsSnapshot = {
  positions: InvestmentPosition[];
  portfolioHistory: PortfolioPoint[];
  allocation: AllocationSlice[];
  stats: {
    totalCurrent: number;
    totalInvested: number;
    totalPnl: number;
    totalReturnPct: number;
  };
};

export async function getInvestmentsSnapshot(): Promise<InvestmentsSnapshot> {
  // ✅ createClient devuelve una Promise, así que hay que esperarla
  const supabase = await createClient();

  // Intentamos obtener el usuario
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Si hay error o no hay usuario, devolvemos todo en cero para no romper la UI
  if (error || !user) {
    return {
      positions: [],
      portfolioHistory: [],
      allocation: [],
      stats: {
        totalCurrent: 0,
        totalInvested: 0,
        totalPnl: 0,
        totalReturnPct: 0,
      },
    };
  }

  // 🔹 Más adelante acá vas a leer tus tablas reales (investment_transactions, etc.)
  // Por ahora devolvemos todo vacío:
  return {
    positions: [],
    portfolioHistory: [],
    allocation: [],
    stats: {
      totalCurrent: 0,
      totalInvested: 0,
      totalPnl: 0,
      totalReturnPct: 0,
    },
  };
}
