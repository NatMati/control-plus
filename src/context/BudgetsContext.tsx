// src/context/BudgetsContext.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
  useEffect,
} from "react";
import type { Currency } from "@/context/SettingsContext";

export type Budget = {
  id: string;
  category: string;
  limit: number;
  currency: Currency;
  month: string; // "YYYY-MM"
  note?: string;
  createdAt: string;
};

type BudgetsContextValue = {
  budgets: Budget[];
  addBudget: (input: {
    category: string;
    limit: number;
    currency: Currency;
    month: string;
    note?: string;
  }) => void;

  deleteBudget: (id: string) => void;

  getBudgetsForMonth: (month: string) => Budget[];

  getBudgetForCategory: (category: string, month: string) => Budget | undefined;

  copyBudgetsFromPreviousMonth: (targetMonth: string) => number;
};

const BudgetsContext = createContext<BudgetsContextValue | undefined>(
  undefined
);

export function BudgetsProvider({ children }: { children: ReactNode }) {
  const [budgets, setBudgets] = useState<Budget[]>([]);

  // -----------------------------
  // 🔹 Cargar desde localStorage
  // -----------------------------
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ctrl_budgets");
      if (saved) {
        setBudgets(JSON.parse(saved));
      }
    } catch {}
  }, []);

  // -----------------------------
  // 🔹 Guardar en localStorage
  // -----------------------------
  useEffect(() => {
    try {
      localStorage.setItem("ctrl_budgets", JSON.stringify(budgets));
    } catch {}
  }, [budgets]);

  // -----------------------------
  // 🔹 Agregar presupuesto
  // -----------------------------
  const addBudget: BudgetsContextValue["addBudget"] = useCallback(
    ({ category, limit, currency, month, note }) => {
      const id = `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const createdAt = new Date().toISOString();

      setBudgets((prev) => [
        ...prev,
        { id, category, limit, currency, month, note, createdAt },
      ]);
    },
    []
  );

  // -----------------------------
  // 🔹 Eliminar
  // -----------------------------
  const deleteBudget = useCallback((id: string) => {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  }, []);

  // -----------------------------
  // 🔹 Obtener presupuestos de mes
  // -----------------------------
  const getBudgetsForMonth = useCallback(
    (month: string) => budgets.filter((b) => b.month === month),
    [budgets]
  );

  // -----------------------------
  // 🔹 Presupuesto de categoría puntual
  // -----------------------------
  const getBudgetForCategory = useCallback(
    (category: string, month: string) =>
      budgets.find(
        (b) =>
          b.month === month &&
          b.category.trim().toLowerCase() === category.trim().toLowerCase()
      ),
    [budgets]
  );

  // -----------------------------
  // 🔹 Copiar presupuestos del mes anterior
  // -----------------------------
  const copyBudgetsFromPreviousMonth = useCallback(
    (targetMonth: string) => {
      const [y, m] = targetMonth.split("-").map(Number);
      const prev = new Date(y, m - 2, 1); // mes anterior
      const prevKey = `${prev.getFullYear()}-${String(
        prev.getMonth() + 1
      ).padStart(2, "0")}`;

      const prevBudgets = budgets.filter((b) => b.month === prevKey);
      if (prevBudgets.length === 0) return 0;

      const current = budgets.filter((b) => b.month === targetMonth);

      let count = 0;

      for (const b of prevBudgets) {
        const exists = current.some(
          (c) =>
            c.category.trim().toLowerCase() ===
            b.category.trim().toLowerCase()
        );

        if (!exists) {
          count++;
          addBudget({
            category: b.category,
            limit: b.limit,
            currency: b.currency,
            month: targetMonth,
            note: b.note,
          });
        }
      }

      return count;
    },
    [budgets, addBudget]
  );

  // -----------------------------
  // 🔹 Valor del contexto
  // -----------------------------
  const value = useMemo(
    () => ({
      budgets,
      addBudget,
      deleteBudget,
      getBudgetsForMonth,
      getBudgetForCategory,
      copyBudgetsFromPreviousMonth,
    }),
    [
      budgets,
      addBudget,
      deleteBudget,
      getBudgetsForMonth,
      getBudgetForCategory,
      copyBudgetsFromPreviousMonth,
    ]
  );

  return (
    <BudgetsContext.Provider value={value}>
      {children}
    </BudgetsContext.Provider>
  );
}

export function useBudgets() {
  const ctx = useContext(BudgetsContext);
  if (!ctx) {
    throw new Error("useBudgets debe usarse dentro de un BudgetsProvider");
  }
  return ctx;
}
