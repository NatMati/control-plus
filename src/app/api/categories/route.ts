// src/app/api/categories/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/categories?type=EXPENSE|INCOME (opcional)
export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "").toUpperCase(); // EXPENSE | INCOME

  let query = supabase
    .from("movements")
    .select("category, type")
    .eq("user_id", user.id)
    .not("category", "is", null);

  if (type === "EXPENSE" || type === "INCOME") {
    query = query.eq("type", type);
  }

  const { data, error } = await query;

  if (error) {
    console.error("GET /api/categories → Supabase error:", error);
    return NextResponse.json({ error: "Error al obtener categorías" }, { status: 500 });
  }

  const categories = Array.from(
    new Set(
      (data ?? [])
        .map((r) => (r.category ?? "").trim())
        .filter((c) => c.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b, "es"));

  return NextResponse.json({ categories }, { status: 200 });
}
