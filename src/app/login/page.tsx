"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { Eye, EyeOff, Mail, Lock, ArrowRight, Zap } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loadingPwd,   setLoadingPwd]   = useState(false);
  const [loadingMagic, setLoadingMagic] = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [info,         setInfo]         = useState<string | null>(null);
  const [mode,         setMode]         = useState<"password" | "magic">("password");

  async function handleLoginPassword(e: FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null);
    if (!email || !password) { setError("Ingresá tu correo y contraseña."); return; }
    setLoadingPwd(true);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    setLoadingPwd(false);
    if (error) { setError("Correo o contraseña incorrectos."); return; }
    router.replace("/dashboard");
  }

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null);
    if (!email) { setError("Ingresá tu correo para recibir el enlace."); return; }
    setLoadingMagic(true);
    try {
      const res = await fetch("/api/auth/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "magic_link", email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Error al enviar el enlace.");
      setInfo("Revisá tu correo — te enviamos un enlace de acceso.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingMagic(false);
    }
  }

  const isLoading = loadingPwd || loadingMagic;

  return (
    <main className="min-h-screen flex" style={{ background: "#020617" }}>

      {/* ── Panel izquierdo — solo desktop ── */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg,#0a1628 0%,#041420 60%,#020617 100%)" }}>

        {/* Glow decorativo */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle,rgba(13,148,136,0.15) 0%,transparent 70%)" }}/>
          <div className="absolute bottom-[-60px] right-[-60px] w-[300px] h-[300px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle,rgba(37,99,235,0.12) 0%,transparent 70%)" }}/>
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="36" height="36" fill="none">
              <defs>
                <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#0d9488"/><stop offset="100%" stopColor="#2563eb"/>
                </linearGradient>
                <filter id="gw1"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              </defs>
              <rect width="48" height="48" rx="12" fill="url(#lg1)"/>
              <rect width="48" height="24" rx="12" fill="rgba(255,255,255,0.07)"/>
              <polyline points="10,35 18,26 27,30 38,17" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <polyline points="10,35 18,26 27,30 38,17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#gw1)"/>
              <circle cx="18" cy="26" r="2.2" fill="rgba(255,255,255,0.6)"/>
              <circle cx="38" cy="17" r="3" fill="white"/>
              <text x="26" y="44" fontFamily="'Helvetica Neue',Arial,sans-serif" fontSize="9" fontWeight="800" fill="rgba(255,255,255,0.6)" letterSpacing="-0.2">C+</text>
            </svg>
            <span className="text-lg font-bold text-white tracking-tight">Control<span style={{background:"linear-gradient(135deg,#0d9488,#2563eb)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>+</span></span>
          </div>
        </div>

        {/* Copy central */}
        <div className="relative z-10 space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-white leading-snug">
              Tu dinero<br/>
              <span style={{ background: "linear-gradient(90deg,#2dd4bf,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                gestionado al detalle.
              </span>
            </h2>
            <p className="text-sm text-slate-500 mt-3 leading-relaxed">
              Inversiones, gastos, presupuestos y cashflow en un solo lugar. Diseñado para quienes quieren tomar decisiones financieras con claridad.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-col gap-2">
            {[
              "Seguimiento de inversiones en tiempo real",
              "Presupuestos por categoría con alertas",
              "Cashflow y calendario financiero",
              "Análisis de costo real por horas trabajadas",
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-2.5 text-xs text-slate-400">
                <div className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)" }}/>
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-[11px] text-slate-700">
          © {new Date().getFullYear()} Control+ · Todos los derechos reservados
        </div>
      </div>

      {/* ── Panel derecho — formulario ── */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px] space-y-6">

          {/* Logo mobile */}
          <div className="flex items-center gap-2 lg:hidden mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="30" height="30" fill="none">
              <defs>
                <linearGradient id="lg2" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#0d9488"/><stop offset="100%" stopColor="#2563eb"/>
                </linearGradient>
              </defs>
              <rect width="48" height="48" rx="12" fill="url(#lg2)"/>
              <polyline points="10,35 18,26 27,30 38,17" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <circle cx="38" cy="17" r="3" fill="white"/>
            </svg>
            <span className="text-base font-bold text-white">Control<span style={{background:"linear-gradient(135deg,#0d9488,#2563eb)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>+</span></span>
          </div>

          {/* Encabezado */}
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Bienvenido de vuelta</h1>
            <p className="text-sm text-slate-600 mt-1">Ingresar a mi cuenta para continuar</p>
          </div>

          {/* Selector de modo */}
          <div className="flex rounded-xl p-1 gap-1"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <button onClick={() => { setMode("password"); setError(null); setInfo(null); }}
              className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: mode === "password" ? "rgba(255,255,255,0.08)" : "transparent",
                color: mode === "password" ? "white" : "rgba(148,163,184,0.6)",
                border: mode === "password" ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
              }}>
              Contraseña
            </button>
            <button onClick={() => { setMode("magic"); setError(null); setInfo(null); }}
              className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: mode === "magic" ? "rgba(255,255,255,0.08)" : "transparent",
                color: mode === "magic" ? "white" : "rgba(148,163,184,0.6)",
                border: mode === "magic" ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
              }}>
              <Zap className="w-3 h-3 inline mr-1"/>Magic Link
            </button>
          </div>

          {/* Formulario */}
          <form onSubmit={mode === "password" ? handleLoginPassword : handleMagicLink}
            className="space-y-3">

            {/* Email */}
            <div>
              <label className="text-[11px] text-slate-600 uppercase tracking-wider mb-1.5 block font-medium">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none"/>
                <input type="email" placeholder="correo@ejemplo.com" value={email}
                  onChange={e => { setEmail(e.target.value); setError(null); }}
                  autoComplete="email" required
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-700 transition-all outline-none"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                  onFocus={e=>(e.target.style.border="1px solid rgba(255,255,255,0.2)")}
                  onBlur={e=>(e.target.style.border="1px solid rgba(255,255,255,0.08)")}/>
              </div>
            </div>

            {/* Password */}
            {mode === "password" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] text-slate-600 uppercase tracking-wider font-medium">
                    Contraseña
                  </label>
                  <button type="button" onClick={() => router.push("/forgot-password")}
                    className="text-[11px] text-slate-600 hover:text-sky-400 transition-colors">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none"/>
                  <input type={showPassword ? "text" : "password"}
                    placeholder="••••••••" value={password}
                    onChange={e => { setPassword(e.target.value); setError(null); }}
                    autoComplete="current-password" required
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm text-white placeholder-slate-700 transition-all outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                    onFocus={e=>(e.target.style.border="1px solid rgba(255,255,255,0.2)")}
                    onBlur={e=>(e.target.style.border="1px solid rgba(255,255,255,0.08)")}/>
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
                    {showPassword ? <EyeOff className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}
                  </button>
                </div>
              </div>
            )}

            {/* Magic link hint */}
            {mode === "magic" && (
              <p className="text-xs text-slate-600 px-1">
                Te enviamos un enlace de acceso a tu correo. No necesitás contraseña.
              </p>
            )}

            {/* Error / Info */}
            {error && (
              <div className="rounded-xl px-3.5 py-2.5 text-xs text-rose-300"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}>
                {error}
              </div>
            )}
            {info && (
              <div className="rounded-xl px-3.5 py-2.5 text-xs text-emerald-300"
                style={{ background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.18)" }}>
                {info}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-1"
              style={{ background: isLoading ? "rgba(37,99,235,0.6)" : "linear-gradient(135deg,#0d9488,#2563eb)" }}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {mode === "password" ? "Ingresando…" : "Enviando…"}
                </span>
              ) : (
                <>
                  {mode === "password" ? "Ingresar" : "Enviar enlace"}
                  <ArrowRight className="w-3.5 h-3.5"/>
                </>
              )}
            </button>
          </form>

          {/* Crear cuenta */}
          <p className="text-center text-xs text-slate-700">
            ¿No tenés una cuenta?{" "}
            <button onClick={() => router.push("/register")}
              className="text-sky-500 hover:text-sky-400 font-medium transition-colors">
              Creá tu cuenta aquí
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
