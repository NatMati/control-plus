// src/components/movements/ImportCsv.tsx
"use client";

import { useState, type ChangeEvent } from "react";
import Papa from "papaparse";

type MovementImportRow = {
  date: string;
  amount: number;
  type?: string | null;
  category?: string | null;
  description?: string | null;
};

type Props = {
  onImported?: () => void;
};

function normalizeHeader(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-z0-9]/g, ""); // saca espacios y símbolos
}

/**
 * Intenta mapear columnas comunes:
 *  - fecha, date
 *  - monto, amount, importe
 *  - tipo, type
 *  - categoria, categoria, category
 *  - descripcion, description, detalle
 */
function mapCsvRow(rawRow: Record<string, any>): MovementImportRow | null {
  const entries = Object.entries(rawRow ?? {});
  if (!entries.length) return null;

  const normalized: Record<string, string> = {};
  for (const [key, value] of entries) {
    const normKey = normalizeHeader(key);
    normalized[normKey] = String(value ?? "").trim();
  }

  // Fecha
  const date =
    normalized["fecha"] ||
    normalized["date"] ||
    normalized["dia"] ||
    "";

  // Monto
  const amountStr =
    normalized["monto"] ||
    normalized["amount"] ||
    normalized["importe"] ||
    "";
  const amount = Number(
    amountStr.replace(/\./g, "").replace(",", ".") // 1.234,56 → 1234.56
  );

  if (!date || !amount || isNaN(amount)) {
    return null;
  }

  // Tipo
  const type =
    normalized["tipo"] ||
    normalized["type"] ||
    normalized["movimiento"] ||
    normalized["clase"] ||
    null;

  // Categoría
  const category =
    normalized["categoria"] ||
    normalized["category"] ||
    null;

  // Descripción
  const description =
    normalized["descripcion"] ||
    normalized["description"] ||
    normalized["detalle"] ||
    null;

  return {
    date,
    amount,
    type,
    category,
    description,
  };
}

export default function ImportCsv({ onImported }: Props) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<MovementImportRow[]>([]);
  const [rowsToSend, setRowsToSend] = useState<MovementImportRow[]>([]);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParsingError(null);
    setImportResult(null);
    setPreview([]);
    setRowsToSend([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as Record<string, any>[];

        const mapped: MovementImportRow[] = [];
        for (const rawRow of data) {
          const m = mapCsvRow(rawRow);
          if (m) mapped.push(m);
        }

        if (!mapped.length) {
          setParsingError(
            "No se encontraron filas válidas. Verificá que el CSV tenga columnas como Fecha, Monto, Tipo..."
          );
          return;
        }

        setRowsToSend(mapped);
        setPreview(mapped.slice(0, 5)); // primeras 5 para preview
      },
      error: (err) => {
        console.error("[ImportCsv] CSV parse error:", err);
        setParsingError("Error al leer el archivo CSV.");
      },
    });
  };

  const handleImport = async () => {
    if (!rowsToSend.length) {
      setParsingError("No hay datos para importar.");
      return;
    }

    try {
      setImporting(true);
      setParsingError(null);
      setImportResult(null);

      const res = await fetch("/api/movements/import-csv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rows: rowsToSend }),
      });

      const json = await res.json();

      if (!res.ok) {
        setParsingError(json.error || "Error al importar movimientos.");
        return;
      }

      setImportResult(
        `Importación completa: ${json.inserted ?? rowsToSend.length} movimientos agregados.`
      );
      setRowsToSend([]);
      setPreview([]);

      if (onImported) onImported();
    } catch (err: any) {
      console.error("[ImportCsv] Import error:", err);
      setParsingError("Error inesperado al enviar los datos.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Importar movimientos desde CSV
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Exportá tus movimientos desde Excel, Google Sheets o Notas en formato
            .csv con columnas como <strong>Fecha</strong>, <strong>Monto</strong>,{" "}
            <strong>Tipo</strong>, <strong>Categoría</strong>,{" "}
            <strong>Descripción</strong>.
          </p>
        </div>

        <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800">
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
          Elegir archivo CSV
        </label>
      </div>

      {fileName && (
        <p className="text-xs text-slate-400">
          Archivo seleccionado: <span className="font-medium">{fileName}</span>
        </p>
      )}

      {parsingError && (
        <div className="rounded border border-red-700 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {parsingError}
        </div>
      )}

      {preview.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">
            Vista previa de las primeras {preview.length} filas:
          </p>
          <div className="max-h-40 overflow-auto rounded-lg border border-slate-800 bg-slate-900/60 text-xs">
            <table className="min-w-full border-collapse">
              <thead className="bg-slate-900/80 text-slate-300">
                <tr>
                  <th className="px-2 py-1 text-left">Fecha</th>
                  <th className="px-2 py-1 text-right">Monto</th>
                  <th className="px-2 py-1 text-left">Tipo</th>
                  <th className="px-2 py-1 text-left">Categoría</th>
                  <th className="px-2 py-1 text-left">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-t border-slate-800/60 text-slate-200"
                  >
                    <td className="px-2 py-1">{row.date}</td>
                    <td className="px-2 py-1 text-right">
                      {row.amount.toLocaleString("es-UY", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-2 py-1">{row.type ?? "-"}</td>
                    <td className="px-2 py-1">{row.category ?? "-"}</td>
                    <td className="px-2 py-1">{row.description ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Total listo para importar:{" "}
              <span className="font-semibold text-slate-200">
                {rowsToSend.length}
              </span>{" "}
              movimientos.
            </p>
            <button
              onClick={handleImport}
              disabled={importing || rowsToSend.length === 0}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing ? "Importando..." : "Importar movimientos"}
            </button>
          </div>
        </div>
      )}

      {importResult && (
        <div className="rounded border border-emerald-700 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
          {importResult}
        </div>
      )}
    </div>
  );
}
