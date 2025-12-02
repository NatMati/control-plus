"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type SavingGoal = {
  id: string;
  accountId: string;      // cuenta a la que pertenece la meta
  label: string;          // nombre visible: "PC nueva", "Auto", etc.
  targetAmount: number;   // objetivo total (en moneda de la cuenta)
  currentAmount: number;  // cuánto llevamos asignado
  deadline?: string;      // fecha objetivo (yyyy-mm-dd) opcional
};

export type SavingGoalInput = {
  accountId: string;
  label: string;
  targetAmount: number;
  currentAmount?: number;
  deadline?: string;
};

type GoalsCtx = {
  goals: SavingGoal[];

  // API "nueva"
  addGoal: (input: SavingGoalInput) => void;
  updateGoal: (id: string, patch: Partial<SavingGoal>) => void;
  deleteGoal: (id: string) => void;
  goalsByAccount: (accountId: string) => SavingGoal[];

  // API usada por <AccountGoals />
  getGoalsByAccount: (accountId: string) => SavingGoal[];
  createGoal: (input: SavingGoalInput) => void;
  addToGoalAmount: (id: string, amount: number) => void;
};

const GoalsContext = createContext<GoalsCtx | null>(null);

export function GoalsProvider({ children }: { children: React.ReactNode }) {
  const [goals, setGoals] = useState<SavingGoal[]>([]);

  // ---------- Carga inicial desde localStorage ----------
  useEffect(() => {
    try {
      const raw = localStorage.getItem("ctrl_goals");
      if (!raw) return;

      const parsed = JSON.parse(raw) as any[];

      const normalized: SavingGoal[] = parsed.map((g) => {
        // Soportar formatos viejos (name/target/current) si los hubiera
        const label = g.label ?? g.name ?? "Meta sin nombre";
        const targetAmount =
          typeof g.targetAmount === "number" ? g.targetAmount : g.target ?? 0;

        const currentAmount =
          typeof g.currentAmount === "number"
            ? g.currentAmount
            : typeof g.current === "number"
            ? g.current
            : 0;

        return {
          id: g.id ?? crypto.randomUUID(),
          accountId: g.accountId ?? "",
          label,
          targetAmount,
          currentAmount,
          deadline: g.deadline,
        };
      });

      setGoals(normalized);
    } catch {
      // ignorar errores de parseo
    }
  }, []);

  // ---------- Persistencia ----------
  useEffect(() => {
    try {
      localStorage.setItem("ctrl_goals", JSON.stringify(goals));
    } catch {
      // ignorar
    }
  }, [goals]);

  // ---------- Implementación core ----------

  const addGoal = (input: SavingGoalInput) => {
    setGoals((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        accountId: input.accountId,
        label: input.label,
        targetAmount: input.targetAmount,
        currentAmount: input.currentAmount ?? 0,
        deadline: input.deadline,
      },
    ]);
  };

  const updateGoal = (id: string, patch: Partial<SavingGoal>) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...patch } : g))
    );
  };

  const deleteGoal = (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const goalsByAccount = (accountId: string) =>
    goals.filter((g) => g.accountId === accountId);

  // ---------- Wrappers para compatibilidad con AccountGoals ----------

  const getGoalsByAccount = (accountId: string) => goalsByAccount(accountId);

  const createGoal = (input: SavingGoalInput) => {
    addGoal(input);
  };

  const addToGoalAmount = (id: string, amount: number) => {
    if (!amount) return;
    setGoals((prev) =>
      prev.map((g) =>
        g.id === id
          ? { ...g, currentAmount: g.currentAmount + amount }
          : g
      )
    );
  };

  const value = useMemo<GoalsCtx>(
    () => ({
      goals,
      addGoal,
      updateGoal,
      deleteGoal,
      goalsByAccount,
      getGoalsByAccount,
      createGoal,
      addToGoalAmount,
    }),
    [goals]
  );

  return (
    <GoalsContext.Provider value={value}>
      {children}
    </GoalsContext.Provider>
  );
}

export function useGoals() {
  const ctx = useContext(GoalsContext);
  if (!ctx) {
    throw new Error("useGoals must be used within GoalsProvider");
  }
  return ctx;
}
