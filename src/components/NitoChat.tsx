// src/components/NitoChat.tsx
"use client";

import { useState } from "react";

type ChatMessage = {
  id: string;
  from: "user" | "nito";
  text: string;
};

export default function NitoChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      from: "nito",
      text: "Hola, soy Nito 👋. Puedo ayudarte a entender tus gastos, ingresos, cashflow y cómo usar Control+. ¿En qué te ayudo hoy?",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setError(null);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      from: "user",
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/nito", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        console.error("Error en /api/nito:", errorBody || res.statusText);
        setError("Ocurrió un error al hablar con Nito. Intentalo de nuevo.");
        setLoading(false);
        return;
      }

      const data = (await res.json()) as { answer?: string };
      const answer = data.answer?.trim() || "No pude generar una respuesta válida.";

      const nitoMessage: ChatMessage = {
        id: crypto.randomUUID(),
        from: "nito",
        text: answer,
      };

      setMessages((prev) => [...prev, nitoMessage]);
    } catch (err) {
      console.error(err);
      setError("No se pudo conectar con Nito. Revisa tu conexión e intenta otra vez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-3xl mx-auto p-4 gap-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Nito, tu guía en Control+</h1>
        <p className="text-sm text-slate-400">
          Preguntame sobre tus gastos, ingresos, cashflow, presupuestos o cómo usar la app.
        </p>
      </div>

      {/* Chat */}
      <div className="flex-1 rounded-2xl border border-slate-800 bg-[#050816] p-4 overflow-y-auto space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${
              m.from === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                m.from === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-slate-800 text-slate-100 rounded-bl-sm"
              }`}
            >
              {m.from === "nito" && (
                <div className="text-[11px] font-semibold text-sky-400 mb-1">
                  Nito
                </div>
              )}
              <p className="whitespace-pre-wrap">{m.text}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-2">
            <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
            Nito está pensando...
          </div>
        )}

        {error && (
          <div className="mt-2 text-xs text-red-400 bg-red-950/40 border border-red-800/60 rounded-md px-2 py-1">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
          placeholder="Ej: ¿En qué gasté más este mes? • ¿Cómo funciona el cashflow?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Enviando..." : "Enviar"}
        </button>
      </form>
    </div>
  );
}
