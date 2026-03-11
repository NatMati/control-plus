// src/components/OnboardingDetector.tsx
// Componente invisible que detecta automáticamente cuando el usuario
// completa pasos del onboarding basándose en data real de Supabase.
// Debe vivir DENTRO de todos los providers relevantes.
"use client";

import { useEffect, useRef } from "react";
import { useAchievements } from "@/context/AchievementsContext";
import { useAccounts }     from "@/context/AccountsContext";
import { useBudgets }      from "@/context/BudgetsContext";
import { useMovements }    from "@/context/MovementsContext";

export default function OnboardingDetector() {
  const { completeStep, hasCompletedStep, onboarding } = useAchievements();
  const { accounts }  = useAccounts();
  const { budgets }   = useBudgets();
  const { movements } = useMovements();

  // Ref para no re-triggerear en cada render
  const triggered = useRef<Set<string>>(new Set());

  const maybeComplete = async (step: string, condition: boolean) => {
    if (!condition) return;
    if (triggered.current.has(step)) return;
    if (hasCompletedStep(step)) { triggered.current.add(step); return; }
    triggered.current.add(step);
    await completeStep(step);
  };

  // Detectar cuentas
  useEffect(() => {
    if (!onboarding) return;
    maybeComplete("first_account", accounts.length > 0);
  }, [accounts, onboarding]);

  // Detectar movimientos
  useEffect(() => {
    if (!onboarding) return;
    maybeComplete("first_movement", movements.length > 0);
  }, [movements, onboarding]);

  // Detectar presupuestos
  useEffect(() => {
    if (!onboarding) return;
    maybeComplete("first_budget", budgets.length > 0);
  }, [budgets, onboarding]);

  return null; // componente invisible
}
