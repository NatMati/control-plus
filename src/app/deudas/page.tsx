// src/app/deudas/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DeudasClient from "./DeudasClient";

export default async function DeudasPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const { data: debtsData } = await supabase
    .from("debts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: accountsData } = await supabase
    .from("accounts")
    .select("id, name, currency")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .order("created_at", { ascending: true });

  return (
    <DeudasClient
      initialDebts={debtsData ?? []}
      accounts={accountsData ?? []}
    />
  );
}
