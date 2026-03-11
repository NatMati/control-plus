// src/app/nito/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NitoChat from "@/components/NitoChat";

export const metadata = { title: "Nito ✦ — Control+" };

export default async function NitoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, currency")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("name");

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center text-lg font-bold text-white shadow-lg shadow-teal-500/20">
            ✦
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Nito ✦</h1>
            <p className="text-sm text-slate-400">Tu asistente financiero personal con contexto real.</p>
          </div>
        </div>
      </div>

      <NitoChat fullPage accounts={accounts ?? []} />
    </div>
  );
}
