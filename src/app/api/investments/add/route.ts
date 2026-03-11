import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // ✅ Esto aparece en tu terminal (CMD) en local
    console.log("🟢 [INVESTMENTS/ADD]", body);

    const symbol = String(body?.symbol || "").trim();
    const quantity = Number(body?.quantity);
    const buyPrice = Number(body?.buyPrice);

    if (!symbol) return NextResponse.json({ error: "symbol requerido" }, { status: 400 });
    if (!Number.isFinite(quantity) || quantity <= 0)
      return NextResponse.json({ error: "quantity inválida" }, { status: 400 });
    if (!Number.isFinite(buyPrice) || buyPrice <= 0)
      return NextResponse.json({ error: "buyPrice inválido" }, { status: 400 });

    // MVP: por ahora solo loguea. Luego lo conectamos a Supabase/DB.
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("🔴 [INVESTMENTS/ADD] ERROR", e);
    return NextResponse.json({ error: "error interno" }, { status: 500 });
  }
}
