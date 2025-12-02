"use client";

import { FormEvent, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email) {
      setError("Ingresá tu correo.");
      return;
    }

    setLoading(true);
    const supabase = supabaseBrowser();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setInfo(
      "Si el correo existe, te enviamos un enlace para restablecer tu contraseña."
    );
  };

  return (
    <main className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/80 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-white mb-2">
          Recuperar contraseña
        </h1>
        <p className="text-sm text-slate-400 mb-6">
          Ingresá tu correo y te enviaremos un enlace para elegir una nueva
          contraseña.
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
            disabled={loading}
            className="w-full rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold text-white py-2.5 mt-2"
          >
            {loading ? "Enviando..." : "Enviar enlace de recuperación"}
          </button>
        </form>
      </div>
    </main>
  );
}
