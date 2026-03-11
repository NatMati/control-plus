// src/context/AchievementsContext.tsx
"use client";

import {
  createContext, useCallback, useContext,
  useEffect, useRef, useState, type ReactNode,
} from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type AchievementCategory = "onboarding" | "financial" | "social" | "secret";
export type RewardType = "badge" | "feature" | "discount" | null;

export type Achievement = {
  key:          string;
  title:        string;
  description:  string;
  icon:         string;
  category:     AchievementCategory;
  points:       number;
  rewardType:   RewardType;
  rewardValue:  string | null;
  isSecret:     boolean;
};

export type UserAchievement = {
  achievementKey: string;
  unlockedAt:     string;
  notified:       boolean;
};

export type OnboardingProgress = {
  completedSteps: string[];
  tourCompleted:  boolean;
  tourSkipped:    boolean;
  startedAt:      string;
  completedAt:    string | null;
};

// Logros que se muestran como toast al desbloquearse
export type AchievementToast = Achievement & { unlockedAt: string };

type AchievementsCtx = {
  // Catálogo completo
  achievements:      Achievement[];
  // Logros del usuario
  userAchievements:  UserAchievement[];
  // Onboarding
  onboarding:        OnboardingProgress | null;
  // Loading
  loading:           boolean;
  // Toast pendiente de mostrar
  pendingToast:      AchievementToast | null;
  clearToast:        () => void;
  // Acciones
  unlockAchievement: (key: string) => Promise<void>;
  completeStep:      (step: string) => Promise<void>;
  completeTour:      () => Promise<void>;
  skipTour:          () => Promise<void>;
  // Helpers
  hasAchievement:    (key: string) => boolean;
  hasCompletedStep:  (step: string) => boolean;
  totalPoints:       number;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const Ctx = createContext<AchievementsCtx | null>(null);

// ─── Normalizers ─────────────────────────────────────────────────────────────

function normalizeAchievement(row: any): Achievement {
  return {
    key:         row.key,
    title:       row.title,
    description: row.description,
    icon:        row.icon,
    category:    row.category,
    points:      row.points,
    rewardType:  row.reward_type  ?? null,
    rewardValue: row.reward_value ?? null,
    isSecret:    row.is_secret    ?? false,
  };
}

function normalizeUserAchievement(row: any): UserAchievement {
  return {
    achievementKey: row.achievement_key,
    unlockedAt:     row.unlocked_at,
    notified:       row.notified,
  };
}

function normalizeOnboarding(row: any): OnboardingProgress {
  return {
    completedSteps: row.completed_steps ?? [],
    tourCompleted:  row.tour_completed  ?? false,
    tourSkipped:    row.tour_skipped    ?? false,
    startedAt:      row.started_at,
    completedAt:    row.completed_at    ?? null,
  };
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AchievementsProvider({ children }: { children: ReactNode }) {
  const supabase = supabaseBrowser();

  const [userId,           setUserId]           = useState<string | null>(null);
  const [achievements,     setAchievements]     = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [onboarding,       setOnboarding]       = useState<OnboardingProgress | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [pendingToast,     setPendingToast]     = useState<AchievementToast | null>(null);

  // Para detectar logros recién desbloqueados sin loop
  const notifiedRef = useRef<Set<string>>(new Set());

  // ── Cargar usuario ──────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Cargar datos cuando hay usuario ────────────────────────────
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    loadAll(userId);
  }, [userId]);

  const loadAll = async (uid: string) => {
    setLoading(true);
    try {
      // Catálogo de logros
      const { data: achData } = await supabase
        .from("achievements")
        .select("*")
        .order("points", { ascending: false });

      if (achData) setAchievements(achData.map(normalizeAchievement));

      // Logros del usuario
      const { data: userAchData } = await supabase
        .from("user_achievements")
        .select("*")
        .eq("user_id", uid);

      if (userAchData) {
        setUserAchievements(userAchData.map(normalizeUserAchievement));
        // Marcar ya notificados para no mostrarlos de nuevo
        userAchData
          .filter(r => r.notified)
          .forEach(r => notifiedRef.current.add(r.achievement_key));
      }

      // Onboarding — crear si no existe
      const { data: obData } = await supabase
        .from("user_onboarding")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();

      if (obData) {
        setOnboarding(normalizeOnboarding(obData));
      } else {
        // Primera vez — crear registro
        const { data: newOb } = await supabase
          .from("user_onboarding")
          .insert({ user_id: uid })
          .select()
          .single();
        if (newOb) setOnboarding(normalizeOnboarding(newOb));
      }

      // Mostrar toasts de logros no notificados
      if (userAchData && achData) {
        const unnotified = userAchData.filter(r => !r.notified);
        if (unnotified.length > 0) {
          const first = unnotified[0];
          const meta = achData.find(a => a.key === first.achievement_key);
          if (meta && !notifiedRef.current.has(first.achievement_key)) {
            setPendingToast({ ...normalizeAchievement(meta), unlockedAt: first.unlocked_at });
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Desbloquear logro ───────────────────────────────────────────
  const unlockAchievement = useCallback(async (key: string) => {
    if (!userId) return;
    // Ya lo tiene
    if (userAchievements.some(ua => ua.achievementKey === key)) return;

    const { data, error } = await supabase
      .from("user_achievements")
      .insert({ user_id: userId, achievement_key: key, notified: false })
      .select()
      .single();

    if (error || !data) return;

    const newUa = normalizeUserAchievement(data);
    setUserAchievements(prev => [...prev, newUa]);

    // Mostrar toast
    const meta = achievements.find(a => a.key === key);
    if (meta && !notifiedRef.current.has(key)) {
      setPendingToast({ ...meta, unlockedAt: data.unlocked_at });
    }
  }, [userId, userAchievements, achievements]);

  // ── Marcar toast como visto ─────────────────────────────────────
  const clearToast = useCallback(async () => {
    if (!userId || !pendingToast) return;
    const key = pendingToast.key;
    notifiedRef.current.add(key);
    setPendingToast(null);

    // Marcar como notificado en BD
    await supabase
      .from("user_achievements")
      .update({ notified: true })
      .eq("user_id", userId)
      .eq("achievement_key", key);

    // Si hay más sin notificar, mostrar el siguiente
    const remaining = userAchievements.filter(
      ua => !ua.notified && !notifiedRef.current.has(ua.achievementKey)
    );
    if (remaining.length > 0) {
      const next = remaining[0];
      const meta = achievements.find(a => a.key === next.achievementKey);
      if (meta) {
        setTimeout(() => {
          setPendingToast({ ...meta, unlockedAt: next.unlockedAt });
        }, 600);
      }
    }
  }, [userId, pendingToast, userAchievements, achievements]);

  // ── Completar paso del onboarding ──────────────────────────────
  const completeStep = useCallback(async (step: string) => {
    if (!userId || !onboarding) return;
    if (onboarding.completedSteps.includes(step)) return;

    const newSteps = [...onboarding.completedSteps, step];
    setOnboarding(prev => prev ? { ...prev, completedSteps: newSteps } : prev);

    await supabase
      .from("user_onboarding")
      .update({ completed_steps: newSteps })
      .eq("user_id", userId);

    // Desbloquear logro asociado si existe
    await unlockAchievement(step);
  }, [userId, onboarding, unlockAchievement]);

  // ── Completar tour ──────────────────────────────────────────────
  const completeTour = useCallback(async () => {
    if (!userId || !onboarding) return;
    const now = new Date().toISOString();
    setOnboarding(prev => prev ? { ...prev, tourCompleted: true, completedAt: now } : prev);

    await supabase
      .from("user_onboarding")
      .update({ tour_completed: true, completed_at: now })
      .eq("user_id", userId);

    await unlockAchievement("tour_completed");

    // Easter egg: speed runner (tour en menos de 3 minutos)
    if (onboarding.startedAt) {
      const elapsed = (Date.now() - new Date(onboarding.startedAt).getTime()) / 1000;
      if (elapsed < 180) await unlockAchievement("speed_runner");
    }
  }, [userId, onboarding, unlockAchievement]);

  // ── Saltar tour ─────────────────────────────────────────────────
  const skipTour = useCallback(async () => {
    if (!userId) return;
    setOnboarding(prev => prev ? { ...prev, tourSkipped: true } : prev);
    await supabase
      .from("user_onboarding")
      .update({ tour_skipped: true })
      .eq("user_id", userId);
  }, [userId]);

  // ── Helpers derivados ───────────────────────────────────────────
  const hasAchievement  = useCallback((key: string) =>
    userAchievements.some(ua => ua.achievementKey === key),
  [userAchievements]);

  const hasCompletedStep = useCallback((step: string) =>
    onboarding?.completedSteps.includes(step) ?? false,
  [onboarding]);

  const totalPoints = userAchievements.reduce((acc, ua) => {
    const meta = achievements.find(a => a.key === ua.achievementKey);
    return acc + (meta?.points ?? 0);
  }, 0);

  return (
    <Ctx.Provider value={{
      achievements, userAchievements, onboarding, loading,
      pendingToast, clearToast,
      unlockAchievement, completeStep, completeTour, skipTour,
      hasAchievement, hasCompletedStep, totalPoints,
    }}>
      {children}
    </Ctx.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAchievements() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAchievements debe usarse dentro de <AchievementsProvider>");
  return ctx;
}
