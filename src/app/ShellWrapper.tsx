"use client";

import React from "react";
import { usePathname } from "next/navigation";
import TopNav  from "@/components/TopNav";
import LeftDock from "@/components/LeftDock";
import NitoChat from "@/components/NitoChat";
import { useAchievements } from "@/context/AchievementsContext";

const BARE_ROUTES     = ["/", "/login", "/register", "/forgot-password", "/auth/login", "/auth/register"];
const NO_FLOAT_ROUTES = ["/nito"];

export default function ShellWrapper({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const isBare    = BARE_ROUTES.some(r => pathname === r || (r !== "/" && pathname.startsWith(r)));
  const hideFloat = NO_FLOAT_ROUTES.some(r => pathname.startsWith(r));

  if (isBare) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-[#0b1221] text-[#e8eefc]">
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-800 bg-[#020617] shrink-0">
        <LeftDock />
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        <TopNav />
        <main className="flex-1 overflow-x-hidden">
          <TourPadding>
            {children}
          </TourPadding>
        </main>
      </div>

      {!hideFloat && <NitoChat />}
    </div>
  );
}

// Agrega padding-top solo cuando el tour está activo para que la barra no tape contenido
function TourPadding({ children }: { children: React.ReactNode }) {
  const { onboarding } = useAchievements();
  const tourActive = onboarding && !onboarding.tourCompleted && !onboarding.tourSkipped;
  return (
    <div style={{ paddingTop: tourActive ? "3rem" : undefined }}>
      {children}
    </div>
  );
}
