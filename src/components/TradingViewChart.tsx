'use client';

import { useEffect, useRef } from 'react';

type Props = {
  symbol: string;             // ej: 'BINANCE:ADAUSDT', 'NASDAQ:TTWO', 'AMEX:VOO'
  height?: number;            // alto opcional, default 500
  interval?: '1'|'5'|'15'|'60'|'240'|'D'|'W'|'M';
  theme?: 'light'|'dark';
};

// Para TypeScript cuando cargamos tv.js
declare global {
  interface Window {
    TradingView?: any;
  }
}

export default function TradingViewChart({
  symbol,
  height = 500,
  interval = 'D',
  theme = 'dark',
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    // Insertar el script tv.js una sola vez
    const ensureScript = () =>
      new Promise<void>((resolve, reject) => {
        if (window.TradingView) return resolve();
        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = reject;
        document.head.appendChild(script);
      });

    let destroyed = false;

    ensureScript().then(() => {
      if (destroyed || !containerRef.current || !window.TradingView) return;

      // limpiar widget anterior si existe
      if (widgetRef.current && widgetRef.current.remove) {
        widgetRef.current.remove();
      }

      // crear widget
      widgetRef.current = new window.TradingView.widget({
        symbol,                       // <- dinámico
        interval,                     // 'D' diario
        container_id: containerRef.current.id,
        width: '100%',
        height,
        timezone: 'Etc/UTC',
        theme,                        // 'dark' o 'light'
        style: '1',                   // estilo de velas
        locale: 'es',
        hide_side_toolbar: false,
        withdateranges: true,
        allow_symbol_change: false,
        hide_top_toolbar: false,
        save_image: false,
        studies: [],
        // Opcional: branding
        // toolbar_bg: '#0B1221',
        // overrides: { 'paneProperties.background': '#111A2E' },
      });
    });

    // cleanup al desmontar o cambiar de símbolo
    return () => {
      destroyed = true;
      if (widgetRef.current && widgetRef.current.remove) {
        widgetRef.current.remove();
      }
    };
  }, [symbol, height, interval, theme]);

  return (
    <div
      id="tv_chart_container"
      ref={containerRef}
      className="rounded-2xl overflow-hidden border border-[#1E293B]/40"
      style={{ minHeight: height, background: '#0B1221' }}
    />
  );
}
