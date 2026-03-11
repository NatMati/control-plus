// src/hooks/useExchangeRates.ts
// Wrapper fino sobre SettingsContext.
// Todo el fetch, caché y lógica de conversión vive en SettingsContext.
// Este hook solo reexpone lo necesario para CostoReal y otros consumidores.

import { useSettings } from "@/context/SettingsContext";

export function useExchangeRates() {
  const { rates, ratesLoading, ratesUpdatedAt, convert: ctxConvert } = useSettings();

  /**
   * Convierte `amount` de `from` a `to`.
   * Acepta strings arbitrarios de moneda para compatibilidad con CostoReal.
   */
  function convert(amount: number, from: string, to: string): number {
    return ctxConvert(amount, { from: from as any, to: to as any });
  }

  return {
    rates,
    loading:   ratesLoading,
    fromCache: ratesUpdatedAt !== null,
    error:     null, // los errores se manejan con fallback silencioso en el contexto
    convert,
  };
}
