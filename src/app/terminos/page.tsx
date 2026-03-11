// src/app/terminos/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Términos de Uso · Control+",
  description: "Términos y condiciones de uso de Control+.",
};

const LAST_UPDATED = "10 de marzo de 2025";
const COMPANY = "Control+ SAS";
const EMAIL = "soporte@controlmas.app";
const APP_NAME = "Control+";

const sections = [
  {
    id: "aceptacion",
    title: "1. Aceptación de los términos",
    content: `Al registrarte y usar ${APP_NAME} aceptás estos Términos de Uso en su totalidad. Si no estás de acuerdo con alguna parte, no podés usar el servicio.

Estos términos constituyen un acuerdo legal entre vos y ${COMPANY}, titular de ${APP_NAME}, con domicilio en la República Oriental del Uruguay.`,
  },
  {
    id: "servicio",
    title: "2. Descripción del servicio",
    content: `${APP_NAME} es una aplicación de gestión financiera personal que te permite registrar y analizar tus ingresos, gastos, deudas e inversiones. El servicio incluye:

• Registro manual de movimientos financieros.
• Importación de estados de cuenta bancarios mediante inteligencia artificial (planes pagos).
• Nito ✦, asistente financiero con IA (planes pagos).
• Reportes y visualizaciones de tu situación financiera.

${APP_NAME} es una herramienta de organización personal. No constituye asesoramiento financiero, legal ni tributario profesional.`,
  },
  {
    id: "cuenta",
    title: "3. Tu cuenta",
    content: `Para usar ${APP_NAME} necesitás crear una cuenta con un email válido. Sos responsable de:

• Mantener la confidencialidad de tu contraseña.
• Todas las actividades que ocurran bajo tu cuenta.
• Notificarnos inmediatamente si detectás acceso no autorizado a ${EMAIL}.

Podemos suspender o cancelar tu cuenta si detectamos uso fraudulento, violación de estos términos o actividad que pueda perjudicar a otros usuarios o al servicio.`,
  },
  {
    id: "planes",
    title: "4. Planes y pagos",
    content: `${APP_NAME} ofrece tres planes:

• Free: acceso gratuito con límite de 50 movimientos por mes.
• Pro (U$S 8/mes): movimientos ilimitados, Nito ✦ completo e importador IA.
• Deluxe (U$S 15/mes): todo lo de Pro más módulos de inversiones, seguros y patrimonio avanzado.

Los pagos se procesan en dólares americanos (USD) a través de Stripe. Al suscribirte a un plan pago:

• Se realizará un cargo mensual automático en la fecha de renovación.
• Podés cancelar en cualquier momento desde tu perfil — el acceso se mantiene hasta el fin del período pagado.
• No realizamos reembolsos por períodos parciales salvo casos excepcionales a nuestra discreción.
• Nos reservamos el derecho de modificar los precios con 30 días de aviso previo.`,
  },
  {
    id: "uso_aceptable",
    title: "5. Uso aceptable",
    content: `Al usar ${APP_NAME} te comprometés a no:

• Usar el servicio para actividades ilegales o fraudulentas.
• Intentar acceder a datos de otros usuarios.
• Realizar ingeniería inversa, descompilar o modificar el software.
• Usar el servicio para fines comerciales sin autorización expresa.
• Sobrecargar intencionalmente la infraestructura del servicio.
• Introducir malware, virus u otro código malicioso.

El incumplimiento puede resultar en la suspensión inmediata de tu cuenta sin derecho a reembolso.`,
  },
  {
    id: "datos",
    title: "6. Tus datos",
    content: `Sos el único propietario de los datos financieros que cargás en ${APP_NAME}. Nos otorgás una licencia limitada para procesar esos datos con el único fin de prestarte el servicio.

No vendemos, alquilamos ni compartimos tus datos financieros personales con terceros con fines comerciales. Para más información sobre el tratamiento de tus datos consultá nuestra Política de Privacidad.

Podés exportar o eliminar tus datos en cualquier momento contactándonos en ${EMAIL}.`,
  },
  {
    id: "ia",
    title: "7. Limitaciones del asistente IA (Nito ✦)",
    content: `Nito ✦ es un asistente de inteligencia artificial diseñado para ayudarte a organizar y analizar tus finanzas personales. Importante:

• Las respuestas de Nito son orientativas y no constituyen asesoramiento financiero profesional.
• No recomendamos acciones de inversión específicas ni prometemos rendimientos.
• Ante decisiones financieras importantes consultá a un profesional habilitado.
• La precisión de Nito depende de la calidad y completitud de los datos que cargues.

${COMPANY} no se responsabiliza por decisiones tomadas en base a las sugerencias de Nito ✦.`,
  },
  {
    id: "disponibilidad",
    title: "8. Disponibilidad del servicio",
    content: `Nos esforzamos por mantener ${APP_NAME} disponible 24/7, pero no garantizamos disponibilidad ininterrumpida. Podemos realizar mantenimientos programados con aviso previo o interrupciones de emergencia sin previo aviso.

No somos responsables por pérdidas derivadas de interrupciones del servicio fuera de nuestro control (fuerza mayor, fallas de proveedores de infraestructura, etc.).`,
  },
  {
    id: "propiedad",
    title: "9. Propiedad intelectual",
    content: `El software, diseño, marca, logotipos y contenido de ${APP_NAME} son propiedad de ${COMPANY} y están protegidos por las leyes de propiedad intelectual aplicables.

Se te otorga una licencia personal, no exclusiva, intransferible y revocable para usar la aplicación conforme a estos términos. No podés reproducir, distribuir ni crear obras derivadas sin autorización expresa.`,
  },
  {
    id: "limitacion",
    title: "10. Limitación de responsabilidad",
    content: `En la máxima medida permitida por la ley uruguaya, ${COMPANY} no será responsable por:

• Pérdidas financieras derivadas del uso o mal uso del servicio.
• Decisiones tomadas en base a información provista por ${APP_NAME} o Nito ✦.
• Daños indirectos, incidentales o consecuentes.
• Pérdida de datos por causas fuera de nuestro control razonable.

En ningún caso nuestra responsabilidad total superará el monto pagado por vos en los últimos 12 meses, o U$S 50 si no realizaste pagos.`,
  },
  {
    id: "modificaciones",
    title: "11. Modificaciones al servicio y a estos términos",
    content: `Nos reservamos el derecho de modificar, suspender o discontinuar el servicio o cualquier parte de él con o sin previo aviso.

Podemos actualizar estos términos periódicamente. Cambios significativos serán notificados por email o mediante aviso en la app con al menos 15 días de anticipación. El uso continuado implica aceptación.`,
  },
  {
    id: "jurisdiccion",
    title: "12. Jurisdicción y ley aplicable",
    content: `Estos términos se rigen por las leyes de la República Oriental del Uruguay. Cualquier disputa se someterá a la jurisdicción de los tribunales competentes de Montevideo, Uruguay, con renuncia a cualquier otro fuero.

Para disputas de consumo, podés recurrir al Área de Defensa del Consumidor (ADECO) del Ministerio de Economía y Finanzas del Uruguay.`,
  },
  {
    id: "contacto",
    title: "13. Contacto",
    content: `Para consultas, reclamos o ejercicio de derechos:\n\n${COMPANY}\nEmail: ${EMAIL}\nMontevideo, Uruguay`,
  },
];

export default function TerminosPage() {
  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg,#020810 0%,#040d1c 60%,#030a15 100%)" }}>

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-4xl mx-auto">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)" }}>C+</div>
          <span className="text-white font-bold text-sm">{APP_NAME}</span>
        </Link>
        <Link href="/privacidad" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
          Política de privacidad →
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pb-20">

        {/* Header */}
        <div className="py-12 border-b mb-10" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-blue-400 mb-4"
            style={{ border: "1px solid rgba(59,130,246,0.25)", background: "rgba(59,130,246,0.06)" }}>
            📋 Términos legales · Uruguay
          </div>
          <h1 className="text-3xl font-black text-white mb-3">Términos de Uso</h1>
          <p className="text-slate-400 text-sm">
            Última actualización: <span className="text-slate-300">{LAST_UPDATED}</span>
          </p>
          <p className="text-slate-500 text-sm mt-2 max-w-2xl">
            Leé estos términos antes de usar {APP_NAME}. Al registrarte estás aceptando estas condiciones.
          </p>
        </div>

        {/* Índice */}
        <div className="mb-10 p-5 rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Contenido</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {sections.map(s => (
              <a key={s.id} href={`#${s.id}`}
                className="text-xs text-slate-500 hover:text-blue-400 transition-colors py-0.5">
                {s.title}
              </a>
            ))}
          </div>
        </div>

        {/* Secciones */}
        <div className="space-y-10">
          {sections.map(s => (
            <section key={s.id} id={s.id}>
              <h2 className="text-base font-bold text-white mb-3">{s.title}</h2>
              <div className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{s.content}</div>
            </section>
          ))}
        </div>

        {/* Links cruzados */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/privacidad"
            className="p-5 rounded-2xl transition-all hover:opacity-80 group"
            style={{ border: "1px solid rgba(13,148,136,0.2)", background: "rgba(13,148,136,0.03)" }}>
            <div className="text-xs text-teal-400 font-bold mb-1">🔒 Política de Privacidad</div>
            <div className="text-xs text-slate-500">Cómo tratamos tus datos personales conforme a la Ley 18.331.</div>
          </Link>
          <a href={`mailto:${EMAIL}`}
            className="p-5 rounded-2xl transition-all hover:opacity-80"
            style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
            <div className="text-xs text-slate-300 font-bold mb-1">✉ Contacto</div>
            <div className="text-xs text-slate-500">{EMAIL}</div>
          </a>
        </div>

        <div className="mt-8 text-center text-xs text-slate-700">
          {COMPANY} · Montevideo, Uruguay · {APP_NAME} © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
