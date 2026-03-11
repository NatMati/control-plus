// src/components/AchievementToast.tsx
"use client";

import { useEffect, useState } from "react";
import { useAchievements } from "@/context/AchievementsContext";

export default function AchievementToast() {
  const { pendingToast, clearToast } = useAchievements();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!pendingToast) { setVisible(false); return; }
    // Pequeño delay para que la animación de entrada se vea
    const t1 = setTimeout(() => setVisible(true), 50);
    // Auto-cerrar a los 5 segundos
    const t2 = setTimeout(() => handleClose(), 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [pendingToast]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(clearToast, 400); // esperar a que termine la animación de salida
  };

  if (!pendingToast) return null;

  const rewardLabel = pendingToast.rewardType === "discount"
    ? `🎁 Descuento de ${pendingToast.rewardValue} desbloqueado`
    : pendingToast.rewardType === "feature"
    ? `⚡ Nueva función desbloqueada`
    : null;

  return (
    <>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(24px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes toastOut {
          from { opacity: 1; transform: translateY(0)    scale(1);    }
          to   { opacity: 0; transform: translateY(12px) scale(0.95); }
        }
        @keyframes progressBar {
          from { width: 100%; }
          to   { width: 0%;   }
        }
        @keyframes shine {
          0%   { transform: translateX(-100%) rotate(25deg); }
          100% { transform: translateX(300%)  rotate(25deg); }
        }
        .toast-enter { animation: toastIn  0.4s cubic-bezier(.22,1,.36,1) both; }
        .toast-exit  { animation: toastOut 0.35s ease-in both; }
        .toast-progress { animation: progressBar 5s linear forwards; }
        .toast-shine::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%);
          animation: shine 2s ease 0.5s both;
          pointer-events: none;
        }
      `}</style>

      {/* Backdrop sutil */}
      <div
        className="fixed bottom-6 right-6 z-[9999] max-w-sm w-full"
        style={{ filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.5))" }}
      >
        <div
          className={`toast-shine relative rounded-2xl overflow-hidden cursor-pointer ${visible ? "toast-enter" : "toast-exit"}`}
          style={{
            background: "linear-gradient(135deg, #0a1628 0%, #051018 100%)",
            border: "1px solid rgba(56,189,248,0.25)",
            boxShadow: "0 0 40px rgba(56,189,248,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
          onClick={handleClose}
        >
          {/* Barra de progreso */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/5">
            <div
              className="toast-progress h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #38BDF8, #0D9488)" }}
            />
          </div>

          <div className="p-4 flex items-start gap-3.5">
            {/* Ícono */}
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(56,189,248,0.15), rgba(13,148,136,0.15))",
                border: "1px solid rgba(56,189,248,0.2)",
              }}
            >
              {pendingToast.icon}
            </div>

            {/* Texto */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: "#38BDF8" }}
                >
                  Logro desbloqueado
                </span>
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(56,189,248,0.1)", color: "#38BDF8" }}
                >
                  +{pendingToast.points} pts
                </span>
              </div>
              <div className="text-sm font-bold text-white leading-tight">
                {pendingToast.title}
              </div>
              <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                {pendingToast.description}
              </div>
              {rewardLabel && (
                <div
                  className="mt-2 text-[11px] font-medium px-2 py-1 rounded-lg inline-block"
                  style={{
                    background: "rgba(52,211,153,0.1)",
                    border: "1px solid rgba(52,211,153,0.2)",
                    color: "#34D399",
                  }}
                >
                  {rewardLabel}
                </div>
              )}
            </div>

            {/* Cerrar */}
            <button
              onClick={e => { e.stopPropagation(); handleClose(); }}
              className="text-slate-600 hover:text-slate-400 transition-colors shrink-0 mt-0.5"
              style={{ fontSize: 16 }}
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
