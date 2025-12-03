// src/lib/email/sendEmail.ts
// Versión temporal para despliegue: los emails están deshabilitados.
// Esto permite que Vercel compile sin errores mientras terminamos la integración real con Resend.

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  console.log("📧 [STUB] Email deshabilitado en esta build:", {
    to,
    subject,
    htmlPreview: html?.slice(0, 80) ?? "",
  });
}
