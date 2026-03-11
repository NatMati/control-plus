"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { Lock, Eye, EyeOff } from "lucide-react";

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
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }

  .fade-up-1 { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) .05s both; }
  .fade-up-2 { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) .12s both; }
  .fade-up-3 { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) .19s both; }
  .fade-up-4 { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) .26s both; }
  .fade-up-5 { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) .33s both; }
  .fade-up-6 { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) .40s both; }

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
    color: white; outline: none; width: 100%;
    padding: .625rem .875rem .625rem 2.5rem;
    border-radius: .625rem; font-size: .875rem;
  }
  .input-field::placeholder { color: rgba(148,163,184,.45); }
  .input-field:focus {
    border-color: rgba(13,148,136,.55);
    background: rgba(13,148,136,.04);
    box-shadow: 0 0 0 3px rgba(13,148,136,.08);
  }
`;

function getStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "transparent" };
  let s = 0;
  if (pw.length >= 8)         s++;
  if (/[A-Z]/.test(pw))       s++;
  if (/[0-9]/.test(pw))       s++;
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
        style={{ background: "radial-gradient(ellipse,#0d9488,transparent 70%)", animation: "glow 6s ease-in-out infinite" }}/>
      <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] rounded-full opacity-[0.05]"
        style={{ background: "radial-gradient(ellipse,#2563eb,transparent 70%)", animation: "glow 8s ease-in-out 2s infinite" }}/>
      <div className="absolute inset-0 opacity-[0.012]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)", backgroundSize: "60px 60px" }}/>
    </div>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password,     setPassword]     = useState("");
  const [password2,    setPassword2]    = useState("");
  const [showPwd,      setShowPwd]      = useState(false);
  const [showPwd2,     setShowPwd2]     = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [done,         setDone]         = useState(false);

  const strength  = getStrength(password);
  const pwMatch   = password2.length > 0 && password === password2;
  const pwNoMatch = password2.length > 0 && password !== password2;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6)    return setError("La contraseña debe tener al menos 6 caracteres.");
    if (password !== password2) return setError("Las contraseñas no coinciden.");

    setLoading(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password });
    setLoading(false);

    if (error) return setError(error.message);
    setDone(true);
    setTimeout(() => router.replace("/login"), 2500);
  };

  // ── Estado: contraseña actualizada ───────────────────────────────────────
  if (done) {
    return (
      <>
        <style>{STYLE}</style>
        <main className="flex items-center justify-center min-h-screen px-4"
          style={{ background: "linear-gradient(160deg,#020810 0%,#040d1c 60%,#030a15 100%)" }}>
          <BgDecorations/>
          <div className="relative z-10 w-full max-w-md text-center fade-up-1">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center text-2xl"
              style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)", boxShadow: "0 0 40px rgba(13,148,136,.35)" }}>
              ✓
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Contraseña actualizada</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Tu contraseña fue actualizada correctamente. Redirigiendo al inicio de sesión...
            </p>
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
              <h1 className="text-2xl font-bold text-white tracking-tight">Nueva contraseña</h1>
              <p className="text-sm text-slate-500 mt-1">Elige una contraseña segura para tu cuenta</p>
            </div>
          </div>

          {/* Card */}
          <div className="rounded-2xl p-7 fade-up-2"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)" }}>

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Nueva contraseña */}
              <div className="fade-up-3">
                <label htmlFor="password" className="block text-xs font-medium text-slate-400 mb-1.5">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none"/>
                  <input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    required minLength={6}
                    className="input-field pr-10"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(null); }}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
                    {showPwd ? <EyeOff className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}
                  </button>
                </div>
                {/* Barra de fortaleza */}
                {password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                          style={{ background: i <= strength.score ? strength.color : "rgba(255,255,255,0.07)" }}/>
                      ))}
                    </div>
                    <div className="text-[10px] transition-colors" style={{ color: strength.color }}>
                      {strength.label}
                    </div>
                  </div>
                )}
              </div>

              {/* Repetir contraseña */}
              <div className="fade-up-4">
                <label htmlFor="password2" className="block text-xs font-medium text-slate-400 mb-1.5">
                  Repetir contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none"/>
                  <input
                    id="password2"
                    type={showPwd2 ? "text" : "password"}
                    required minLength={6}
                    className="input-field pr-10"
                    placeholder="Repite la contraseña"
                    value={password2}
                    onChange={e => { setPassword2(e.target.value); setError(null); }}
                    autoComplete="new-password"
                    style={{
                      borderColor: pwNoMatch ? "rgba(239,68,68,.45)" : pwMatch ? "rgba(16,185,129,.45)" : undefined,
                    }}
                  />
                  <button type="button" onClick={() => setShowPwd2(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
                    {showPwd2 ? <EyeOff className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}
                  </button>
                  {password2.length > 0 && (
                    <span className="absolute right-9 top-1/2 -translate-y-1/2 text-xs"
                      style={{ color: pwMatch ? "#10b981" : "#ef4444" }}>
                      {pwMatch ? "✓" : "✕"}
                    </span>
                  )}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="fade-up-5 flex items-start gap-2 text-xs text-red-400 px-3 py-2.5 rounded-xl"
                  style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)" }}>
                  <span className="shrink-0 mt-0.5">✕</span>{error}
                </div>
              )}

              {/* Botón */}
              <div className="fade-up-5 pt-1">
                <button type="submit" disabled={loading}
                  className="shimmer-btn w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.01] active:scale-[.99] disabled:scale-100">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white"
                        style={{ animation: "spin .7s linear infinite" }}/>
                      Guardando...
                    </span>
                  ) : "Actualizar contraseña"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
