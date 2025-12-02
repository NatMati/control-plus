"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  PiggyBank,
  Target,
  CreditCard,
  Activity,
  CalendarDays,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const navItems: NavItem[] = [
  { href: "/dashboard",           label: "Resumen",     Icon: LayoutDashboard },
  { href: "/movimientos",         label: "Movimientos", Icon: Receipt },
  { href: "/inversiones",         label: "Inversiones", Icon: TrendingUp },
  { href: "/ahorro",              label: "Ahorro",      Icon: PiggyBank },
  { href: "/presupuestos",        label: "Presupuestos",Icon: Target },
  { href: "/deudas",              label: "Deudas",      Icon: CreditCard },
  { href: "/reportes/calendario", label: "Calendario",  Icon: CalendarDays },
  { href: "/reportes/cashflow",   label: "Cashflow",    Icon: Activity },
];

export default function LeftDock() {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-[#020617]">
      {/* Header del sidebar – mismo alto que el topnav (h-16) */}
      <div className="flex h-16 items-center border-b border-slate-800 px-4">
        <span className="text-sm font-semibold tracking-tight text-slate-100">
          Control+
        </span>
      </div>

      {/* Navegación principal */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navItems.map(({ href, label, Icon }) => {
          const active =
            pathname === href || pathname.startsWith(href + "/");

          return (
            <Link
              key={href}
              href={href}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                active
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:bg-slate-800/60",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Botón inferior */}
      <div className="border-t border-slate-800 px-3 py-3">
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
