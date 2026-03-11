// src/app/api/admin/set-password/route.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Body = {
  userId: string;
  newPassword: string;
  token: string; // guard simple
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<Body>;

    if (!body.token || body.token !== process.env.ADMIN_RESET_TOKEN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!body.userId || !body.newPassword) {
      return NextResponse.json(
        { error: "Faltan campos (userId, newPassword)" },
        { status: 400 }
      );
    }
    if (body.newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password muy corta (min 8)" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data, error } = await admin.auth.admin.updateUserById(body.userId, {
      password: body.newPassword,
      email_confirm: true,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, user: data.user }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Error interno", details: e?.message },
      { status: 500 }
    );
  }
}
