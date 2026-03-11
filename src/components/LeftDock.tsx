"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Receipt, TrendingUp, Landmark,
  Target, CreditCard, Activity, CalendarDays,
  Zap, Clock, Trophy, Shield,
} from "lucide-react";
import { useSubscription, canUseNito } from "@/hooks/useSubscription";
import { useAchievements } from "@/context/AchievementsContext";

type NavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const navItems: NavItem[] = [
  { href: "/dashboard",           label: "Resumen",      Icon: LayoutDashboard },
  { href: "/movimientos",         label: "Movimientos",  Icon: Receipt         },
  { href: "/inversiones",         label: "Inversiones",  Icon: TrendingUp      },
  { href: "/cuentas",             label: "Cuentas",      Icon: Landmark        },
  { href: "/presupuestos",        label: "Presupuestos", Icon: Target          },
  { href: "/deudas",              label: "Deudas",       Icon: CreditCard      },
  { href: "/reportes/calendario", label: "Calendario",   Icon: CalendarDays    },
  { href: "/reportes/cashflow",   label: "Cashflow",     Icon: Activity        },
];

const toolItems: NavItem[] = [
  { href: "/herramientas/costo-real", label: "Costo real", Icon: Clock },
];

const PLAN_BADGE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  FREE:   { label: "Free",   color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)"  },
  PRO:    { label: "Pro",    color: "#60a5fa", bg: "rgba(59,130,246,0.1)",   border: "rgba(59,130,246,0.3)"   },
  DELUXE: { label: "Deluxe", color: "#fbbf24", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)"   },
};

function NavLink({ href, label, Icon }: NavItem) {
  const pathname = usePathname();
  const active   = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
        active ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60",
      ].join(" ")}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}

export default function LeftDock() {
  const pathname    = usePathname();
  const nitoActive  = pathname.startsWith("/nito");
  const logrosActive = pathname.startsWith("/logros");

  const { plan, loading: planLoading } = useSubscription();
  const hasNito    = canUseNito(plan);
  const hasDeluxe  = plan === "DELUXE";
  const badge      = PLAN_BADGE[plan] ?? PLAN_BADGE.FREE;

  const { totalPoints, userAchievements } = useAchievements();

  // Logros sin notificar → badge rojo en el ícono
  const unnotified = userAchievements.filter(ua => !ua.notified).length;

  return (
    <div className="flex h-full flex-col bg-[#020617]">

      {/* Header */}
      <div className="flex h-16 items-center border-b border-slate-800 px-4">
        <span className="text-sm font-semibold tracking-tight text-slate-100">Control+</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">

        {/* Nav principal */}
        {navItems.map(item => <NavLink key={item.href} {...item} />)}

        {/* ── Herramientas ── */}
        <div className="pt-3 pb-1 px-3">
          <span className="text-[9px] uppercase tracking-widest text-slate-700 font-semibold">
            Herramientas
          </span>
        </div>
        {toolItems.map(item => <NavLink key={item.href} {...item} />)}

        {/* ── Premium (solo Deluxe) ── */}
        {hasDeluxe && (
          <>
            <div className="pt-3 pb-1 px-3 flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-widest text-amber-700/80 font-semibold">
                Premium
              </span>
              <span className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.2)" }}>
                Deluxe
              </span>
            </div>
            <Link
              href="/seguros"
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition group",
                pathname.startsWith("/seguros")
                  ? "bg-amber-900/30 text-amber-300 ring-1 ring-amber-700/30"
                  : "text-slate-300 hover:bg-amber-900/20 hover:text-amber-300",
              ].join(" ")}
            >
              <Shield className="h-4 w-4" />
              <span>Seguros</span>
              <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full border"
                style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#fbbf24" }}>
                NEW
              </span>
            </Link>
          </>
        )}

        {/* ── Separador ── */}
        <div className="my-2 border-t border-slate-800/60" />

        {/* Nito ✦ */}
        <Link
          href="/nito"
          className={[
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition group",
            nitoActive
              ? "bg-gradient-to-r from-teal-900/60 to-blue-900/40 text-teal-300 ring-1 ring-teal-700/40"
              : "text-slate-300 hover:bg-gradient-to-r hover:from-teal-900/30 hover:to-blue-900/20 hover:text-teal-300",
          ].join(" ")}
        >
          <span className={[
            "w-4 h-4 flex items-center justify-center text-xs font-bold rounded transition-all",
            nitoActive ? "text-teal-300" : "text-slate-400 group-hover:text-teal-400",
          ].join(" ")}>
            {hasNito ? "✦" : "🔒"}
          </span>
          <span>Nito</span>
          <span className={[
            "ml-auto text-[9px] px-1.5 py-0.5 rounded-full border font-medium transition-all",
            nitoActive
              ? "bg-teal-500/10 border-teal-500/30 text-teal-400"
              : "bg-slate-800 border-slate-700 text-slate-500 group-hover:border-teal-700/40 group-hover:text-teal-500",
          ].join(" ")}>
            {hasNito ? "IA" : "Pro"}
          </span>
        </Link>

        {/* Logros 🏆 */}
        <Link
          href="/logros"
          className={[
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition group relative",
            logrosActive
              ? "bg-gradient-to-r from-amber-900/40 to-orange-900/20 text-amber-300 ring-1 ring-amber-700/30"
              : "text-slate-300 hover:bg-amber-900/10 hover:text-amber-300",
          ].join(" ")}
        >
          <Trophy className={[
            "h-4 w-4 transition-all",
            logrosActive ? "text-amber-300" : "text-slate-400 group-hover:text-amber-400",
          ].join(" ")} />
          <span>Logros</span>

          {/* XP badge */}
          {totalPoints > 0 && (
            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full border font-medium mono"
              style={{
                background: logrosActive ? "rgba(245,158,11,0.15)" : "rgba(245,158,11,0.06)",
                border: "1px solid rgba(245,158,11,0.2)",
                color: "#fbbf24",
              }}>
              {totalPoints} XP
            </span>
          )}

          {/* Punto rojo si hay logros sin ver */}
          {unnotified > 0 && (
            <span className="absolute top-1.5 left-6 w-2 h-2 rounded-full"
              style={{ background: "#ef4444", boxShadow: "0 0 6px rgba(239,68,68,0.6)" }}/>
          )}
        </Link>

      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 px-3 py-3 space-y-2">
        {!planLoading && (
          <Link href="/upgrade"
            className="flex items-center justify-between px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
            style={{ background: badge.bg, border: `1px solid ${badge.border}` }}>
            <span className="text-[10px] font-medium" style={{ color: badge.color }}>
              Plan {badge.label}
            </span>
            {plan === "FREE" && (
              <span className="text-[9px] text-slate-500 flex items-center gap-1">
                <Zap className="w-2.5 h-2.5" /> Upgrade
              </span>
            )}
          </Link>
        )}
        <Link
          href="/movimientos/nuevo"
          className="block w-full rounded-lg bg-[#3b82f6] py-2 text-center text-sm font-medium text-white hover:bg-blue-500"
        >
          Registrar movimiento
        </Link>
      </div>
    </div>
  );
}
