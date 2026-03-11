import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@app/globals.css";

import { SettingsProvider }     from "@/context/SettingsContext";
import { AccountsProvider }     from "@/context/AccountsContext";
import { BudgetsProvider }      from "@/context/BudgetsContext";
import { GoalsProvider }        from "@/context/GoalsContext";
import { MovementsProvider }    from "@/context/MovementsContext";
import { AchievementsProvider } from "@/context/AchievementsContext"; // 👈 NUEVO
import ShellWrapper             from "./ShellWrapper";
import AchievementToast         from "@/components/AchievementToast"; // 👈 NUEVO
import OnboardingTour           from "@/components/OnboardingTour";   // 👈 NUEVO
import OnboardingDetector       from "@/components/OnboardingDetector"; // 👈 NUEVO

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Control+",
  description: "Dashboard de finanzas personales",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0b1221] text-[#e8eefc]`}
      >
        <SettingsProvider>
          <AccountsProvider>
            <BudgetsProvider>
              <MovementsProvider>
                <GoalsProvider>
                  <AchievementsProvider> {/* 👈 envuelve ShellWrapper para tener acceso en toda la app */}
                    <OnboardingDetector /> {/* 👈 detecta pasos completados automáticamente */}
                    <OnboardingTour />     {/* 👈 barra fija + modal de bienvenida */}
                    <ShellWrapper>{children}</ShellWrapper>
                    <AchievementToast /> {/* 👈 toast global, fuera del shell para no heredar estilos */}
                  </AchievementsProvider>
                </GoalsProvider>
              </MovementsProvider>
            </BudgetsProvider>
          </AccountsProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
