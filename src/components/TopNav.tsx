"use client";

import { useState } from "react";
import { useSettings } from "@/context/SettingsContext";
import {
  ArrowLeftRight,
  Globe2,
  Coins,
  Settings as SettingsIcon,
  User2,
  Check,
  Copy,
} from "lucide-react";

export default function TopNav() {
  const [showMenu, setShowMenu] = useState(false);
  const [q, setQ] = useState("");

  const { currency, setCurrency, lang, setLang, t, convert } = useSettings();

  const fxTargets = ["EUR", "UYU", "ARS", "BRL"] as const;

  const handleCopyFx = () => {
    try {
      const lines = fxTargets.map(
        (c) => `1 USD = ${convert(1, { from: "USD", to: c }).toFixed(2)} ${c}`
      );
      const text = lines.join("\n");
      navigator.clipboard.writeText(text);
      // no hace falta estado extra, un alert simple alcanza
      alert("Tasas de cambio copiadas al portapapeles ✅");
    } catch (e) {
      console.error(e);
      alert("No se pudieron copiar las tasas. Probá de nuevo.");
    }
  };

  return (
    <header className="border-b border-slate-800 bg-[#020617]">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-6">
        {/* Título / logo */}
        <div className="mr-auto text-xl font-semibold">Control+</div>

        {/* Buscador */}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-52 md:w-64 rounded-lg border border-slate-700 bg-[#0f1830] px-3 py-2 text-sm"
          placeholder={t("search.placeholder")}
        />

        {/* Botón de menú / perfil */}
        <div className="relative">
          <button
            onClick={() => setShowMenu((s) => !s)}
            className="ml-3 flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-[#0f1830] hover:bg-slate-800 transition"
            aria-label="Abrir menú de configuración"
          >
            <User2 className="h-4 w-4 text-slate-200" />
          </button>

          {showMenu && (
            <div className="absolute right-0 z-50 mt-2 w-[320px] rounded-xl border border-slate-700 bg-[#020617] p-3 shadow-xl">
              {/* Cabecera del panel */}
              <div className="mb-3 flex items-center gap-2 border-b border-slate-800 pb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-100">
                  C+
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-100">
                    Panel de Control
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Idioma, moneda y tasas de cambio
                  </span>
                </div>
              </div>

              {/* Idioma */}
              <div className="mb-3">
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
                  <Globe2 className="h-3 w-3" />
                  Idioma
                </div>
                <div className="flex gap-2">
                  {(["ES", "EN", "PT"] as const).map((L) => (
                    <button
                      key={L}
                      onClick={() => setLang(L)}
                      className={[
                        "flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs",
                        L === lang
                          ? "border-blue-500 bg-blue-600/20 text-blue-200"
                          : "border-slate-700 bg-[#0f1830] text-slate-300 hover:bg-slate-800",
                      ].join(" ")}
                    >
                      {L}
                      {L === lang && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Moneda */}
              <div className="mb-3">
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
                  <Coins className="h-3 w-3" />
                  Moneda principal
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["USD", "EUR", "UYU", "ARS", "BRL"] as const).map((C) => (
                    <button
                      key={C}
                      onClick={() => setCurrency(C)}
                      className={[
                        "flex-1 min-w-[60px] rounded-md border px-2 py-1 text-xs",
                        C === currency
                          ? "border-blue-500 bg-blue-600/20 text-blue-200"
                          : "border-slate-700 bg-[#0f1830] text-slate-300 hover:bg-slate-800",
                      ].join(" ")}
                    >
                      {C}
                      {C === currency && (
                        <Check className="ml-1 inline h-3 w-3" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cambio del día */}
              <div className="mb-3">
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
                  <ArrowLeftRight className="h-3 w-3" />
                  Cambio del día (1 USD)
                </div>
                <div className="space-y-1 rounded-md bg-[#0f1830] p-2 text-sm">
                  {fxTargets.map((c) => (
                    <div
                      key={c}
                      className="flex justify-between text-xs text-slate-200"
                    >
                      <span>{c}</span>
                      <span className="font-medium">
                        {convert(1, { from: "USD", to: c }).toFixed(2)} {c}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Configuración rápida / acción útil */}
              <div className="mt-2 border-t border-slate-800 pt-2">
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
                  <SettingsIcon className="h-3 w-3" />
                  Herramientas rápidas
                </div>
                <button
                  onClick={handleCopyFx}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-700"
                >
                  <Copy className="h-3 w-3" />
                  Copiar tasas de cambio (USD → otras)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
