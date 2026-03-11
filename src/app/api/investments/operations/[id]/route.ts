import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PatchBody = {
  date?: string; // "YYYY-MM-DD"
  side?: "BUY" | "SELL";
  quantity?: number;
  price?: number;
  fee?: number;
};

function isIsoDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = params.id;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const patch: any = {};

  if (typeof body.date === "string") {
    if (!isIsoDate(body.date)) {
      return NextResponse.json({ error: "Fecha inválida (YYYY-MM-DD)" }, { status: 400 });
    }
    patch.date = body.date;
  }

  if (typeof body.side === "string") {
    if (body.side !== "BUY" && body.side !== "SELL") {
      return NextResponse.json({ error: "side inválido (BUY/SELL)" }, { status: 400 });
    }
    patch.side = body.side;
  }

  if (typeof body.quantity === "number") {
    if (!Number.isFinite(body.quantity) || body.quantity <= 0) {
      return NextResponse.json({ error: "quantity inválida" }, { status: 400 });
    }
    patch.quantity = body.quantity;
  }

  if (typeof body.price === "number") {
    if (!Number.isFinite(body.price) || body.price <= 0) {
      return NextResponse.json({ error: "price inválido" }, { status: 400 });
    }
    patch.price = body.price;
  }

  if (typeof body.fee === "number") {
    if (!Number.isFinite(body.fee) || body.fee < 0) {
      return NextResponse.json({ error: "fee inválido" }, { status: 400 });
    }
    patch.fee = body.fee;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  // IMPORTANTE:
  // 1) Ideal: RLS ya debe impedir tocar operaciones de otro user.
  // 2) Igual filtramos por user_id como capa extra.
  const { data, error } = await supabase
    .from("investment_operations") // <-- ajustá si tu tabla tiene otro nombre
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, symbol, date, side, quantity, price, fee")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Error actualizando operación" },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, operation: data });
}
