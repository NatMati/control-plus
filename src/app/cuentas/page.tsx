// src/app/cuentas/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AccountsClient from "./AccountsClient";

type AccountBalanceRow = {
  account_id: string;
  name: string;
  currency: string;
  type: string;
  role: string | null;
  is_archived: boolean;
  balance_snapshot: number;
  balance_updated_at: string | null;
  movements_delta: number;
  balance_real: number;
};

export default async function CuentasPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/login");

  // Leemos desde la VIEW que ya creaste: public.v_account_balances
  const { data, error: viewErr } = await supabase
    .from("v_account_balances")
    .select(
      "account_id, name, currency, type, role, is_archived, balance_snapshot, balance_updated_at, movements_delta, balance_real"
    )
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .order("name", { ascending: true });

  if (viewErr) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-700 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          Error cargando cuentas: {viewErr.message}
        </div>
      </div>
    );
  }

  const initialAccounts = (data ?? []).map((r: AccountBalanceRow) => ({
    id: r.account_id,
    name: r.name ?? "Cuenta",
    currency: String(r.currency ?? "UYU").toUpperCase(),
    type: String(r.type ?? "BANK").toUpperCase(),
    role: String(r.role ?? "CHECKING").toUpperCase(),
    balance: Number(r.balance_snapshot ?? 0),
    balance_updated_at: r.balance_updated_at,
    created_at: null,
    balance_calculated: Number(r.balance_real ?? 0),
    movements_delta: Number(r.movements_delta ?? 0),
  }));

  return (
    <div className="p-6">
      <AccountsClient initialAccounts={initialAccounts as any[]} />
    </div>
  );
}
