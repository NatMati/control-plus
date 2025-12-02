import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@app/globals.css";
import { SettingsProvider } from "@/context/SettingsContext";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Control+",
  description: "Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0b1221] text-[#e8eefc]`}>
        <SettingsProvider>{children}</SettingsProvider>
      </body>
    </html>
  );
}
