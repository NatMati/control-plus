// src/app/privacidad/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Política de Privacidad · Control+",
  description: "Política de privacidad y tratamiento de datos personales de Control+, conforme a la Ley 18.331 de Uruguay.",
};

const LAST_UPDATED = "10 de marzo de 2025";
const COMPANY = "Control+ SAS";
const EMAIL = "soporte@controlmas.app";
const APP_NAME = "Control+";

const sections = [
  {
    id: "responsable",
    title: "1. Responsable del tratamiento",
    content: `${COMPANY} (en adelante, "nosotros" o "Control+") es responsable del tratamiento de los datos personales recabados a través de la aplicación ${APP_NAME}, conforme a lo establecido en la Ley N° 18.331 de Protección de Datos Personales y su decreto reglamentario N° 414/009 de la República Oriental del Uruguay.

Para consultas relacionadas con el tratamiento de tus datos podés contactarnos en: ${EMAIL}.`,
  },
  {
    id: "datos",
    title: "2. Datos que recopilamos",
    content: `Recopilamos únicamente los datos necesarios para brindarte el servicio:

• Datos de cuenta: dirección de correo electrónico y contraseña (almacenada de forma cifrada).
• Datos financieros personales: cuentas bancarias, movimientos de ingresos y gastos, deudas e inversiones que vos mismo cargás en la aplicación.
• Datos de uso: fecha y hora de acceso, tipo de dispositivo y sistema operativo, con fines de mejora del servicio.
• Datos de pago: si contratás un plan pago, los datos de tarjeta son procesados directamente por Stripe Inc. y no son almacenados en nuestros servidores.`,
  },
  {
    id: "finalidad",
    title: "3. Finalidad del tratamiento",
    content: `Tus datos son utilizados exclusivamente para:

• Prestarte el servicio de gestión financiera personal que ofrecemos.
• Procesar pagos y gestionar tu suscripción.
• Enviarte comunicaciones relacionadas con el servicio (actualizaciones, alertas de seguridad).
• Mejorar la experiencia de uso a través del análisis agregado y anónimo de patrones de uso.

No utilizamos tus datos financieros personales para fines publicitarios ni los compartimos con terceros con fines comerciales.`,
  },
  {
    id: "ia",
    title: "4. Uso de inteligencia artificial",
    content: `${APP_NAME} cuenta con Nito ✦, un asistente financiero basado en inteligencia artificial. Para brindar respuestas contextualizadas, Nito procesa datos de tus cuentas, movimientos y deudas en cada conversación.

Los mensajes enviados a Nito son procesados por Anthropic PBC a través de su API. Anthropic no almacena estos datos para entrenar sus modelos según su política de uso de datos para clientes API. Los estados de cuenta (PDF o imágenes) que adjuntés son procesados en el momento y no se almacenan en nuestros servidores.`,
  },
  {
    id: "base",
    title: "5. Base legal del tratamiento",
    content: `El tratamiento de tus datos se basa en:

• Tu consentimiento expreso al registrarte y aceptar estos términos.
• La ejecución del contrato de prestación del servicio.
• El cumplimiento de obligaciones legales aplicables.

Podés revocar tu consentimiento en cualquier momento, lo que implicará la cancelación de tu cuenta y la eliminación de tus datos conforme al punto 7.`,
  },
  {
    id: "terceros",
    title: "6. Terceros y transferencias internacionales",
    content: `Para operar el servicio trabajamos con los siguientes proveedores de confianza:

• Supabase Inc. (Estados Unidos) — almacenamiento de datos y autenticación.
• Stripe Inc. (Estados Unidos) — procesamiento de pagos.
• Anthropic PBC (Estados Unidos) — procesamiento de IA para Nito ✦.

Todos estos proveedores cumplen con estándares internacionales de seguridad (SOC 2, ISO 27001 o equivalentes). Las transferencias internacionales de datos se realizan con las salvaguardas adecuadas conforme al artículo 23 de la Ley 18.331.`,
  },
  {
    id: "derechos",
    title: "7. Tus derechos (ARCO)",
    content: `Conforme a la Ley 18.331, tenés derecho a:

• Acceso: solicitar información sobre los datos que tenemos sobre vos.
• Rectificación: corregir datos inexactos o incompletos.
• Cancelación: solicitar la eliminación de tus datos personales.
• Oposición: oponerte al tratamiento de tus datos en determinadas circunstancias.

Para ejercer estos derechos escribinos a ${EMAIL} con el asunto "Derechos ARCO" indicando tu nombre y el derecho que querés ejercer. Responderemos dentro de los 5 días hábiles.

También podés presentar una denuncia ante la Unidad Reguladora y de Control de Datos Personales (URCDP) en www.gub.uy/urcdp.`,
  },
  {
    id: "retencion",
    title: "8. Retención de datos",
    content: `Conservamos tus datos mientras tu cuenta esté activa. Si cancelás tu cuenta:

• Los datos financieros personales se eliminan dentro de los 30 días.
• Los datos de facturación se conservan por el plazo legal de 5 años conforme a la normativa tributaria uruguaya.
• Los registros de seguridad se conservan por 90 días.

Podés solicitar la eliminación anticipada escribiéndonos a ${EMAIL}.`,
  },
  {
    id: "seguridad",
    title: "9. Seguridad",
    content: `Implementamos medidas técnicas y organizativas para proteger tus datos:

• Cifrado en tránsito (TLS 1.2+) y en reposo.
• Autenticación segura con hash de contraseñas (bcrypt).
• Control de acceso por filas (Row Level Security) en base de datos.
• Acceso restringido a datos por parte del personal.

Sin embargo, ningún sistema es 100% seguro. En caso de brecha de seguridad que afecte tus datos, te notificaremos dentro de las 72 horas conforme a la normativa vigente.`,
  },
  {
    id: "menores",
    title: "10. Menores de edad",
    content: `${APP_NAME} está dirigida a personas mayores de 18 años. No recopilamos conscientemente datos de menores de edad. Si tomamos conocimiento de que un menor nos ha proporcionado datos personales, los eliminaremos de inmediato.`,
  },
  {
    id: "cambios",
    title: "11. Cambios en esta política",
    content: `Podemos actualizar esta política periódicamente. Cuando realicemos cambios significativos te notificaremos por correo electrónico o mediante un aviso destacado en la aplicación con al menos 15 días de anticipación. El uso continuado del servicio después de esa fecha implica la aceptación de los cambios.`,
  },
];

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg,#020810 0%,#040d1c 60%,#030a15 100%)" }}>

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-4xl mx-auto">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)" }}>C+</div>
          <span className="text-white font-bold text-sm">{APP_NAME}</span>
        </Link>
        <Link href="/terminos" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
          Términos de uso →
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pb-20">

        {/* Header */}
        <div className="py-12 border-b mb-10" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-teal-400 mb-4"
            style={{ border: "1px solid rgba(13,148,136,0.25)", background: "rgba(13,148,136,0.06)" }}>
            🔒 Ley 18.331 · Uruguay
          </div>
          <h1 className="text-3xl font-black text-white mb-3">Política de Privacidad</h1>
          <p className="text-slate-400 text-sm">
            Última actualización: <span className="text-slate-300">{LAST_UPDATED}</span>
          </p>
          <p className="text-slate-500 text-sm mt-2 max-w-2xl">
            En {APP_NAME} tomamos tu privacidad en serio. Esta política explica qué datos recopilamos,
            cómo los usamos y cuáles son tus derechos conforme a la legislación uruguaya.
          </p>
        </div>

        {/* Índice */}
        <div className="mb-10 p-5 rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Contenido</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {sections.map(s => (
              <a key={s.id} href={`#${s.id}`}
                className="text-xs text-slate-500 hover:text-teal-400 transition-colors py-0.5">
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

        {/* Contacto */}
        <div className="mt-14 p-6 rounded-2xl" style={{ border: "1px solid rgba(13,148,136,0.2)", background: "rgba(13,148,136,0.04)" }}>
          <div className="text-sm font-bold text-teal-400 mb-1">¿Tenés preguntas?</div>
          <p className="text-xs text-slate-400 mb-3">Escribinos y te respondemos dentro de los 5 días hábiles.</p>
          <a href={`mailto:${EMAIL}`}
            className="inline-flex items-center gap-2 text-xs font-medium text-white px-4 py-2 rounded-xl transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)" }}>
            {EMAIL}
          </a>
        </div>

        <div className="mt-8 text-center text-xs text-slate-700">
          {COMPANY} · Montevideo, Uruguay · {APP_NAME} © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
