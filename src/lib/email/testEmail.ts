import { config } from "dotenv";
config({ path: ".env.local" });

import { sendEmail } from "./sendEmail";

(async () => {
  console.log("✅ Enviando email de prueba...");
  await sendEmail(
    "maticastrillejo@gmail.com",
    "Prueba desde Control+ (Resend)",
    `
      <div style="font-family: Arial, sans-serif; color:#333;">
        <h2>Hola Mati!</h2>
        <p>Este es un email de prueba enviado desde tu proyecto <b>Control+</b> usando Resend.</p>
        <p>Si lo ves en tu bandeja, ¡todo funciona! ✅</p>
      </div>
    `
  );
})();
