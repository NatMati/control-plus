"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingPwd, setLoadingPwd] = useState(false);
  const [loadingMagic, setLoadingMagic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleLoginPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email || !password) {
      setError("Ingresá tu correo y contraseña.");
      return;
    }

    setLoadingPwd(true);
    const supabase = supabaseBrowser();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoadingPwd(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.replace("/"); // o /dashboard
  };

  const handleMagicLink = async () => {
    setError(null);
    setInfo(null);

    if (!email) {
      setError("Ingresá tu correo para enviarte el enlace.");
      return;
    }

    setLoadingMagic(true);
    const supabase = supabaseBrowser();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoadingMagic(false);

    if (error) {
      setError(error.message);
      return;
    }

    setInfo(
      "Te enviamos un enlace de acceso. Abrí el correo desde este mismo dispositivo."
    );
  };

  return (
    <main className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/80 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-white mb-2">
          Iniciar sesión
        </h1>
        <p className="text-sm text-slate-400 mb-6">
          Entrá con tu correo y contraseña o pedí un enlace de acceso por
          correo.
        </p>

        <form onSubmit={handleLoginPassword} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white outline-none border border-slate-700 focus:border-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white outline-none border border-slate-700 focus:border-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/40 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {info && (
            <p className="text-sm text-emerald-400 bg-emerald-950/40 rounded-md px-3 py-2">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loadingPwd}
            className="w-full rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold text-white py-2.5 mt-2"
          >
            {loadingPwd ? "Ingresando..." : "Entrar con contraseña"}
          </button>
        </form>

        <div className="mt-4 flex items-center gap-2">
          <div className="h-px flex-1 bg-slate-700" />
          <span className="text-xs text-slate-500">o</span>
          <div className="h-px flex-1 bg-slate-700" />
        </div>

        <button
          onClick={handleMagicLink}
          disabled={loadingMagic}
          className="w-full mt-4 rounded-lg border border-slate-600 hover:border-blue-500 text-sm font-medium text-slate-100 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loadingMagic
            ? "Enviando enlace..."
            : "Enviarme un enlace de acceso por correo"}
        </button>

        <div className="mt-4 flex flex-col gap-1 text-xs text-slate-500">
          <button
            className="text-blue-400 hover:underline text-left"
            onClick={() => router.push("/forgot-password")}
          >
            ¿Olvidaste tu contraseña?
          </button>
          <button
            className="text-blue-400 hover:underline text-left"
            onClick={() => router.push("/register")}
          >
            Crear cuenta nueva
          </button>
        </div>
      </div>
    </main>
  );
}
