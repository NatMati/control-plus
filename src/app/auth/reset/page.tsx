"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!password || password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const supabase = supabaseBrowser();

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setInfo("Tu contraseña fue actualizada correctamente.");
    setTimeout(() => router.replace("/login"), 2000);
  };

  return (
    <main className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/80 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-white mb-2">
          Nueva contraseña
        </h1>
        <p className="text-sm text-slate-400 mb-6">
          Elegí una nueva contraseña para tu cuenta de Control+.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">
              Nueva contraseña
            </label>
            <input
              type="password"
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white outline-none border border-slate-700 focus:border-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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
            {loading ? "Guardando..." : "Actualizar contraseña"}
          </button>
        </form>
      </div>
    </main>
  );
}
