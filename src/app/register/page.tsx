"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!email || !password) {
      setError("Completá tu correo y una contraseña.");
      return;
    }
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const supabase = supabaseBrowser();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage(
      "Te enviamos un correo para confirmar tu cuenta. Revisá tu bandeja de entrada."
    );
  };

  return (
    <main className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/80 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-white mb-2">
          Crear cuenta en Control+
        </h1>
        <p className="text-sm text-slate-400 mb-6">
          Usaremos tu correo para enviarte un enlace de confirmación.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">
              Repetir contraseña
            </label>
            <input
              type="password"
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white outline-none border border-slate-700 focus:border-blue-500"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/40 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {message && (
            <p className="text-sm text-emerald-400 bg-emerald-950/40 rounded-md px-3 py-2">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold text-white py-2.5 mt-2"
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <p className="text-xs text-slate-500 mt-4">
          ¿Ya tenés cuenta?{" "}
          <button
            className="text-blue-400 hover:underline"
            onClick={() => router.push("/login")}
          >
            Iniciar sesión
          </button>
        </p>
      </div>
    </main>
  );
}
