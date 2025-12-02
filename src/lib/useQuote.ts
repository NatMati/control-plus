"use client";

import { useEffect, useState } from "react";

type QuoteState = {
  price: number | null;
  loading: boolean;
  error: string | null;
};

export function useQuote(symbol: string | null | undefined): QuoteState {
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;

    let cancelled = false;

    const fetchQuote = async () => {
      try {
        setLoading(true);
        setError(null);

        // 👇 AHORA USAMOS LA RUTA DINÁMICA /api/quotes/[symbol]
        const res = await fetch(
          `/api/quotes/${encodeURIComponent(symbol)}`
        );

        if (!res.ok) {
          const text = await res.text();
          console.warn(
            "Error en endpoint de cotización:",
            res.status,
            text
          );

          if (!cancelled) {
            try {
              const parsed = JSON.parse(text);
              setError(
                parsed?.error ?? `Error HTTP ${res.status}`
              );
            } catch {
              setError(`Error HTTP ${res.status}`);
            }
            setPrice(null);
            setLoading(false);
          }
          return;
        }

        const data = await res.json();

        if (!cancelled) {
          setPrice(
            typeof data.price === "number" ? data.price : null
          );
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.warn("Fallo general en useQuote:", err);
          setError(err?.message ?? "Error al obtener cotización");
          setLoading(false);
        }
      }
    };

    // Primera carga
    fetchQuote();
    // Refresco cada 60s
    const id = setInterval(fetchQuote, 60_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol]);

  return { price, loading, error };
}
