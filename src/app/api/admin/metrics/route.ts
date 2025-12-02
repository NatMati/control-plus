import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET() {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error: "Variables de entorno faltantes",
          detail:
            "Revisa NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en tu .env.local",
        },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Total usuarios
    const { count: totalUsers, error: totalError } = await supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact", head: true });

    if (totalError) {
      console.error("Error totalUsers:", totalError);
      return NextResponse.json(
        {
          error: "Error cargando métricas (totalUsers)",
          detail: totalError.message,
        },
        { status: 500 }
      );
    }

    // Planes
    const { data: plans, error: planError } = await supabaseAdmin
      .from("user_plans")
      .select("user_id, plan, pro_expires_at, lifetime");

    if (planError) {
      console.error("Error user_plans:", planError);
      return NextResponse.json(
        {
          error: "Error cargando métricas (user_plans)",
          detail: planError.message,
        },
        { status: 500 }
      );
    }

    let freeUsers = 0;
    let proActiveUsers = 0;
    let proExpiredUsers = 0;
    let lifetimeUsers = 0;

    let paidThisMonth = 0;
    let unpaidThisMonth = 0;

    for (const p of plans ?? []) {
      if (p.plan === "free") {
        freeUsers++;
        continue;
      }

      if (p.lifetime === true) {
        lifetimeUsers++;
        paidThisMonth++;
        continue;
      }

      if (p.plan === "pro") {
        const exp = p.pro_expires_at ? new Date(p.pro_expires_at) : null;

        if (exp && exp > now) {
          proActiveUsers++;
        } else {
          proExpiredUsers++;
        }

        if (exp && exp >= firstDay && exp < nextMonth) {
          paidThisMonth++;
        } else {
          unpaidThisMonth++;
        }
      }
    }

    return NextResponse.json({
      totalUsers: totalUsers ?? 0,
      freeUsers,
      proActiveUsers,
      proExpiredUsers,
      lifetimeUsers,
      paidThisMonth,
      unpaidThisMonth,
      currency: "USD",
    });
  } catch (e: any) {
    console.error("Admin metrics fatal error:", e);
    return NextResponse.json(
      {
        error: "Error inesperado en métricas",
        detail: String(e?.message ?? e),
      },
      { status: 500 }
    );
  }
}
