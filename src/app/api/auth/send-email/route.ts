// src/app/api/auth/send-email/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import {
  magicLinkEmail,
  resetPasswordEmail,
  confirmRegistrationEmail,
  inviteUserEmail,
} from "@/lib/emails/templates";

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM   = "Control+ <no-reply@controlplus.dev>";
const SITE   = process.env.NEXT_PUBLIC_SITE_URL ?? "https://controlplus.dev";

// Admin client — solo server
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, email } = body as { type: string; email: string };

    if (!type || !email) {
      return NextResponse.json({ error: "Faltan parámetros." }, { status: 400 });
    }

    const supabase = adminClient();

    // ── Magic link ────────────────────────────────────────────────────────────
    if (type === "magic_link") {
      const { data, error } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: `${SITE}/auth/callback` },
      });
      if (error || !data?.properties?.action_link) {
        return NextResponse.json({ error: error?.message ?? "No se pudo generar el enlace." }, { status: 400 });
      }
      await resend.emails.send({
        from: FROM,
        to: email,
        subject: "Tu enlace de acceso a Control+",
        html: magicLinkEmail(email, data.properties.action_link),
      });
      return NextResponse.json({ ok: true });
    }

    // ── Reset de contraseña ───────────────────────────────────────────────────
    if (type === "reset_password") {
      const { data, error } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${SITE}/auth/reset` },
      });
      if (error || !data?.properties?.action_link) {
        return NextResponse.json({ error: error?.message ?? "No se pudo generar el enlace." }, { status: 400 });
      }
      await resend.emails.send({
        from: FROM,
        to: email,
        subject: "Restablecer contraseña de Control+",
        html: resetPasswordEmail(email, data.properties.action_link),
      });
      return NextResponse.json({ ok: true });
    }

    // ── Confirmación de registro ──────────────────────────────────────────────
    if (type === "confirm_signup") {
      const { data, error } = await supabase.auth.admin.generateLink({
        type: "signup",
        email,
        password: body.password ?? "",
        options: { redirectTo: `${SITE}/auth/callback` },
      });
      if (error || !data?.properties?.action_link) {
        return NextResponse.json({ error: error?.message ?? "No se pudo crear la cuenta." }, { status: 400 });
      }
      await resend.emails.send({
        from: FROM,
        to: email,
        subject: "Confirmá tu cuenta en Control+",
        html: confirmRegistrationEmail(email, data.properties.action_link),
      });
      return NextResponse.json({ ok: true });
    }

    // ── Invitación de usuario ─────────────────────────────────────────────────
    if (type === "invite") {
      const { invitedBy } = body as { invitedBy?: string };
      const { data, error } = await supabase.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo: `${SITE}/auth/callback` },
      });
      if (error || !data?.properties?.action_link) {
        return NextResponse.json({ error: error?.message ?? "No se pudo generar la invitación." }, { status: 400 });
      }
      await resend.emails.send({
        from: FROM,
        to: email,
        subject: "Te invitaron a Control+",
        html: inviteUserEmail(email, data.properties.action_link, invitedBy),
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Tipo de email no reconocido." }, { status: 400 });

  } catch (e: any) {
    console.error("[send-email]", e);
    return NextResponse.json({ error: e?.message ?? "Error interno." }, { status: 500 });
  }
}
