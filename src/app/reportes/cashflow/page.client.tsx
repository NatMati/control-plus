// src/app/reportes/cashflow/page.client.tsx
"use client";

import { useSearchParams } from "next/navigation";
import CashflowClient from "./CashflowClient";

function isValidYM(v: string | null) {
  return !!v && /^\d{4}-\d{2}$/.test(v);
}

export default function CashflowPageClient() {
  const searchParams = useSearchParams();

  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const from = isValidYM(searchParams.get("from")) ? (searchParams.get("from") as string) : currentYM;
  const to = isValidYM(searchParams.get("to")) ? (searchParams.get("to") as string) : currentYM;

  return <CashflowClient from={from} to={to} />;
}
