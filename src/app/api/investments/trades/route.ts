// src/app/api/investments/trades/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!user)   return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const body = await req.json();

    const date      = String(body.date     || "").trim();
    const symbol    = String(body.symbol   || "").trim().toUpperCase();
    const side      = body.side === "BUY" || body.side === "SELL" ? body.side : null;
    const quantity  = Number(body.quantity);
    const price     = Number(body.price);
    const total_usd = Number(body.total_usd);
    const fee_usd   = body.fee_usd == null ? 0 : Number(body.fee_usd);

    if (!date)   return NextResponse.json({ error: "Fecha inválida."    }, { status: 400 });
    if (!symbol) return NextResponse.json({ error: "Símbolo inválido."  }, { status: 400 });
    if (!side)   return NextResponse.json({ error: "Side inválido."     }, { status: 400 });

    if (!Number.isFinite(quantity)  || quantity  <= 0) return NextResponse.json({ error: "Cantidad inválida."  }, { status: 400 });
    if (!Number.isFinite(price)     || price     <= 0) return NextResponse.json({ error: "Precio inválido."    }, { status: 400 });
    if (!Number.isFinite(total_usd) || total_usd <= 0) return NextResponse.json({ error: "Monto USD inválido." }, { status: 400 });
    if (!Number.isFinite(fee_usd)   || fee_usd   <  0) return NextResponse.json({ error: "Comisión inválida."  }, { status: 400 });

    const payload = {
      user_id:           user.id,
      date,
      symbol,
      side,
      quantity,
      price,
      total_usd,
      fee_usd,
      broker_account_id: body.broker_account_id ?? null,  // ← nuevo campo
      realized_pnl_usd:  body.realized_pnl_usd == null ? null : Number(body.realized_pnl_usd),
      note:              body.note ?? null,
    };

    const { data, error } = await supabase
      .from("investment_trades")
      .insert(payload)
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, id: data.id });

  } catch (e: unknown) {
    console.error("POST /api/investments/trades failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno guardando operación." },
      { status: 500 },
    );
  }
}
