import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    // Forzamos el tipo para permitir reply_to sin romper la build
    const payload: any = {
      from: process.env.EMAIL_FROM || "Control+ <onboarding@resend.dev>",
      to,
      subject,
      html,
      reply_to: process.env.REPLY_TO || "soporte@controlplus.dev",
    };

    const { data, error } = await resend.emails.send(payload);

    if (error) {
      console.error("❌ Error enviando email:", error);
      throw error;
    }

    console.log("✅ Email enviado:", data);
  } catch (error) {
    console.error("❌ Error enviando email (catch):", error);
    throw error;
  }
}
