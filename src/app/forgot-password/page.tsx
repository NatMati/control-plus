"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, ArrowRight, ArrowLeft } from "lucide-react";

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
  * { font-family: 'DM Sans', sans-serif; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes glow {
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50%       { opacity: 0.7; transform: scale(1.05); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-6px); }
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .fade-up-1 { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) .05s both; }
  .fade-up-2 { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) .12s both; }
  .fade-up-3 { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) .19s both; }
  .fade-up-4 { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) .26s both; }
  .fade-up-5 { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) .33s both; }

  .logo-float { animation: float 4s ease-in-out infinite; }

  .input-field {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    transition: border-color .2s, background .2s, box-shadow .2s;
    color: white;
    outline: none;
    width: 100%;
    padding: .625rem .875rem .625rem 2.5rem;
    border-radius: .625rem;
    font-size: .875rem;
  }
  .input-field::placeholder { color: rgba(148,163,184,.45); }
  .input-field:focus {
    border-color: rgba(13,148,136,.55);
    background: rgba(13,148,136,.04);
    box-shadow: 0 0 0 3px rgba(13,148,136,.08);
  }

  .shimmer-btn {
    background: linear-gradient(135deg, #0d9488, #2563eb, #0d9488);
    background-size: 200% auto;
    animation: shimmer 3s linear infinite;
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  .shimmer-btn:hover { animation-duration: 1.5s; }
  .shimmer-btn:disabled { animation: none; background: rgba(255,255,255,0.08); }
`;

function BgDecorations() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full opacity-[0.07]"
        style={{ background: "radial-gradient(ellipse,#0d9488,transparent 70%)", animation: "glow 6s ease-in-out infinite" }}/>
      <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] rounded-full opacity-[0.05]"
        style={{ background: "radial-gradient(ellipse,#2563eb,transparent 70%)", animation: "glow 8s ease-in-out 2s infinite" }}/>
      <div className="absolute inset-0 opacity-[0.012]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)", backgroundSize: "60px 60px" }}/>
      <div className="absolute top-0 right-[30%] w-px h-full opacity-[0.04]"
        style={{ background: "linear-gradient(to bottom,transparent,#0d9488 40%,#2563eb 60%,transparent)" }}/>
    </div>
  );
}

export default function ForgotPasswordPage() {
  const router  = useRouter();
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [sent,    setSent]    = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) { setError("Ingresá tu correo electrónico."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "reset_password", email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Error al enviar el enlace.");
      setSent(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Estado: enlace enviado ────────────────────────────────────────────────
  if (sent) {
    return (
      <>
        <style>{STYLE}</style>
        <main className="flex items-center justify-center min-h-screen px-4"
          style={{ background: "linear-gradient(160deg,#020810 0%,#040d1c 60%,#030a15 100%)" }}>
          <BgDecorations/>
          <div className="relative z-10 w-full max-w-md text-center fade-up-1">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center text-2xl"
              style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)", boxShadow: "0 0 40px rgba(13,148,136,.35)" }}>
              🔑
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Revisá tu correo</h2>
            <p className="text-sm text-slate-400 mb-8 leading-relaxed">
              Si el correo <strong className="text-slate-300">{email}</strong> está registrado, te enviamos un enlace para restablecer tu contraseña. Puede tardar unos minutos.
            </p>
            <button onClick={() => router.push("/login")}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-80"
              style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}>
              Volver al inicio de sesión
            </button>
          </div>
        </main>
      </>
    );
  }

  // ── Formulario ────────────────────────────────────────────────────────────
  return (
    <>
      <style>{STYLE}</style>
      <main className="flex items-center justify-center min-h-screen px-4 py-12"
        style={{ background: "linear-gradient(160deg,#020810 0%,#040d1c 60%,#030a15 100%)" }}>
        <BgDecorations/>

        <div className="relative z-10 w-full max-w-md">

          {/* Logo */}
          <div className="text-center mb-8 fade-up-1">
            <div className="logo-float inline-flex w-14 h-14 rounded-2xl items-center justify-center text-xl font-black text-white mb-4"
              style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)", boxShadow: "0 0 40px rgba(13,148,136,.3), 0 0 80px rgba(37,99,235,.15)" }}>
              C+
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Recuperar contraseña</h1>
              <p className="text-sm text-slate-500 mt-1">Te enviamos un enlace a tu correo</p>
            </div>
          </div>

          {/* Card */}
          <div className="rounded-2xl p-7 fade-up-2"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)" }}>

            <form onSubmit={handleSubmit} className="space-y-4">

              <div className="fade-up-3">
                <label htmlFor="email" className="block text-xs font-medium text-slate-400 mb-1.5">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none"/>
                  <input
                    id="email" type="email" required
                    className="input-field"
                    placeholder="correo@ejemplo.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(null); }}
                    autoComplete="email"
                  />
                </div>
              </div>

              {error && (
                <div className="fade-up-4 flex items-start gap-2 text-xs text-red-400 px-3 py-2.5 rounded-xl"
                  style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)" }}>
                  <span className="shrink-0 mt-0.5">✕</span>{error}
                </div>
              )}

              <div className="fade-up-4 pt-1">
                <button type="submit" disabled={loading}
                  className="shimmer-btn w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.01] active:scale-[.99] disabled:scale-100">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white"
                        style={{ animation: "spin .7s linear infinite" }}/>
                      Enviando...
                    </span>
                  ) : (
                    <>Enviar enlace de recuperación <ArrowRight className="w-3.5 h-3.5"/></>
                  )}
                </button>
              </div>
            </form>
          </div>

          <p className="text-center text-xs text-slate-600 mt-5 fade-up-5">
            <button onClick={() => router.push("/login")}
              className="text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1.5">
              <ArrowLeft className="w-3 h-3"/> Volver al inicio de sesión
            </button>
          </p>
        </div>
      </main>
    </>
  );
}
