"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

/* ===== Tipos ===== */
export type Currency = "USD" | "EUR" | "UYU" | "ARS" | "BRL";
export type Lang = "ES" | "EN" | "PT";

export type SettingsCtx = {
  // Moneda
  currency: Currency;
  setCurrency: (c: Currency) => void;
  convert: (n: number, opts?: { from?: Currency; to?: Currency }) => number;
  format: (n: number, opts?: { currency?: Currency }) => string;

  // Tasas (expuestas para que otros hooks/componentes puedan leerlas)
  rates: Record<Currency, number>;
  ratesLoading: boolean;
  ratesUpdatedAt: string | null; // "YYYY-MM-DD" o null

  // Idioma
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
};

/* ===== Locales ===== */
const LOCALE_BY_LANG: Record<Lang, string> = {
  ES: "es-UY",
  EN: "en-US",
  PT: "pt-BR",
};

/* ===== Traducciones ===== */
const MESSAGES: Record<Lang, Record<string, string>> = {
  ES: {
    "app.title": "Control+",
    "btn.add": "Agregar",
    "tabs.acciones": "Acciones",
    "tabs.etfs": "ETFs",
    "tabs.cripto": "Cripto",
    "tabs.bonos": "Bonos",
    "tabs.metales": "Metales",
    "cards.assets": "Activos",
    "cards.total": "Total",
    "cards.gain": "Ganancia",
    "cards.loss": "Pérdida",
    "recent.assets": "Activos recientes",
    "search.placeholder": "Buscar...",
    "nav.assets": "Activos",
    "investments.portfolioChartTitle": "Evolución del portafolio",
    "investments.allocationTitle": "Distribución por tipo de activo",
    "investments.tableTitle": "Detalle de inversiones",
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
    "tabs.acciones": "Stocks",
    "tabs.etfs": "ETFs",
    "tabs.cripto": "Crypto",
    "tabs.bonos": "Bonds",
    "tabs.metales": "Metals",
    "cards.assets": "Assets",
    "cards.total": "Total",
    "cards.gain": "Gain",
    "cards.loss": "Loss",
    "recent.assets": "Recent assets",
    "search.placeholder": "Search...",
    "nav.assets": "Assets",
    "investments.portfolioChartTitle": "Portfolio evolution",
    "investments.allocationTitle": "Asset allocation",
    "investments.tableTitle": "Investment details",
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
    "tabs.acciones": "Ações",
    "tabs.etfs": "ETFs",
    "tabs.cripto": "Cripto",
    "tabs.bonos": "Títulos",
    "tabs.metales": "Metais",
    "cards.assets": "Ativos",
    "cards.total": "Total",
    "cards.gain": "Ganho",
    "cards.loss": "Perda",
    "recent.assets": "Ativos recentes",
    "search.placeholder": "Buscar...",
    "nav.assets": "Ativos",
    "investments.portfolioChartTitle": "Evolução da carteira",
    "investments.allocationTitle": "Distribuição por tipo de ativo",
    "investments.tableTitle": "Detalhe dos investimentos",
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

/* ===== Fallback estático ===== */
const DEFAULT_RATES: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  UYU: 40,
  ARS: 900,
  BRL: 5.5,
};

/* ===== Caché ===== */
const CACHE_KEY = "ctrl_fx_v2"; // v2 = nuevo formato con open.er-api
const API_URL   = "https://open.er-api.com/v6/latest/USD";

type CacheEntry = {
  rates: Record<Currency, number>;
  date: string; // "YYYY-MM-DD"
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function loadCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CacheEntry = JSON.parse(raw);
    if (parsed.date !== todayISO()) return null; // expirado
    return parsed;
  } catch { return null; }
}
function saveCache(rates: Record<Currency, number>) {
  try {
    const entry: CacheEntry = { rates, date: todayISO() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {}
}

/* ===== Context ===== */
const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {

  /* ── Moneda ── */
  const [currency, setCurrencyState] = useState<Currency>("USD");
  useEffect(() => {
    try {
      const s = localStorage.getItem("ctrl_currency") as Currency | null;
      if (s) setCurrencyState(s);
    } catch {}
  }, []);
  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    try { localStorage.setItem("ctrl_currency", c); } catch {}
  };

  /* ── Idioma ── */
  const [lang, setLangState] = useState<Lang>("ES");
  useEffect(() => {
    try {
      const s = localStorage.getItem("ctrl_lang") as Lang | null;
      if (s) setLangState(s);
    } catch {}
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("ctrl_lang", l); } catch {}
  };

  /* ── Tasas FX ── */
  const [rates, setRates]               = useState<Record<Currency, number>>(DEFAULT_RATES);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [ratesUpdatedAt, setUpdatedAt]  = useState<string | null>(null);

  useEffect(() => {
    // 1. Intentar caché del día
    const cached = loadCache();
    if (cached) {
      setRates(cached.rates);
      setUpdatedAt(cached.date);
      setRatesLoading(false);
      return;
    }

    // 2. Fetch fresco desde open.er-api.com
    (async () => {
      try {
        const res  = await fetch(API_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.result !== "success") throw new Error("API error");

        const api = json.rates as Record<string, number>;
        const next: Record<Currency, number> = {
          USD: 1,
          EUR: api.EUR ?? DEFAULT_RATES.EUR,
          UYU: api.UYU ?? DEFAULT_RATES.UYU,
          ARS: api.ARS ?? DEFAULT_RATES.ARS,
          BRL: api.BRL ?? DEFAULT_RATES.BRL,
        };

        saveCache(next);
        setRates(next);
        setUpdatedAt(todayISO());
      } catch {
        // Fallback silencioso — usamos DEFAULT_RATES ya seteados
        setUpdatedAt(null);
      } finally {
        setRatesLoading(false);
      }
    })();
  }, []);

  /* ── Funciones derivadas ── */
  const convert = useMemo(() => (
    (n: number, opts?: { from?: Currency; to?: Currency }) => {
      const from = opts?.from ?? "USD";
      const to   = opts?.to   ?? currency;
      if (from === to) return n;
      return (n / (rates[from] || 1)) * (rates[to] || 1);
    }
  ), [currency, rates]);

  const format = useMemo(() => (
    (n: number, opts?: { currency?: Currency }) => {
      const cur = opts?.currency ?? currency;
      return new Intl.NumberFormat(LOCALE_BY_LANG[lang] || "es-UY", {
        style: "currency", currency: cur, maximumFractionDigits: 2,
      }).format(n);
    }
  ), [currency, lang]);

  const t = useMemo(() => {
    const dict = MESSAGES[lang] ?? {};
    return (key: string) => dict[key] ?? key;
  }, [lang]);

  const value: SettingsCtx = useMemo(() => ({
    currency, setCurrency,
    convert, format,
    rates, ratesLoading, ratesUpdatedAt,
    lang, setLang,
    t,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [currency, lang, convert, format, rates, ratesLoading, ratesUpdatedAt]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
