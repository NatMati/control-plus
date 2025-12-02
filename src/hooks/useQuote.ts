"use client";

import { useEffect, useState } from "react";

type QuoteResponse = {
  symbol: string;
  price: number;
  cached: boolean;
  updated_at: string;
};

type UseQuoteOptions = {
  /** cada cuántos ms refrescar la cotización (default: 5 minutos) */
  refreshMs?: number;
};

export function useQuote(
  symbol: string | null | undefined,
  options?: UseQuoteOptions
) {
  const [data, setData] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refreshMs = options?.refreshMs ?? 5 * 60_000; // 5 minutos

  useEffect(() => {
    if (!symbol) {
      setData(null);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchQuote = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `/api/quotes/${encodeURIComponent(symbol)}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body?.error || `Failed to fetch quote for ${symbol}`
          );
        }

        const json = (await res.json()) as QuoteResponse;
        if (!cancelled) {
          setData(json);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchQuote();

    if (refreshMs > 0) {
      timer = setInterval(fetchQuote, refreshMs);
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [symbol, refreshMs]);

  return {
    data,
    price: data?.price ?? null,
    symbol: data?.symbol ?? symbol ?? null,
    cached: data?.cached ?? false,
    updatedAt: data?.updated_at ?? null,
    loading,
    error,
  };
}
