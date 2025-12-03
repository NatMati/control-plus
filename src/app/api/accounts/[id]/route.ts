// src/app/api/accounts/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = {
  params: {
    id: string;
  };
};

/**
 * DELETE /api/accounts/:id
 *
 * Elimina una cuenta del usuario autenticado.
 * Si la cuenta tiene movimientos asociados, devuelve 409 y no la borra.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const supabase = await createClient();
  const accountId = params.id;

  // 1) Usuario actual
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // 2) Verificar si la cuenta tiene movimientos asociados
  const { count, error: countError } = await supabase
    .from("movements")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", user.id)
    .eq("account_id", accountId);

  if (countError) {
    console.error("Error contando movimientos de la cuenta:", countError);
    return NextResponse.json(
      { error: "No se pudo verificar los movimientos de la cuenta" },
      { status: 500 }
    );
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "No podés eliminar esta cuenta porque tiene movimientos asociados.",
      },
      { status: 409 }
    );
  }

  // 3) Eliminar la cuenta del usuario
  const { error: deleteError } = await supabase
    .from("accounts")
    .delete()
    .eq("id", accountId)
    .eq("user_id", user.id);

  if (deleteError) {
    console.error("DELETE /api/accounts/[id] error:", deleteError);
    return NextResponse.json(
      { error: deleteError.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
