"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import AccessCodeInput from "@/components/AccessCodeInput";

// ── Animaciones ───────────────────────────────────────────────────────────────
const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&family=DM+Mono:wght@400;500&display=swap');

  * { font-family: 'DM Sans', sans-serif; }
  .mono { font-family: 'DM Mono', monospace; }

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
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .fade-up-1 { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) .05s both; }
  .fade-up-2 { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) .12s both; }
  .fade-up-3 { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) .19s both; }
  .fade-up-4 { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) .26s both; }
  .fade-up-5 { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) .33s both; }
  .fade-up-6 { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) .40s both; }
  .fade-up-7 { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) .47s both; }

  .logo-float { animation: float 4s ease-in-out infinite; }

  .shimmer-btn {
    background: linear-gradient(135deg, #0d9488, #2563eb, #0d9488);
    background-size: 200% auto;
    animation: shimmer 3s linear infinite;
  }
  .shimmer-btn:hover { animation-duration: 1.5s; }
  .shimmer-btn:disabled { animation: none; background: rgba(255,255,255,0.08); }

  .input-field {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    transition: border-color .2s, background .2s, box-shadow .2s;
    color: white;
    outline: none;
    width: 100%;
    padding: .625rem .875rem;
    border-radius: .625rem;
    font-size: .875rem;
  }
  .input-field::placeholder { color: rgba(148,163,184,.45); }
  .input-field:focus {
    border-color: rgba(13,148,136,.55);
    background: rgba(13,148,136,.04);
    box-shadow: 0 0 0 3px rgba(13,148,136,.08);
  }

  .check-box {
    width: 18px; height: 18px; border-radius: 5px;
    border: 1.5px solid rgba(255,255,255,0.15);
    background: rgba(255,255,255,0.03);
    transition: all .2s;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .check-box.checked {
    background: linear-gradient(135deg,#0d9488,#2563eb);
    border-color: transparent;
    box-shadow: 0 0 10px rgba(13,148,136,.3);
  }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "transparent" };
  let s = 0;
  if (pw.length >= 8)  s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const map = [
    { label: "Muy débil", color: "#ef4444" },
    { label: "Débil",     color: "#f97316" },
    { label: "Regular",   color: "#eab308" },
    { label: "Buena",     color: "#22c55e" },
    { label: "Fuerte",    color: "#10b981" },
  ];
  return { score: s, ...map[s] };
}

function BgDecorations() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full opacity-[0.07]"
        style={{ background: "radial-gradient(ellipse,#0d9488,transparent 70%)", animation: "glow 6s ease-in-out infinite" }} />
      <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] rounded-full opacity-[0.05]"
        style={{ background: "radial-gradient(ellipse,#2563eb,transparent 70%)", animation: "glow 8s ease-in-out 2s infinite" }} />
      <div className="absolute inset-0 opacity-[0.012]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      <div className="absolute top-0 right-[30%] w-px h-full opacity-[0.04]"
        style={{ background: "linear-gradient(to bottom,transparent,#0d9488 40%,#2563eb 60%,transparent)" }} />
    </div>
  );
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [password2, setPassword2] = useState("");
  const [accepted,  setAccepted]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [showCode,  setShowCode]  = useState(false);
  const [registered, setRegistered] = useState(false);

  const strength  = getStrength(password);
  const pwMatch   = password2.length > 0 && password === password2;
  const pwNoMatch = password2.length > 0 && password !== password2;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password)    return setError("Completá tu correo y contraseña.");
    if (password !== password2) return setError("Las contraseñas no coinciden.");
    if (password.length < 6)    return setError("La contraseña debe tener al menos 6 caracteres.");
    if (!accepted)              return setError("Tenés que aceptar los términos para continuar.");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "confirm_signup", email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Error al crear la cuenta.");
      setRegistered(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Estado: cuenta creada ─────────────────────────────────────────────────
  if (registered) {
    return (
      <>
        <style>{STYLE}</style>
        <main className="flex items-center justify-center min-h-screen px-4" style={{ background: "linear-gradient(160deg,#020810 0%,#040d1c 60%,#030a15 100%)" }}>
          <BgDecorations />
          <div className="relative z-10 w-full max-w-md text-center fade-up-1">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center text-2xl"
              style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)", boxShadow: "0 0 40px rgba(13,148,136,.35)" }}>
              ✨
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">¡Casi listo!</h2>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              Te enviamos un correo a <strong className="text-slate-300">{email}</strong> para confirmar tu cuenta. Revisá tu bandeja de entrada.
            </p>

            <div className="p-5 rounded-2xl mb-6" style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
              <div className="text-xs text-slate-500 mb-3">¿Tenés un código de acceso?</div>
              <AccessCodeInput compact />
            </div>

            <button onClick={() => router.push("/login")}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-80"
              style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}>
              Ir a iniciar sesión
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

        <BgDecorations />

        <div className="relative z-10 w-full max-w-md">

          {/* Logo */}
          <div className="text-center mb-8 fade-up-1">
            <div className="logo-float inline-flex w-14 h-14 rounded-2xl items-center justify-center text-xl font-black text-white mb-4"
              style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)", boxShadow: "0 0 40px rgba(13,148,136,.3), 0 0 80px rgba(37,99,235,.15)" }}>
              C+
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Crear cuenta</h1>
              <p className="text-sm text-slate-500 mt-1">Empezá a controlar tus finanzas hoy</p>
            </div>
          </div>

          {/* Card */}
          <div className="rounded-2xl p-7 fade-up-2"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)" }}>

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Email */}
              <div className="fade-up-3">
                <label htmlFor="reg-email" className="block text-xs font-medium text-slate-400 mb-1.5">
                  Correo electrónico
                </label>
                <input
                  id="reg-email" type="email" required autoComplete="email"
                  className="input-field"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                />
              </div>

              {/* Contraseña */}
              <div className="fade-up-4">
                <label htmlFor="reg-password" className="block text-xs font-medium text-slate-400 mb-1.5">
                  Contraseña
                </label>
                <input
                  id="reg-password" type="password" required autoComplete="new-password"
                  className="input-field"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                />
                {password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                          style={{ background: i <= strength.score ? strength.color : "rgba(255,255,255,0.07)" }} />
                      ))}
                    </div>
                    <div className="text-[10px] transition-colors" style={{ color: strength.color }}>
                      {strength.label}
                    </div>
                  </div>
                )}
              </div>

              {/* Repetir contraseña */}
              <div className="fade-up-5">
                <label htmlFor="reg-password2" className="block text-xs font-medium text-slate-400 mb-1.5">
                  Repetir contraseña
                </label>
                <div className="relative">
                  <input
                    id="reg-password2" type="password" required autoComplete="new-password"
                    className="input-field"
                    value={password2}
                    onChange={e => setPassword2(e.target.value)}
                    placeholder="Repetí la contraseña"
                    minLength={6}
                    style={{
                      borderColor: pwNoMatch ? "rgba(239,68,68,.45)" : pwMatch ? "rgba(16,185,129,.45)" : undefined,
                    }}
                  />
                  {password2.length > 0 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                      style={{ color: pwMatch ? "#10b981" : "#ef4444" }}>
                      {pwMatch ? "✓" : "✕"}
                    </span>
                  )}
                </div>
              </div>

              {/* Código de acceso */}
              <div className="fade-up-5">
                <button type="button" onClick={() => setShowCode(v => !v)}
                  className="text-xs text-slate-500 hover:text-teal-400 transition-colors flex items-center gap-1.5">
                  <span className="text-[10px]">{showCode ? "▾" : "▸"}</span>
                  ¿Tenés un código de acceso?
                </button>
                {showCode && (
                  <div className="mt-2">
                    <AccessCodeInput compact />
                  </div>
                )}
              </div>

              {/* Checkbox legal */}
              <div className="fade-up-6">
                <button type="button" onClick={() => setAccepted(v => !v)}
                  className="flex items-start gap-3 w-full text-left group">
                  <div className={`check-box mt-0.5 ${accepted ? "checked" : ""}`}>
                    {accepted && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs leading-relaxed" style={{ color: accepted ? "rgba(148,163,184,0.9)" : "rgba(100,116,139,0.8)" }}>
                    Leí y acepto los{" "}
                    <a href="/terminos" target="_blank" rel="noopener"
                      className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
                      onClick={e => e.stopPropagation()}>
                      Términos de Uso
                    </a>
                    {" "}y la{" "}
                    <a href="/privacidad" target="_blank" rel="noopener"
                      className="text-teal-400 hover:text-teal-300 underline underline-offset-2 transition-colors"
                      onClick={e => e.stopPropagation()}>
                      Política de Privacidad
                    </a>
                    {" "}de Control+, incluyendo el tratamiento de mis datos conforme a la Ley 18.331 de Uruguay.
                  </span>
                </button>
              </div>

              {/* Errores */}
              {error && (
                <div className="fade-up-6 flex items-start gap-2 text-xs text-red-400 px-3 py-2.5 rounded-xl"
                  style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)" }}>
                  <span className="shrink-0 mt-0.5">✕</span>{error}
                </div>
              )}

              {/* Botón */}
              <div className="fade-up-7 pt-1">
                <button type="submit" disabled={loading || !accepted}
                  className="shimmer-btn w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.01] active:scale-[.99] disabled:scale-100">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white"
                        style={{ animation: "spin .7s linear infinite" }} />
                      Creando cuenta...
                    </span>
                  ) : "Crear cuenta →"}
                </button>
              </div>
            </form>
          </div>

          {/* Ir a login */}
          <p className="text-center text-xs text-slate-600 mt-5 fade-up-7">
            ¿Ya tenés una cuenta?{" "}
            <button className="text-blue-400 hover:text-blue-300 transition-colors"
              onClick={() => router.push("/login")}>
              Iniciar sesión
            </button>
          </p>
        </div>
      </main>
    </>
  );
}
