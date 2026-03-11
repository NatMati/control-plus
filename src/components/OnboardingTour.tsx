// src/components/OnboardingTour.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAchievements } from "@/context/AchievementsContext";

// ─── Pasos del tour ───────────────────────────────────────────────────────────

const STEPS = [
  {
    key:         "first_account",
    title:       "Crea tu primera cuenta",
    description: "Agrega una cuenta bancaria, billetera digital o efectivo para empezar a registrar tus finanzas.",
    icon:        "🏦",
    action:      "Ir a Cuentas",
    href:        "/cuentas",
    hint:        'Haz clic en "Nueva cuenta" y completa el formulario.',
  },
  {
    key:         "first_movement",
    title:       "Registra tu primer movimiento",
    description: "Anota un ingreso o gasto real. Puede ser tu sueldo, una compra, lo que sea.",
    icon:        "💸",
    action:      "Ir a Movimientos",
    href:        "/movimientos",
    hint:        'Haz clic en el botón "+" para agregar un movimiento.',
  },
  {
    key:         "first_budget",
    title:       "Crea tu primer presupuesto",
    description: "Define un límite mensual para una categoría de gasto y Control+ te avisará cuando estés cerca.",
    icon:        "🎯",
    action:      "Ir a Presupuestos",
    href:        "/presupuestos",
    hint:        "Elige una categoría y asigna un monto límite para este mes.",
  },
  {
    key:         "first_cashflow",
    title:       "Explora tu cashflow",
    description: "Ve exactamente de dónde viene y adónde va tu dinero con el diagrama de flujo visual.",
    icon:        "🌊",
    action:      "Ver Cashflow",
    href:        "/reportes/cashflow",
    hint:        "Ajusta el rango de fechas y observa el diagrama Sankey.",
  },
  {
    key:         "first_investment",
    title:       "Conoce las inversiones",
    description: "Agrega tus activos — acciones, cripto, bonos — y seguí su performance en tiempo real.",
    icon:        "📈",
    action:      "Ir a Inversiones",
    href:        "/inversiones",
    hint:        "Explora los tipos de activos disponibles.",
  },
  {
    key:         "first_nito",
    title:       "Habla con Nito",
    description: "Nito es tu asesor financiero IA. Pregúntale lo que quieras sobre tus finanzas.",
    icon:        "✦",
    action:      "Abrir Nito",
    href:        "/nito",
    hint:        'Escribe una pregunta como "¿En qué gasté más este mes?"',
  },
];

const STYLE = `
  @keyframes tourFadeIn {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes tourSlideUp {
    from { opacity: 0; transform: translateY(32px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }
  @keyframes pulse-cyan {
    0%, 100% { box-shadow: 0 0 0 0 rgba(56,189,248,0.4); }
    50%       { box-shadow: 0 0 0 8px rgba(56,189,248,0); }
  }
  .tour-bar   { animation: tourFadeIn  0.4s cubic-bezier(.22,1,.36,1) both; }
  .tour-modal { animation: tourSlideUp 0.5s cubic-bezier(.22,1,.36,1) both; }
  .pulse-btn  { animation: pulse-cyan 2s ease-in-out infinite; }
`;

// ─── Componente principal ─────────────────────────────────────────────────────

export default function OnboardingTour() {
  const router = useRouter();
  const {
    onboarding, loading,
    hasCompletedStep, completeStep,
    completeTour, skipTour,
  } = useAchievements();

  const [showWelcome, setShowWelcome] = useState(false);
  const [dismissed,   setDismissed]   = useState(false);

  // Determinar paso actual
  const currentStepIndex = STEPS.findIndex(s => !hasCompletedStep(s.key));
  const currentStep      = currentStepIndex >= 0 ? STEPS[currentStepIndex] : null;
  const completedCount   = STEPS.filter(s => hasCompletedStep(s.key)).length;
  const progressPct      = Math.round((completedCount / STEPS.length) * 100);
  const allDone          = completedCount === STEPS.length;

  // Mostrar welcome modal solo si es nuevo y no ha completado nada ni saltado
  useEffect(() => {
    if (loading) return;
    if (!onboarding) return;
    if (onboarding.tourCompleted || onboarding.tourSkipped) return;
    if (completedCount === 0) setShowWelcome(true);
  }, [loading, onboarding, completedCount]);

  // Completar tour automáticamente cuando termina todos los pasos
  useEffect(() => {
    if (allDone && onboarding && !onboarding.tourCompleted) {
      completeTour();
    }
  }, [allDone]);

  // No mostrar nada si ya terminó, saltó, o está cargando
  if (loading) return null;
  if (!onboarding) return null;
  if (onboarding.tourCompleted) return null;
  if (onboarding.tourSkipped)   return null;
  if (dismissed)                return null;

  return (
    <>
      <style>{STYLE}</style>

      {/* ── Modal de bienvenida ── */}
      {showWelcome && (
        <WelcomeModal
          onStart={() => {
            setShowWelcome(false);
            if (currentStep) router.push(currentStep.href);
          }}
        />
      )}

      {/* ── Barra de progreso fija ── */}
      {!showWelcome && (
        <TourBar
          steps={STEPS}
          currentIndex={currentStepIndex}
          completedCount={completedCount}
          progressPct={progressPct}
          currentStep={currentStep}
          onNavigate={(href) => router.push(href)}
          onMarkDone={() => currentStep && completeStep(currentStep.key)}
          onSkip={async () => {
            await skipTour();
            setDismissed(true);
          }}
          allDone={allDone}
        />
      )}
    </>
  );
}

// ─── Welcome Modal ────────────────────────────────────────────────────────────

function WelcomeModal({ onStart }: { onStart: () => void }) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center px-4"
      style={{ background: "rgba(2,6,15,0.85)", backdropFilter: "blur(8px)" }}>
      <div className="tour-modal w-full max-w-md rounded-2xl p-8 text-center"
        style={{
          background: "linear-gradient(160deg,#0a1628,#051018)",
          border: "1px solid rgba(56,189,248,0.2)",
          boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 60px rgba(56,189,248,0.06)",
        }}>

        {/* Ícono animado */}
        <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center text-3xl"
          style={{
            background: "linear-gradient(135deg,rgba(56,189,248,0.15),rgba(13,148,136,0.15))",
            border: "1px solid rgba(56,189,248,0.2)",
          }}>
          🎯
        </div>

        <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">
          Bienvenido a Control+
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed mb-8">
          Para sacarle el máximo provecho a la app, te guiamos en un tour rápido.
          Vas a crear tu primera cuenta, registrar un movimiento y explorar las herramientas clave.
        </p>

        {/* Pasos preview */}
        <div className="grid grid-cols-3 gap-2 mb-8">
          {STEPS.slice(0, 6).map((s, i) => (
            <div key={s.key}
              className="rounded-xl p-3 flex flex-col items-center gap-1.5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-lg">{s.icon}</span>
              <span className="text-[10px] text-slate-500 text-center leading-tight">{s.title.split(" ").slice(0,3).join(" ")}</span>
            </div>
          ))}
        </div>

        {/* Recompensa */}
        <div className="rounded-xl p-3 mb-6 flex items-center gap-3"
          style={{ background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.15)" }}>
          <span className="text-xl">🏆</span>
          <div className="text-left">
            <div className="text-xs font-semibold text-cyan-400">Recompensa al completar</div>
            <div className="text-xs text-slate-400">Badge exclusivo + 50 puntos</div>
          </div>
        </div>

        <button onClick={onStart}
          className="pulse-btn w-full py-3 rounded-xl text-sm font-bold text-slate-900 mb-3"
          style={{ background: "linear-gradient(135deg,#38BDF8,#0D9488)" }}>
          Empezar el tour →
        </button>
        <p className="text-xs text-slate-600">
          Dura aproximadamente 5 minutos
        </p>
      </div>
    </div>
  );
}

// ─── Tour Bar ─────────────────────────────────────────────────────────────────

function TourBar({
  steps, currentIndex, completedCount, progressPct,
  currentStep, onNavigate, onMarkDone, onSkip, allDone,
}: {
  steps: typeof STEPS;
  currentIndex: number;
  completedCount: number;
  progressPct: number;
  currentStep: typeof STEPS[0] | null;
  onNavigate: (href: string) => void;
  onMarkDone: () => void;
  onSkip: () => void;
  allDone: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (allDone) return null;

  return (
    <div className="tour-bar fixed top-0 left-0 right-0 z-[9990]"
      style={{ background: "rgba(5,8,15,0.95)", borderBottom: "1px solid rgba(56,189,248,0.15)", backdropFilter: "blur(12px)" }}>

      {/* Barra de progreso */}
      <div className="h-0.5 w-full" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div className="h-full transition-all duration-700 ease-out"
          style={{
            width: `${progressPct}%`,
            background: "linear-gradient(90deg,#0D9488,#38BDF8)",
            boxShadow: "0 0 8px rgba(56,189,248,0.4)",
          }}/>
      </div>

      {/* Contenido */}
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-4">

        {/* Paso actual */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
            style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)" }}>
            {currentStep?.icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-cyan-500 font-semibold uppercase tracking-wider">
                Paso {currentIndex + 1} de {steps.length}
              </span>
              <span className="text-[10px] text-slate-600">·</span>
              <span className="text-[10px] text-slate-500">{completedCount} completados</span>
            </div>
            <div className="text-xs font-semibold text-white truncate">
              {currentStep?.title}
            </div>
          </div>
        </div>

        {/* Pasos dots */}
        <div className="hidden md:flex items-center gap-1.5">
          {steps.map((s, i) => (
            <div key={s.key}
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{
                background: i < completedCount
                  ? "#38BDF8"
                  : i === currentIndex
                  ? "rgba(56,189,248,0.4)"
                  : "rgba(255,255,255,0.1)",
                transform: i === currentIndex ? "scale(1.4)" : "scale(1)",
              }}
            />
          ))}
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 shrink-0">
          {currentStep && (
            <button
              onClick={() => onNavigate(currentStep.href)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: "linear-gradient(135deg,#38BDF8,#0D9488)",
                color: "#05080F",
              }}>
              {currentStep.action}
            </button>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.04)" }}>
            {expanded ? "Cerrar" : "Ver pasos"}
          </button>
          {completedCount >= 1 && (
            <button onClick={onSkip}
              className="text-[11px] text-slate-700 hover:text-slate-500 transition-colors">
              Saltar tour
            </button>
          )}
        </div>
      </div>

      {/* Panel expandido con todos los pasos */}
      {expanded && (
        <div className="border-t max-w-6xl mx-auto px-4 py-4"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {steps.map((s, i) => {
              const done    = i < completedCount;
              const active  = i === currentIndex;
              return (
                <button key={s.key}
                  onClick={() => { onNavigate(s.href); setExpanded(false); }}
                  disabled={done}
                  className="rounded-xl p-3 text-left transition-all"
                  style={{
                    background: done
                      ? "rgba(13,148,136,0.08)"
                      : active
                      ? "rgba(56,189,248,0.08)"
                      : "rgba(255,255,255,0.02)",
                    border: done
                      ? "1px solid rgba(13,148,136,0.2)"
                      : active
                      ? "1px solid rgba(56,189,248,0.2)"
                      : "1px solid rgba(255,255,255,0.05)",
                    opacity: !done && !active && i > currentIndex ? 0.5 : 1,
                  }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-base">{s.icon}</span>
                    {done && <span className="text-[10px] text-teal-400">✓</span>}
                    {active && <span className="text-[10px] text-cyan-400">→</span>}
                  </div>
                  <div className="text-[11px] font-semibold leading-tight"
                    style={{ color: done ? "#0D9488" : active ? "#38BDF8" : "rgba(255,255,255,0.6)" }}>
                    {s.title}
                  </div>
                  <div className="text-[10px] text-slate-600 mt-0.5 leading-tight line-clamp-2">
                    {s.hint}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
