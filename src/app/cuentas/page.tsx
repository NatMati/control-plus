// src/app/cuentas/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AccountsClient from "./AccountsClient";

export default async function CuentasPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/login");

  const { data, error: accErr } = await supabase
    .from("accounts")
    .select("id, name, currency, type, role, balance, balance_updated_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (accErr) {
    // si querés, podés renderizar un estado de error más lindo
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-700 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          Error cargando cuentas: {accErr.message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <AccountsClient initialAccounts={(data ?? []) as any[]} />
    </div>
  );
}
