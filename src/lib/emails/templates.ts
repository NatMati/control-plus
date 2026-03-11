// src/lib/emails/templates.ts

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://controlplus.dev";

function layout(content: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Control+</title>
</head>
<body style="margin:0;padding:0;background:#020810;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#020810;min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 16px;">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Logo header -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#0d9488,#2563eb);border-radius:14px;padding:10px 14px;vertical-align:middle;">
                    <span style="font-size:18px;font-weight:900;color:white;letter-spacing:-0.5px;">C+</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:18px;font-weight:700;color:white;letter-spacing:-0.5px;">Control<span style="background:linear-gradient(135deg,#0d9488,#2563eb);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">+</span></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content card -->
          <tr>
            <td style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:40px 40px 36px;box-shadow:0 25px 60px rgba(0,0,0,0.5);">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0;font-size:11px;color:rgba(100,116,139,0.7);line-height:1.7;">
                Si no solicitaste este correo, podés ignorarlo.<br/>
                ¿Necesitás ayuda? Escribinos a <a href="mailto:soporte@controlplus.dev" style="color:#0d9488;text-decoration:none;">soporte@controlplus.dev</a>
              </p>
              <p style="margin:12px 0 0;font-size:10px;color:rgba(71,85,105,0.6);">
                © ${new Date().getFullYear()} Control+ · Todos los derechos reservados
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function gradientButton(href: string, label: string) {
  return `<table cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr>
      <td style="background:linear-gradient(135deg,#0d9488,#2563eb);border-radius:12px;box-shadow:0 8px 25px rgba(13,148,136,0.35);">
        <a href="${href}" style="display:inline-block;padding:14px 36px;font-size:14px;font-weight:700;color:white;text-decoration:none;letter-spacing:0.2px;white-space:nowrap;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

function divider() {
  return `<tr><td style="padding:24px 0;"><div style="height:1px;background:rgba(255,255,255,0.06);"></div></td></tr>`;
}

function checkItem(text: string) {
  return `<tr>
    <td style="padding:4px 0;">
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:20px;vertical-align:top;padding-top:1px;">
            <div style="width:14px;height:14px;background:linear-gradient(135deg,#0d9488,#2563eb);border-radius:4px;display:flex;align-items:center;justify-content:center;">
              <span style="color:white;font-size:9px;font-weight:bold;line-height:14px;padding-left:3px;">✓</span>
            </div>
          </td>
          <td style="padding-left:10px;font-size:13px;color:rgba(148,163,184,0.85);line-height:1.5;">${text}</td>
        </tr>
      </table>
    </td>
  </tr>`;
}

// ── 1. MAGIC LINK ─────────────────────────────────────────────────────────────

export function magicLinkEmail(email: string, link: string) {
  const content = `
    <!-- Icon -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-flex;width:56px;height:56px;background:linear-gradient(135deg,#0d9488,#2563eb);border-radius:16px;align-items:center;justify-content:center;box-shadow:0 0 40px rgba(13,148,136,0.3);">
        <span style="font-size:22px;">⚡</span>
      </div>
    </div>

    <!-- Heading -->
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:white;text-align:center;letter-spacing:-0.5px;">
      Tu enlace de acceso a Control+
    </h1>
    <p style="margin:0 0 28px;font-size:14px;color:rgba(100,116,139,0.8);text-align:center;line-height:1.6;">
      Hola <strong style="color:rgba(148,163,184,0.9);">${email}</strong>, aquí tenés tu enlace para iniciar sesión en <strong style="color:white;">Control+</strong>.
    </p>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:28px;">
      ${gradientButton(link, "Iniciar sesión →")}
    </div>

    <!-- Info boxes -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:4px;">
      ${checkItem("Inicio de sesión rápido y seguro.")}
      ${checkItem("El enlace es válido por 1 hora.")}
      ${checkItem("Podés solicitar uno nuevo en cualquier momento.")}
    </table>

    <!-- Fallback link -->
    <div style="margin-top:24px;padding:14px 16px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
      <p style="margin:0 0 6px;font-size:11px;color:rgba(100,116,139,0.6);text-transform:uppercase;letter-spacing:0.5px;">¿El botón no funciona? Copiá este enlace:</p>
      <p style="margin:0;font-size:11px;color:#0d9488;word-break:break-all;font-family:monospace;">${link}</p>
    </div>
  `;
  return layout(content);
}

// ── 2. RESET DE CONTRASEÑA ────────────────────────────────────────────────────

export function resetPasswordEmail(email: string, link: string) {
  const content = `
    <!-- Icon -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-flex;width:56px;height:56px;background:linear-gradient(135deg,#0d9488,#2563eb);border-radius:16px;align-items:center;justify-content:center;box-shadow:0 0 40px rgba(13,148,136,0.3);">
        <span style="font-size:22px;">🔑</span>
      </div>
    </div>

    <!-- Heading -->
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:white;text-align:center;letter-spacing:-0.5px;">
      Restablecer contraseña
    </h1>
    <p style="margin:0 0 28px;font-size:14px;color:rgba(100,116,139,0.8);text-align:center;line-height:1.6;">
      Recibimos una solicitud para restablecer la contraseña de <strong style="color:rgba(148,163,184,0.9);">${email}</strong>. Hacé clic en el botón para crear una nueva.
    </p>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:28px;">
      ${gradientButton(link, "Restablecer contraseña →")}
    </div>

    <!-- Warning -->
    <div style="padding:14px 16px;background:rgba(251,191,36,0.05);border:1px solid rgba(251,191,36,0.15);border-radius:10px;margin-bottom:16px;">
      <p style="margin:0;font-size:12px;color:rgba(251,191,36,0.8);line-height:1.6;">
        ⚠️ Este enlace vence en <strong>1 hora</strong>. Si no solicitaste este cambio, podés ignorar este correo — tu contraseña actual no cambiará.
      </p>
    </div>

    <!-- Fallback link -->
    <div style="padding:14px 16px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
      <p style="margin:0 0 6px;font-size:11px;color:rgba(100,116,139,0.6);text-transform:uppercase;letter-spacing:0.5px;">¿El botón no funciona? Copiá este enlace:</p>
      <p style="margin:0;font-size:11px;color:#0d9488;word-break:break-all;font-family:monospace;">${link}</p>
    </div>
  `;
  return layout(content);
}

// ── 3. CONFIRMACIÓN DE REGISTRO ───────────────────────────────────────────────

export function confirmRegistrationEmail(email: string, link: string) {
  const content = `
    <!-- Icon -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-flex;width:56px;height:56px;background:linear-gradient(135deg,#0d9488,#2563eb);border-radius:16px;align-items:center;justify-content:center;box-shadow:0 0 40px rgba(13,148,136,0.3);">
        <span style="font-size:22px;">✨</span>
      </div>
    </div>

    <!-- Heading -->
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:white;text-align:center;letter-spacing:-0.5px;">
      ¡Bienvenido a Control+!
    </h1>
    <p style="margin:0 0 28px;font-size:14px;color:rgba(100,116,139,0.8);text-align:center;line-height:1.6;">
      Tu cuenta <strong style="color:rgba(148,163,184,0.9);">${email}</strong> fue creada. Confirmá tu correo para empezar a controlar tus finanzas.
    </p>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:28px;">
      ${gradientButton(link, "Confirmar mi cuenta →")}
    </div>

    <!-- Features -->
    <div style="padding:16px;background:rgba(13,148,136,0.04);border:1px solid rgba(13,148,136,0.12);border-radius:12px;margin-bottom:16px;">
      <p style="margin:0 0 12px;font-size:12px;color:rgba(100,116,139,0.7);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Lo que te espera en Control+</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${checkItem("Seguimiento de inversiones en tiempo real")}
        ${checkItem("Presupuestos por categoría con alertas")}
        ${checkItem("Cashflow y calendario financiero")}
        ${checkItem("Nito ✦ — tu asistente financiero con IA")}
      </table>
    </div>

    <!-- Fallback link -->
    <div style="padding:14px 16px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
      <p style="margin:0 0 6px;font-size:11px;color:rgba(100,116,139,0.6);text-transform:uppercase;letter-spacing:0.5px;">¿El botón no funciona? Copiá este enlace:</p>
      <p style="margin:0;font-size:11px;color:#0d9488;word-break:break-all;font-family:monospace;">${link}</p>
    </div>
  `;
  return layout(content);
}

// ── 4. INVITACIÓN DE USUARIO ──────────────────────────────────────────────────

export function inviteUserEmail(email: string, link: string, invitedBy?: string) {
  const content = `
    <!-- Icon -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-flex;width:56px;height:56px;background:linear-gradient(135deg,#0d9488,#2563eb);border-radius:16px;align-items:center;justify-content:center;box-shadow:0 0 40px rgba(13,148,136,0.3);">
        <span style="font-size:22px;">🎉</span>
      </div>
    </div>

    <!-- Heading -->
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:white;text-align:center;letter-spacing:-0.5px;">
      Te invitaron a Control+
    </h1>
    <p style="margin:0 0 28px;font-size:14px;color:rgba(100,116,139,0.8);text-align:center;line-height:1.6;">
      ${invitedBy
        ? `<strong style="color:rgba(148,163,184,0.9);">${invitedBy}</strong> te invitó a unirte a <strong style="color:white;">Control+</strong>.`
        : `Recibiste una invitación para unirte a <strong style="color:white;">Control+</strong>.`
      }
      <br/>Tu acceso fue creado para <strong style="color:rgba(148,163,184,0.9);">${email}</strong>.
    </p>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:28px;">
      ${gradientButton(link, "Aceptar invitación →")}
    </div>

    <!-- Info -->
    <div style="padding:16px;background:rgba(37,99,235,0.04);border:1px solid rgba(37,99,235,0.12);border-radius:12px;margin-bottom:16px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${checkItem("El enlace de invitación vence en 24 horas.")}
        ${checkItem("Podés establecer tu contraseña al ingresar.")}
        ${checkItem("Acceso completo a todas las funciones de Control+.")}
      </table>
    </div>

    <!-- Fallback link -->
    <div style="padding:14px 16px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
      <p style="margin:0 0 6px;font-size:11px;color:rgba(100,116,139,0.6);text-transform:uppercase;letter-spacing:0.5px;">¿El botón no funciona? Copiá este enlace:</p>
      <p style="margin:0;font-size:11px;color:#0d9488;word-break:break-all;font-family:monospace;">${link}</p>
    </div>
  `;
  return layout(content);
}
