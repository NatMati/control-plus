// src/app/api/movements/cashflow/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildCashflowSankey, SankeyMovement } from "@/lib/sankey";

// GET /api/movements/cashflow?from=YYYY-MM&to=YYYY-MM
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const from = searchParams.get("from"); // YYYY-MM
    const to = searchParams.get("to");     // YYYY-MM

    // Validamos formato YYYY-MM
    if (!from || !/^\d{4}-\d{2}$/.test(from) || !to || !/^\d{4}-\d{2}$/.test(to)) {
      return NextResponse.json(
        { error: "Parámetros 'from' y 'to' inválidos. Formato esperado: YYYY-MM" },
        { status: 400 }
      );
    }

    // Rango de fechas completo del mes (desde el 1 del mes 'from' al último día del mes 'to')
    const [fromYear, fromMonth] = from.split("-");
    const [toYear, toMonth] = to.split("-");

    const fromDate = `${fromYear}-${fromMonth}-01`;
    const lastDay = new Date(Number(toYear), Number(toMonth), 0).getDate();
    const toDate = `${toYear}-${toMonth}-${String(lastDay).padStart(2, "0")}`;

    // 👇 Usamos el cliente de servidor con cookies → aplica RLS
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("movements")
      .select(
        `
        id,
        user_id,
        date,
        amount,
        type,
        movement_type,
        instrument_type,
        ticker,
        category,
        description,
        counterparty
      `
      )
      .gte("date", fromDate)
      .lte("date", toDate)
      .order("date", { ascending: true });

    if (error) {
      console.error("cashflow supabase error:", error);
      return NextResponse.json(
        { error: "Supabase error en cashflow route" },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as SankeyMovement[];

    const sankey = buildCashflowSankey(rows);

    return NextResponse.json(
      {
        rows,
        fromDate,
        toDate,
        sankey, // puede ser null si no se pudo armar el diagrama
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("cashflow route unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error en cashflow route" },
      { status: 500 }
    );
  }
}
