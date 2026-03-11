// src/lib/emails/sendEmail.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = "Control+ <no-reply@controlplus.dev>";

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) throw new Error(error.message);
}
