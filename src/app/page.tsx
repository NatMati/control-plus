import type { Metadata } from "next";
import LandingClient from "./LandingClient";

export const metadata: Metadata = {
  title: "Control+ · Tu dinero gestionado al detalle",
  description:
    "Portfolio de inversiones, cashflow visual, presupuestos inteligentes y un asesor IA. El stack financiero completo para personas que quieren crecer.",
  openGraph: {
    title: "Control+ · Tu dinero gestionado al detalle",
    description:
      "Portfolio de inversiones, cashflow visual, presupuestos inteligentes y un asesor IA.",
    type: "website",
  },
};

export default function HomePage() {
  return <LandingClient />;
}
