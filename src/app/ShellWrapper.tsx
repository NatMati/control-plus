"use client";

import React from "react";
import { usePathname } from "next/navigation";
import TopNav from "@/components/TopNav";
import LeftDock from "@/components/LeftDock";

// Rutas donde NO queremos mostrar LeftDock ni TopNav
const BARE_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/auth/login",
  "/auth/register",
];

export default function ShellWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isBare = BARE_ROUTES.some((r) => pathname.startsWith(r));

  // Si es login/register → layout vacío
  if (isBare) {
    return <>{children}</>;
  }

  // Layout normal para el resto de la app
  return (
    <div className="flex min-h-screen bg-[#0b1221] text-[#e8eefc]">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-800 bg-[#020617]">
        <LeftDock />
      </aside>

      {/* Columna principal */}
      <div className="flex-1 flex flex-col">
        <TopNav />

        {/* Contenido sin centrado forzado, sin max-width */}
        <main className="flex-1 px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
