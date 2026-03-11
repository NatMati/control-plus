// src/app/api/transfers/fx/route.ts
import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type FxBody = {
  date: string;
  fromAccountId: string;
  toAccountId: string;
  fromAmount: number | string;
  toAmount: number | string;
  description?: string | null;
  feeAmount?: number | string | null;
  feeCurrency?: string | null;
};

function cleanStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function isUuid(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const s = v.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
}

export async function POST(req: Request) {
  const supabase = await createApiClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Partial<FxBody>;

    const date = cleanStr(body.date);
    const fromAccountId = cleanStr(body.fromAccountId);
    const toAccountId = cleanStr(body.toAccountId);

    const fromAmount = Number(body.fromAmount);
    const toAmount = Number(body.toAmount);

    const description = cleanStr(body.description) || null;

    const feeAmount =
      body.feeAmount === null || body.feeAmount === undefined
        ? null
        : Number(body.feeAmount);

    const feeCurrency =
      body.feeCurrency === null || body.feeCurrency === undefined
        ? null
        : cleanStr(body.feeCurrency) || null;

    // --- Validaciones básicas ---
    if (!date || !fromAccountId || !toAccountId) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios (date/fromAccountId/toAccountId)" },
        { status: 400 }
      );
    }

    if (!isUuid(fromAccountId) || !isUuid(toAccountId)) {
      return NextResponse.json(
        {
          error: "fromAccountId/toAccountId inválidos (UUID requerido)",
          requestedIds: [fromAccountId, toAccountId],
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(fromAmount) || fromAmount <= 0) {
      return NextResponse.json({ error: "fromAmount inválido" }, { status: 400 });
    }

    if (!Number.isFinite(toAmount) || toAmount <= 0) {
      return NextResponse.json({ error: "toAmount inválido" }, { status: 400 });
    }

    if (fromAccountId === toAccountId) {
      return NextResponse.json(
        { error: "Las cuentas deben ser distintas" },
        { status: 400 }
      );
    }

    if (feeAmount !== null && (!Number.isFinite(feeAmount) || feeAmount < 0)) {
      return NextResponse.json({ error: "feeAmount inválido" }, { status: 400 });
    }

    // --- RPC directo: dejamos que la función SQL valide ownership/existencia ---
    const args = {
      p_date: date,
      p_from_account: fromAccountId,
      p_to_account: toAccountId,
      p_from_amount: fromAmount,
      p_to_amount: toAmount,
      p_description: description,
      p_fee_amount: feeAmount,
      p_fee_currency: feeCurrency,
      p_user_id: user.id,
    };

    const { data, error } = await (supabase as any).rpc("create_fx_transfer", args);

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          userId: user.id,
          args,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, transfer_group_id: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Error interno", details: e?.message },
      { status: 500 }
    );
  }
}