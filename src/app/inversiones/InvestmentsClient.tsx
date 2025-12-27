"use client";

import React, { useRef, useState } from "react";

type Props = {
  onImported?: () => void;
  onCleared?: () => void;
  className?: string;
};

function notify(msg: string) {
  // Fallback universal (si no estás usando toast/sonner en este componente)
  if (typeof window !== "undefined") window.alert(msg);
}

export default function ImportInvestmentsCsv({
  onImported,
  onCleared,
  className,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const pickFile = () => {
    console.log("[CSV] pickFile()");
    if (!fileRef.current) {
      console.warn("[CSV] fileRef is null");
      notify("No se encontró el input de archivo.");
      return;
    }
    fileRef.current.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("[CSV] onChange fired");
    const file = e.target.files?.[0];

    console.log("[CSV] file:", file?.name, file?.size, file?.type);

    // IMPORTANTE: permitir re-seleccionar el mismo archivo luego
    // (si no reseteás, elegir el mismo CSV no dispara onChange)
    e.target.value = "";

    if (!file) return;

    try {
      setIsImporting(true);

      const fd = new FormData();
      fd.append("file", file);

      console.log("[CSV] POST /api/investments/import-csv (multipart/form-data)");

      const res = await fetch("/api/investments/import-csv", {
        method: "POST",
        body: fd,
      });

      const text = await res.text();
      let json: any = null;

      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        // si no es JSON, igual queremos ver el body para debug
      }

      if (!res.ok) {
        console.error("[CSV] Import failed:", res.status, text);
        const msg =
          json?.error ||
          `No se pudo importar el CSV (HTTP ${res.status}). Mirá consola para detalles.`;
        notify(msg);
        return;
      }

      console.log("[CSV] Import OK:", json);

      const inserted = json?.inserted ?? 0;
      const received = json?.received ?? undefined;
      const valid = json?.valid ?? undefined;

      notify(
        `Importación OK. Insertadas: ${inserted}` +
          (received !== undefined ? ` | Filas recibidas: ${received}` : "") +
          (valid !== undefined ? ` | Válidas: ${valid}` : "")
      );

      onImported?.();
    } catch (err) {
      console.error("[CSV] Unexpected error importing:", err);
      notify("Error inesperado al importar. Mirá consola para detalles.");
    } finally {
      setIsImporting(false);
    }
  };

  const clearAll = async () => {
    const ok = confirm(
      "Esto va a borrar todas tus inversiones importadas. ¿Querés continuar?"
    );
    if (!ok) return;

    try {
      setIsClearing(true);
      console.log("[CSV] DELETE /api/investments/clear");

      const res = await fetch("/api/investments/clear", {
        method: "DELETE",
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {}

      if (!res.ok) {
        console.error("[CSV] Clear failed:", res.status, text);
        const msg =
          json?.error ||
          `No se pudo limpiar inversiones (HTTP ${res.status}). Mirá consola.`;
        notify(msg);
        return;
      }

      console.log("[CSV] Clear OK:", json);
      notify("Inversiones limpiadas correctamente.");
      onCleared?.();
    } catch (err) {
      console.error("[CSV] Unexpected error clearing:", err);
      notify("Error inesperado al limpiar. Mirá consola para detalles.");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className={className}>
      {/* Input real, hidden */}
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={handleFileSelected}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={clearAll}
          disabled={isClearing || isImporting}
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/20 disabled:opacity-50"
        >
          {isClearing ? "Limpiando..." : "Limpiar inversiones"}
        </button>

        <button
          type="button"
          onClick={pickFile}
          disabled={isImporting || isClearing}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50"
        >
          {isImporting ? "Importando..." : "Elegir archivo CSV"}
        </button>
      </div>
    </div>
  );
}
