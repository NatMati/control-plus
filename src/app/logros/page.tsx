// src/app/logros/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useAchievements, type Achievement } from "@/context/AchievementsContext";

// ─── Estilos ──────────────────────────────────────────────────────────────────
const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap');
  .mono { font-family: 'DM Mono', monospace; }

  @keyframes fadeUp {
    from { opacity:0; transform:translateY(16px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes pulse-glow {
    0%,100% { box-shadow: 0 0 0 0 rgba(56,189,248,0); }
    50%      { box-shadow: 0 0 16px 4px rgba(56,189,248,0.25); }
  }
  @keyframes float {
    0%,100% { transform: translateY(0); }
    50%      { transform: translateY(-4px); }
  }
  @keyframes shimmer {
    0%   { background-position:-200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes scanline {
    0%   { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes xpFill {
    from { width: 0%; }
    to   { width: var(--xp-pct); }
  }
  @keyframes badgeIn {
    from { opacity:0; transform:scale(0.7) rotate(-8deg); }
    to   { opacity:1; transform:scale(1)   rotate(0deg); }
  }
  @keyframes glitch {
    0%,100% { clip-path:inset(0 0 100% 0); transform:translateX(0); }
    20%      { clip-path:inset(20% 0 60% 0); transform:translateX(-4px); }
    40%      { clip-path:inset(50% 0 30% 0); transform:translateX(4px); }
    60%      { clip-path:inset(70% 0 10% 0); transform:translateX(-2px); }
    80%      { clip-path:inset(10% 0 80% 0); transform:translateX(2px); }
  }

  .fade-up   { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) both; }
  .badge-in  { animation: badgeIn .4s cubic-bezier(.22,1,.36,1) both; }
  .float-anim { animation: float 3s ease-in-out infinite; }

  .xp-bar { animation: xpFill 1.2s cubic-bezier(.22,1,.36,1) .3s both; }

  .card-glow:hover {
    box-shadow: 0 0 20px rgba(56,189,248,0.15), 0 8px 32px rgba(0,0,0,0.4);
    transform: translateY(-2px);
    transition: all .25s cubic-bezier(.22,1,.36,1);
  }
  .card-locked:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    transform: translateY(-1px);
  }

  .shimmer-text {
    background: linear-gradient(90deg, #38BDF8 0%, #7DD3FC 40%, #0D9488 60%, #38BDF8 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 3s linear infinite;
  }

  .scanline::after {
    content: '';
    position: absolute;
    left: 0; right: 0;
    height: 2px;
    background: linear-gradient(transparent, rgba(56,189,248,0.08), transparent);
    animation: scanline 4s linear infinite;
    pointer-events: none;
  }

  .badge-locked { filter: grayscale(1) brightness(0.3); }
  .badge-secret { filter: brightness(0.15) blur(1px); }
  .badge-secret:hover { filter: brightness(0.25) blur(0.5px); }

  .cat-tab {
    transition: all .2s;
    cursor: pointer;
    border-bottom: 2px solid transparent;
  }
  .cat-tab.active {
    border-bottom-color: #38BDF8;
    color: #38BDF8;
  }
  .cat-tab:hover:not(.active) { color: rgba(255,255,255,0.6); }
`;

// ─── Helpers de nivel ─────────────────────────────────────────────────────────
function getLevel(points: number) {
  const thresholds = [0, 50, 120, 220, 360, 550, 800, 1100, 1500, 2000];
  let level = 1;
  for (let i = 0; i < thresholds.length; i++) {
    if (points >= thresholds[i]) level = i + 1;
  }
  const current = thresholds[Math.min(level - 1, thresholds.length - 1)];
  const next    = thresholds[Math.min(level, thresholds.length - 1)];
  const pct     = next === current ? 100 : Math.round(((points - current) / (next - current)) * 100);
  const titles  = ["Novato", "Aprendiz", "Explorador", "Estratega", "Inversor", "Analista", "Experto", "Maestro", "Elite", "Leyenda"];
  return { level, title: titles[Math.min(level - 1, titles.length - 1)], pct, next, current };
}

const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  all:        { label: "Todos",      icon: "⬡",  color: "#38BDF8" },
  onboarding: { label: "Inicio",     icon: "🚀", color: "#A78BFA" },
  financial:  { label: "Financiero", icon: "💹", color: "#34D399" },
  secret:     { label: "Secretos",   icon: "👁", color: "#F59E0B" },
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function LogrosPage() {
  const { achievements, userAchievements, totalPoints, loading } = useAchievements();
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const lvl = useMemo(() => getLevel(totalPoints), [totalPoints]);

  const unlockedKeys = useMemo(
    () => new Set(userAchievements.map(ua => ua.achievementKey)),
    [userAchievements]
  );

  const filtered = useMemo(() => {
    if (activeCategory === "all") return achievements;
    return achievements.filter(a => a.category === activeCategory);
  }, [achievements, activeCategory]);

  const rewards = useMemo(() =>
    userAchievements
      .map(ua => achievements.find(a => a.key === ua.achievementKey))
      .filter(a => a && a.rewardType && a.rewardType !== "badge"),
    [userAchievements, achievements]
  );

  if (loading) return <LoadingScreen />;

  return (
    <>
      <style>{STYLE}</style>
      <div className="min-h-screen px-4 py-8 max-w-5xl mx-auto scanline" style={{ position: "relative" }}>

        {/* ── Header / Perfil de jugador ── */}
        <div className="fade-up mb-8 rounded-2xl p-6 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(10,22,40,0.9) 0%, rgba(5,10,20,0.95) 100%)",
            border: "1px solid rgba(56,189,248,0.2)",
            boxShadow: "0 0 60px rgba(56,189,248,0.04), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}>

          {/* Grid decorativo fondo */}
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
            style={{ backgroundImage: "linear-gradient(rgba(56,189,248,1) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,1) 1px,transparent 1px)", backgroundSize: "30px 30px" }}/>

          <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">

            {/* Avatar / nivel */}
            <div className="float-anim relative shrink-0">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black"
                style={{
                  background: "linear-gradient(135deg,#0D9488,#38BDF8)",
                  boxShadow: "0 0 30px rgba(56,189,248,0.3), 0 0 60px rgba(13,148,136,0.15)",
                  animation: "pulse-glow 3s ease-in-out infinite",
                }}>
                C+
              </div>
              {/* Badge de nivel */}
              <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black text-slate-900"
                style={{ background: "linear-gradient(135deg,#F59E0B,#EF4444)", border: "2px solid #05080F" }}>
                {lvl.level}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-white tracking-tight">Mis Logros</h1>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full mono"
                  style={{
                    background: "linear-gradient(135deg,#0D9488,#38BDF8)",
                    color: "#020810",
                    letterSpacing: "0.06em",
                  }}>
                  {lvl.title.toUpperCase()}
                </span>
              </div>
              <div className="text-sm text-slate-500 mb-3">
                {unlockedKeys.size} de {achievements.length} logros desbloqueados · {totalPoints} XP total
              </div>

              {/* Barra de XP */}
              <div>
                <div className="flex justify-between text-[10px] text-slate-600 mb-1.5 mono">
                  <span>NIVEL {lvl.level}</span>
                  <span>{totalPoints} / {lvl.next} XP</span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div
                    className="xp-bar h-full rounded-full"
                    style={{
                      "--xp-pct": `${lvl.pct}%`,
                      width: `${lvl.pct}%`,
                      background: "linear-gradient(90deg, #0D9488, #38BDF8)",
                      boxShadow: "0 0 8px rgba(56,189,248,0.5)",
                    } as any}
                  />
                </div>
                <div className="text-[10px] text-slate-700 mt-1 mono">{lvl.pct}% hacia nivel {lvl.level + 1}</div>
              </div>
            </div>

            {/* Stats rápidos */}
            <div className="flex md:flex-col gap-3 shrink-0">
              {[
                { label: "PUNTOS",   value: totalPoints,         color: "#38BDF8" },
                { label: "LOGROS",   value: unlockedKeys.size,   color: "#A78BFA" },
                { label: "NIVEL",    value: lvl.level,           color: "#F59E0B" },
              ].map(s => (
                <div key={s.label} className="text-center px-4 py-2 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="text-xl font-black mono" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[9px] text-slate-600 tracking-widest">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Recompensas activas ── */}
        {rewards.length > 0 && (
          <div className="fade-up mb-6" style={{ animationDelay: ".1s" }}>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
              ⚡ Recompensas activas
            </h2>
            <div className="flex flex-wrap gap-2">
              {rewards.map(a => a && (
                <div key={a.key}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
                  style={{
                    background: a.rewardType === "discount"
                      ? "rgba(52,211,153,0.08)"
                      : "rgba(56,189,248,0.08)",
                    border: a.rewardType === "discount"
                      ? "1px solid rgba(52,211,153,0.2)"
                      : "1px solid rgba(56,189,248,0.2)",
                    color: a.rewardType === "discount" ? "#34D399" : "#38BDF8",
                  }}>
                  <span>{a.icon}</span>
                  <span>
                    {a.rewardType === "discount"
                      ? `${a.rewardValue} descuento activo`
                      : `Feature desbloqueada: ${a.rewardValue}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tabs de categoría ── */}
        <div className="fade-up flex gap-6 mb-6 border-b" style={{ animationDelay: ".15s", borderColor: "rgba(255,255,255,0.06)" }}>
          {Object.entries(CATEGORY_META).map(([key, meta]) => {
            const count = key === "all"
              ? achievements.length
              : achievements.filter(a => a.category === key).length;
            const unlockedCount = key === "all"
              ? unlockedKeys.size
              : achievements.filter(a => a.category === key && unlockedKeys.has(a.key)).length;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`cat-tab pb-3 flex items-center gap-2 text-sm font-medium ${activeCategory === key ? "active" : "text-slate-600"}`}
              >
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
                <span className="text-[10px] mono px-1.5 py-0.5 rounded"
                  style={{
                    background: activeCategory === key ? "rgba(56,189,248,0.1)" : "rgba(255,255,255,0.04)",
                    color: activeCategory === key ? "#38BDF8" : "rgba(100,116,139,0.8)",
                  }}>
                  {unlockedCount}/{count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Grid de logros ── */}
        <div className="fade-up grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
          style={{ animationDelay: ".2s" }}>
          {filtered.map((a, i) => (
            <AchievementCard
              key={a.key}
              achievement={a}
              unlocked={unlockedKeys.has(a.key)}
              index={i}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20 text-slate-700">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-sm">Sin logros en esta categoría</div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Card de logro ────────────────────────────────────────────────────────────
function AchievementCard({
  achievement, unlocked, index,
}: {
  achievement: Achievement;
  unlocked: boolean;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);
  const isSecret = achievement.isSecret && !unlocked;

  return (
    <div
      className={`badge-in relative rounded-2xl p-4 flex flex-col items-center text-center transition-all duration-200 ${unlocked ? "card-glow cursor-default" : "card-locked cursor-not-allowed"}`}
      style={{
        animationDelay: `${.2 + index * 0.04}s`,
        background: unlocked
          ? "linear-gradient(135deg, rgba(10,22,40,0.95) 0%, rgba(5,10,20,0.98) 100%)"
          : "rgba(255,255,255,0.02)",
        border: unlocked
          ? "1px solid rgba(56,189,248,0.2)"
          : "1px solid rgba(255,255,255,0.05)",
        boxShadow: unlocked
          ? "0 0 20px rgba(56,189,248,0.06), inset 0 1px 0 rgba(255,255,255,0.05)"
          : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Brillo de fondo para desbloqueados */}
      {unlocked && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.06) 0%, transparent 70%)",
          }}/>
      )}

      {/* Ícono */}
      <div className={`relative text-3xl mb-2.5 transition-all duration-300 ${unlocked ? (hovered ? "scale-110" : "") : isSecret ? "badge-secret" : "badge-locked"}`}
        style={{ filter: unlocked ? (hovered ? "drop-shadow(0 0 8px rgba(56,189,248,0.6))" : "none") : undefined }}>
        {isSecret ? "❓" : achievement.icon}
        {unlocked && (
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px]"
            style={{ background: "linear-gradient(135deg,#0D9488,#38BDF8)", boxShadow: "0 0 6px rgba(56,189,248,0.4)" }}>
            ✓
          </div>
        )}
      </div>

      {/* Título */}
      <div className={`text-[11px] font-bold leading-tight mb-1 ${unlocked ? "text-white" : "text-slate-700"}`}>
        {isSecret ? "???" : achievement.title}
      </div>

      {/* Descripción — solo al hover para los desbloqueados */}
      {unlocked && hovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 z-50 rounded-xl p-3 text-[11px] text-slate-300 leading-relaxed"
          style={{
            background: "rgba(5,10,20,0.98)",
            border: "1px solid rgba(56,189,248,0.2)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}>
          {achievement.description}
          {achievement.rewardType && (
            <div className="mt-2 text-[10px] font-semibold"
              style={{ color: achievement.rewardType === "discount" ? "#34D399" : "#38BDF8" }}>
              {achievement.rewardType === "discount"
                ? `🎁 Descuento ${achievement.rewardValue}`
                : achievement.rewardType === "feature"
                ? `⚡ Feature desbloqueada`
                : `🏅 Badge especial`}
            </div>
          )}
        </div>
      )}

      {/* Puntos */}
      <div className={`text-[10px] mono font-medium ${unlocked ? "" : "text-slate-800"}`}
        style={{ color: unlocked ? "#38BDF8" : undefined }}>
        {isSecret ? "???" : `+${achievement.points} XP`}
      </div>

      {/* Candado para bloqueados */}
      {!unlocked && !isSecret && (
        <div className="absolute top-2 right-2 text-[10px] text-slate-800">🔒</div>
      )}
    </div>
  );
}

// ─── Loading screen ───────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full border-2 border-slate-800 border-t-cyan-400 mx-auto mb-4"
          style={{ animation: "spin .8s linear infinite" }}/>
        <div className="text-xs text-slate-600 mono">CARGANDO LOGROS...</div>
      </div>
    </div>
  );
}
