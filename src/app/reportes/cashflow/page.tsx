// src/app/reportes/cashflow/page.tsx
import { Suspense } from "react";
import CashflowPageClient from "./page.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CashflowPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-slate-400 px-4 py-6">Cargando cashflow…</div>
      }
    >
      <CashflowPageClient />
    </Suspense>
  );
}
