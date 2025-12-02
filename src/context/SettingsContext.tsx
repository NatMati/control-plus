"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

/* ===== Tipos ===== */
export type Currency = "USD" | "EUR" | "UYU" | "ARS" | "BRL";
export type Lang = "ES" | "EN" | "PT";

export type SettingsCtx = {
  // Moneda
  currency: Currency;
  setCurrency: (c: Currency) => void;
  /** Convierte montos entre monedas */
  convert: (n: number, opts?: { from?: Currency; to?: Currency }) => number;
  /**
   * Formatea un monto que YA está expresado en la moneda indicada.
   * Si no se pasa `currency`, usa la moneda seleccionada en el panel.
   */
  format: (n: number, opts?: { currency?: Currency }) => string;

  // Idioma
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Traducción por clave */
  t: (key: string) => string;
};

/* ===== Locales por idioma (para separadores, símbolo, etc.) ===== */
const LOCALE_BY_LANG: Record<Lang, string> = {
  ES: "es-UY",
  EN: "en-US",
  PT: "pt-BR",
};

/* ===== Traducciones usadas en tu UI ===== */
const MESSAGES: Record<Lang, Record<string, string>> = {
  ES: {
    "app.title": "Control+",
    "btn.add": "Agregar",

    // Tabs
    "tabs.acciones": "Acciones",
    "tabs.etfs": "ETFs",
    "tabs.cripto": "Cripto",
    "tabs.bonos": "Bonos",
    "tabs.metales": "Metales",

    // Cards
    "cards.assets": "Activos",
    "cards.total": "Total",
    "cards.gain": "Ganancia",
    "cards.loss": "Pérdida",

    // Dashboard / comunes
    "recent.assets": "Activos recientes",
    "search.placeholder": "Buscar...",
    "nav.assets": "Activos",

    // Inversiones (hoja /inversiones)
    "investments.portfolioChartTitle": "Evolución del portafolio",
    "investments.allocationTitle": "Distribución por tipo de activo",
    "investments.tableTitle": "Detalle de inversiones",

    // Plazo fijo / renta fija
    "fixed.title": "Simulador de plazo fijo",
    "fixed.startDate": "Inicio del plazo",
    "fixed.principal": "Capital inicial",
    "fixed.currency": "Moneda",
    "fixed.rate": "Rendimiento anual estimado (%)",
    "fixed.months": "Duración (meses)",
    "fixed.finalAmount": "Monto estimado al final:",
    "fixed.gain": "Ganancia total:",
  },

  EN: {
    "app.title": "Control+",
    "btn.add": "Add",

    // Tabs
    "tabs.acciones": "Stocks",
    "tabs.etfs": "ETFs",
    "tabs.cripto": "Crypto",
    "tabs.bonos": "Bonds",
    "tabs.metales": "Metals",

    // Cards
    "cards.assets": "Assets",
    "cards.total": "Total",
    "cards.gain": "Gain",
    "cards.loss": "Loss",

    // Common
    "recent.assets": "Recent assets",
    "search.placeholder": "Search...",
    "nav.assets": "Assets",

    // Investments page
    "investments.portfolioChartTitle": "Portfolio evolution",
    "investments.allocationTitle": "Asset allocation",
    "investments.tableTitle": "Investment details",

    // Fixed-term / fixed income
    "fixed.title": "Fixed-term simulator",
    "fixed.startDate": "Start date",
    "fixed.principal": "Initial capital",
    "fixed.currency": "Currency",
    "fixed.rate": "Estimated annual yield (%)",
    "fixed.months": "Duration (months)",
    "fixed.finalAmount": "Estimated final amount:",
    "fixed.gain": "Total gain:",
  },

  PT: {
    "app.title": "Control+",
    "btn.add": "Adicionar",

    // Tabs
    "tabs.acciones": "Ações",
    "tabs.etfs": "ETFs",
    "tabs.cripto": "Cripto",
    "tabs.bonos": "Títulos",
    "tabs.metales": "Metais",

    // Cards
    "cards.assets": "Ativos",
    "cards.total": "Total",
    "cards.gain": "Ganho",
    "cards.loss": "Perda",

    // Common
    "recent.assets": "Ativos recentes",
    "search.placeholder": "Buscar...",
    "nav.assets": "Ativos",

    // Investments page
    "investments.portfolioChartTitle": "Evolução da carteira",
    "investments.allocationTitle": "Distribuição por tipo de ativo",
    "investments.tableTitle": "Detalhe dos investimentos",

    // Fixed-term / renda fixa
    "fixed.title": "Simulador de renda fixa",
    "fixed.startDate": "Início do prazo",
    "fixed.principal": "Capital inicial",
    "fixed.currency": "Moeda",
    "fixed.rate": "Rendimento anual estimado (%)",
    "fixed.months": "Duração (meses)",
    "fixed.finalAmount": "Montante estimado ao final:",
    "fixed.gain": "Ganho total:",
  },
};

/* ===== Tasas base (fallback) relativas a USD ===== */
const DEFAULT_RATES: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  UYU: 40,
  ARS: 900,
  BRL: 5.5,
};

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  /* ===== estado de moneda ===== */
  const [currency, setCurrencyState] = useState<Currency>("USD");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ctrl_currency") as Currency | null;
      if (saved) setCurrencyState(saved);
    } catch {}
  }, []);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    try {
      localStorage.setItem("ctrl_currency", c);
    } catch {}
  };

  /* ===== idioma ===== */
  const [lang, setLangState] = useState<Lang>("ES");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ctrl_lang") as Lang | null;
      if (saved) setLangState(saved);
    } catch {}
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("ctrl_lang", l);
    } catch {}
  };

  /* ===== Tasas dinámicas (USD -> otras) ===== */
  const [rates, setRates] = useState<Record<Currency, number>>(DEFAULT_RATES);
  const [lastRatesAt, setLastRatesAt] = useState<number | null>(null);

  // Carga inicial desde localStorage (si existe)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("ctrl_fx");
      if (raw) {
        const parsed = JSON.parse(raw) as {
          rates: Record<Currency, number>;
          at: number;
        };
        if (parsed?.rates && parsed?.at) {
          setRates({ ...parsed.rates, USD: 1 });
          setLastRatesAt(parsed.at);
        }
      }
    } catch {}
  }, []);

  // Descarga desde API pública (exchangerate.host)
  const refreshRates = async () => {
    try {
      const url =
        "https://api.exchangerate.host/latest?base=USD&symbols=EUR,UYU,ARS,BRL";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Bad response");
      const json = await res.json();
      const apiRates = json?.rates as Record<string, number> | undefined;
      if (!apiRates) throw new Error("No rates");

      const next: Record<Currency, number> = {
        USD: 1,
        EUR: apiRates.EUR ?? DEFAULT_RATES.EUR,
        UYU: apiRates.UYU ?? DEFAULT_RATES.UYU,
        ARS: apiRates.ARS ?? DEFAULT_RATES.ARS,
        BRL: apiRates.BRL ?? DEFAULT_RATES.BRL,
      };

      setRates(next);
      console.log("💱 Tasas actualizadas:", next);
      const at = Date.now();
      setLastRatesAt(at);
      localStorage.setItem("ctrl_fx", JSON.stringify({ rates: next, at }));
    } catch {
      // Si falla, seguimos con DEFAULT_RATES silenciosamente
    }
  };

  // Refresco inicial si pasaron >12h y refresco periódico cada 6h
  useEffect(() => {
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    const stale = !lastRatesAt || Date.now() - lastRatesAt > TWELVE_HOURS;
    if (stale) refreshRates();
    const id = setInterval(refreshRates, 6 * 60 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRatesAt]);

  /* ===== traducción ===== */
  const t = useMemo(() => {
    const dict = MESSAGES[lang] ?? {};
    return (key: string) => dict[key] ?? key;
  }, [lang]);

  /* ===== conversión (usa tasas dinámicas) ===== */
  const convert = useMemo(() => {
    return (n: number, opts?: { from?: Currency; to?: Currency }) => {
      const from = opts?.from ?? "USD";
      const to = opts?.to ?? currency;
      const inUsd = n / (rates[from] || 1); // a USD
      return inUsd * (rates[to] || 1); // de USD a destino
    };
  }, [currency, rates]);

  /* ===== formato (NO convierte, solo formatea) ===== */
  const format = useMemo(() => {
    return (n: number, opts?: { currency?: Currency }) => {
      const cur = opts?.currency ?? currency;

      return new Intl.NumberFormat(LOCALE_BY_LANG[lang] || "es-UY", {
        style: "currency",
        currency: cur,
        maximumFractionDigits: 2,
      }).format(n);
    };
  }, [currency, lang]);

  const value: SettingsCtx = useMemo(
    () => ({
      currency,
      setCurrency,
      convert,
      format,
      lang,
      setLang,
      t,
    }),
    [currency, lang, convert, format]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return ctx;
}
