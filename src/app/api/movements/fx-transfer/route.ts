// src/app/api/movements/fx-transfer/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const date = body?.date;
    const fromAccountId = body?.fromAccountId;
    const toAccountId = body?.toAccountId;

    const fromAmount = Number(body?.fromAmount);
    const toAmount = Number(body?.toAmount);

    const description = (body?.description ?? "").trim() || null;

    const feeAmount = body?.feeAmount != null ? Number(body.feeAmount) : null;
    const feeCurrency = (body?.feeCurrency ?? "").trim() || null;

    if (!date || !fromAccountId || !toAccountId) {
      return NextResponse.json({ error: "Faltan campos (date/fromAccountId/toAccountId)" }, { status: 400 });
    }
    if (!Number.isFinite(fromAmount) || fromAmount <= 0 || !Number.isFinite(toAmount) || toAmount <= 0) {
      return NextResponse.json({ error: "Montos inválidos (fromAmount/toAmount)" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("create_fx_transfer", {
      p_date: date,
      p_from_account: fromAccountId,
      p_to_account: toAccountId,
      p_from_amount: fromAmount,
      p_to_amount: toAmount,
      p_description: description,
      p_fee_amount: feeAmount,
      p_fee_currency: feeCurrency,
    });

    if (error) {
      return NextResponse.json({ error: error.message, details: error.details, code: error.code }, { status: 400 });
    }

    return NextResponse.json({ ok: true, transfer_group_id: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: "Error interno", details: e?.message }, { status: 500 });
  }
}
