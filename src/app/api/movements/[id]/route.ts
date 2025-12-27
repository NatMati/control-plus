import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

// Validación simple de UUID (evita DELETEs raros)
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const movementId = (id ?? "").trim();

  if (!movementId || typeof movementId !== "string" || !UUID_RE.test(movementId)) {
    return NextResponse.json(
      { error: "ID de movimiento inválido" },
      { status: 400 }
    );
  }

  const supabase = await createApiClient();

  // 1) Usuario autenticado (necesario para que RLS funcione con auth.uid())
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("[movements][DELETE] auth.getUser error:", userError);
    return NextResponse.json({ error: "Error auth" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // 2) Borrado
  // Importante:
  // - Con RLS, a veces NO hay "error": simplemente count = 0 (no borró nada)
  // - No necesitás filtrar por user_id si tu política RLS ya hace:
  //   USING (user_id = auth.uid())
  //   (y de hecho evita inconsistencias si alguna fila tiene user_id distinto)
  const { error, count } = await supabase
    .from("movements")
    .delete({ count: "exact" })
    .eq("id", movementId);

  if (error) {
    console.error("[movements][DELETE] supabase delete error:", error);

    // Si querés, podés mapear algunos códigos a 403; por defecto devolvemos 403
    // porque suele ser permisos / RLS.
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 403 }
    );
  }

  // 3) Si count === 0 => existe pero no lo ve/borró (RLS) o no existe
  if (!count) {
    return NextResponse.json(
      { error: "Movimiento no encontrado o sin permisos" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { ok: true, deletedId: movementId },
    { status: 200 }
  );
}
