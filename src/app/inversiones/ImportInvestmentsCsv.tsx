"use client";

import { useState, type ChangeEvent } from "react";
import Papa from "papaparse";

type InvestmentTradeRow = {
  date: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  totalUsd: number;
  feeUsd: number;
  realizedPnlUsd: number;
  note?: string;
  externalId?: string | null;
};

type Props = {
  onImported?: () => void;
};

function normalizeHeader(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Parse numérico “inteligente” para formatos tipo:
 *  - 1.234,56
 *  - 1,234.56
 *  - 1234,56
 *  - 1234.56
 */
function parseNumber(raw: any): number {
  if (raw === null || raw === undefined) return 0;
  let s = String(raw).trim();
  if (!s) return 0;

  s = s.replace(/[^\d,.\-]/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma && !hasDot) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function normalizeDateToISO(dateRaw: string): string | null {
  const s = String(dateRaw ?? "").trim();
  if (!s) return null;

  // Ya viene ISO (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Formatos con / o -
  const parts = s.split(/[\/\-]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 3) return null;

  let [a, b, c] = parts;

  // Detectar si es YYYY/MM/DD o DD/MM/YYYY
  // Si el primer componente tiene 4 dígitos -> YYYY
  if (/^\d{4}$/.test(a)) {
    const yyyy = a;
    const mm = b.padStart(2, "0");
    const dd = c.padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // Caso común LATAM: DD/MM/YY o DD/MM/YYYY
  let dd = a.padStart(2, "0");
  let mm = b.padStart(2, "0");
  let yyyy = c;

  // Año 2 dígitos -> 20xx (asumimos 2000-2099)
  if (/^\d{2}$/.test(yyyy)) {
    yyyy = `20${yyyy}`;
  }

  if (!/^\d{4}$/.test(yyyy)) return null;

  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Mapea una fila cruda del CSV (objeto con headers -> valores)
 */
function mapInvestmentCsvRow(
  rawRow: Record<string, any>
): InvestmentTradeRow | null {
  const entries = Object.entries(rawRow ?? {});
  if (!entries.length) return null;

  const normalized: Record<string, string> = {};
  for (const [key, value] of entries) {
    const normKey = normalizeHeader(key);
    normalized[normKey] = String(value ?? "").trim();
  }

  // Fecha
  const dateRaw =
    normalized["fecha"] ||
    normalized["date"] ||
    normalized["dia"] ||
    "";

  const iso = normalizeDateToISO(dateRaw);
  if (!iso) return null;

  // Activo / ticker
  const symbol =
    normalized["activo"] ||
    normalized["ticker"] ||
    normalized["symbol"] ||
    "";

  if (!symbol) return null;

  // Tipo Compra / Venta -> BUY / SELL
  const tipoRaw =
    normalized["tipo"] ||
    normalized["tipocompraventa"] ||
    normalized["operacion"] ||
    "";

  const tipoLower = tipoRaw.toLowerCase();
  let side: "BUY" | "SELL";
  if (tipoLower.startsWith("compra") || tipoLower === "buy") side = "BUY";
  else if (tipoLower.startsWith("venta") || tipoLower === "sell") side = "SELL";
  else return null;

  const quantity =
    parseNumber(
      normalized["cantidad"] ||
        normalized["qty"] ||
        normalized["units"] ||
        ""
    ) || 0;

  const price =
    parseNumber(
      normalized["preciounidad"] ||
        normalized["precio"] ||
        normalized["price"] ||
        ""
    ) || 0;

  const totalUsd =
    parseNumber(
      normalized["montousd"] ||
        normalized["monto"] ||
        normalized["importe"] ||
        ""
    ) || 0;

  const feeUsd =
    parseNumber(
      normalized["comisionusd"] ||
        normalized["comision"] ||
        normalized["fee"] ||
        ""
    ) || 0;

  const realizedPnlUsd =
    parseNumber(
      normalized["gananciarealizada"] ||
        normalized["pnl"] ||
        normalized["ganancia"] ||
        ""
    ) || 0;

  const note =
    normalized["comentario"] ||
    normalized["nota"] ||
    normalized["detalle"] ||
    "";

  const externalId =
    normalized["id"] ||
    normalized["tradeid"] ||
    null;

  if (!quantity || !price) return null;

  return {
    date: iso,
    symbol: symbol.toUpperCase(),
    side,
    quantity,
    price,
    totalUsd,
    feeUsd,
    realizedPnlUsd,
    note: note || undefined,
    externalId: externalId || undefined,
  };
}

export default function ImportInvestmentsCsv({ onImported }: Props) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvestmentTradeRow[]>([]);
  const [rowsToSend, setRowsToSend] = useState<InvestmentTradeRow[]>([]);
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

        const mapped: InvestmentTradeRow[] = [];
        for (const rawRow of data) {
          const m = mapInvestmentCsvRow(rawRow);
          if (m) mapped.push(m);
        }

        if (!mapped.length) {
          setParsingError(
            "No se encontraron filas válidas. Verificá columnas (Fecha, Activo, Tipo, Monto USD, Precio unidad, Cantidad, etc.) y formato de fecha."
          );
          return;
        }

        setRowsToSend(mapped);
        setPreview(mapped.slice(0, 8));
      },
      error: (err) => {
        console.error("[ImportInvestmentsCsv] CSV parse error:", err);
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

      const res = await fetch("/api/investments/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rowsToSend }),
      });

      const json = await res.json();

      if (!res.ok) {
        setParsingError(json.error || "Error al importar inversiones.");
        return;
      }

      setImportResult(
        `Importación completa: ${json.inserted ?? rowsToSend.length} operaciones agregadas (sin duplicar las que ya existían).`
      );
      setRowsToSend([]);
      setPreview([]);

      onImported?.();
    } catch (err: any) {
      console.error("[ImportInvestmentsCsv] Import error:", err);
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
            Importar operaciones de inversión desde CSV
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Exportá tu hoja de <strong>Inversiones</strong> en formato .csv. Se
            esperan columnas como <strong>Fecha</strong>, <strong>Activo</strong>,{" "}
            <strong>Tipo (Compra/Venta)</strong>, <strong>Monto USD</strong>,{" "}
            <strong>Precio unidad</strong>, <strong>Cantidad</strong>,{" "}
            <strong>Comisión</strong> y <strong>Ganancia realizada</strong>.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Este importador <span className="font-semibold">no toca tus movimientos</span>,
            solo agrega operaciones a la tabla de inversiones.
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
            Vista previa de las primeras {preview.length} operaciones:
          </p>

          <div className="max-h-52 overflow-auto rounded-lg border border-slate-800 bg-slate-900/60 text-xs">
            <table className="min-w-full border-collapse">
              <thead className="bg-slate-900/80 text-slate-300">
                <tr>
                  <th className="px-2 py-1 text-left">Fecha</th>
                  <th className="px-2 py-1 text-left">Activo</th>
                  <th className="px-2 py-1 text-left">Tipo</th>
                  <th className="px-2 py-1 text-right">Cantidad</th>
                  <th className="px-2 py-1 text-right">Precio</th>
                  <th className="px-2 py-1 text-right">Monto USD</th>
                  <th className="px-2 py-1 text-right">Comisión</th>
                  <th className="px-2 py-1 text-right">Ganancia real.</th>
                  <th className="px-2 py-1 text-left">Comentario</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, idx) => (
                  <tr key={idx} className="border-t border-slate-800">
                    <td className="px-2 py-1">{row.date}</td>
                    <td className="px-2 py-1">{row.symbol}</td>
                    <td className="px-2 py-1">{row.side}</td>
                    <td className="px-2 py-1 text-right">
                      {row.quantity.toLocaleString("es-UY", {
                        maximumFractionDigits: 6,
                      })}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {row.price.toLocaleString("es-UY", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4,
                      })}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {row.totalUsd.toLocaleString("es-UY", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {row.feeUsd.toLocaleString("es-UY", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {row.realizedPnlUsd.toLocaleString("es-UY", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-2 py-1">{row.note || "-"}</td>
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
              operaciones.
            </p>
            <button
              onClick={handleImport}
              disabled={importing || rowsToSend.length === 0}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing ? "Importando..." : "Importar inversiones"}
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
