import { config } from "dotenv";
config({ path: ".env.local" }); // 🔐 Carga las variables del archivo .env.local

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Función principal para enviar emails
export async function sendEmail(to: string, subject: string, html: string) {
  try {
    const data = await resend.emails.send({
      from: process.env.EMAIL_FROM || "Control+ <onboarding@resend.dev>",
      to,
      subject,
      html,
      reply_to: process.env.REPLY_TO || "soporte@controlplus.dev",
    });

    console.log("✅ Email enviado:", data);
  } catch (error) {
    console.error("❌ Error enviando email:", error);
  }
}

// --- Test temporal: ejecuta el envío si el archivo se corre directamente ---
if (require.main === module) {
  const destinatario = "maticastrillejo@gmail.com";
  const asunto = "🚀 Prueba directa desde sendEmail.ts";
  const html = `
    <h2>Hola Mati 👋</h2>
    <p>Este correo fue enviado directamente desde el archivo <b>sendEmail.ts</b>.</p>
    <p>Si lo estás leyendo, el sistema funciona perfecto 😎.</p>
  `;

  // 🔽 Llamamos a la función solo si ejecutamos este archivo directamente
  sendEmail(destinatario, asunto, html);
}