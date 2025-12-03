import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

// Función principal para enviar emails
export async function sendEmail(to: string, subject: string, html: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "Control+ <onboarding@resend.dev>",
      to,
      subject,
      html,
      // 👇 nombre correcto según el tipo de Resend
      replyTo: process.env.REPLY_TO || "soporte@controlplus.dev",
    });

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
