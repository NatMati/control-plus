// src/app/movimientos/ImportCsv.tsx
"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";

type MovementImportRow = {
  date: string;
  amount: number;
  type?: string | null;
  category?: string | null;
  description?: string | null;

  // NUEVO: para asignación automática
  accountName?: string | null; // nombre detectado desde CSV (si existe)
  accountId?: string | null; // id resuelto contra /api/accounts (si existe)
};

type AccountOption = {
  id: string;
  name: string;
  currency: string;
  type: string;
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

function normalizeText(raw: string): string {
  return (raw ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAccountFromRow(normalized: Record<string, string>): string | null {
  // Columnas típicas donde suele venir la cuenta / medio / banco
  const candidates = [
    "cuenta",
    "account",
    "origen",
    "source",
    "medio",
    "mediopago",
    "metodo",
    "metodopago",
    "banco",
    "wallet",
    "cartera",
    "tarjeta",
    "instrumento",
  ];

  for (const key of candidates) {
    const v = normalized[key];
    if (v && v.trim()) return v.trim();
  }

  // A veces viene como "Cuenta asignada", "Cuenta origen", etc.
  // Buscamos por contains sobre keys normalizadas:
  for (const [k, v] of Object.entries(normalized)) {
    if (!v?.trim()) continue;
    if (
      k.includes("cuenta") ||
      k.includes("account") ||
      k.includes("banco") ||
      k.includes("origen") ||
      k.includes("wallet") ||
      k.includes("cartera") ||
      k.includes("tarjeta") ||
      k.includes("metodo") ||
      k.includes("medio")
    ) {
      return v.trim();
    }
  }

  return null;
}

function resolveAccountId(accountNameRaw: string, accounts: AccountOption[]): string | null {
  const raw = normalizeText(accountNameRaw);
  if (!raw) return null;

  // Caso: "Banco Itaú (UYU)" o "Santander USD" etc.
  // Intentamos detectar moneda entre paréntesis
  const currencyMatch = raw.match(/\((uyu|usd|eur|ars)\)/i);
  const hintedCurrency = currencyMatch?.[1]?.toUpperCase() ?? null;

  // Limpia "(UYU)" del nombre
  const cleanedName = raw.replace(/\((uyu|usd|eur|ars)\)/gi, "").trim();

  // 1) Match exacto por nombre limpio
  const exact = accounts.find(
    (a) => normalizeText(a.name) === cleanedName && (!hintedCurrency || a.currency === hintedCurrency)
  );
  if (exact) return exact.id;

  // 2) Match por includes (p.ej. "itau" matchea "Banco Itaú (UYU)")
  const partial = accounts.find((a) => {
    const an = normalizeText(a.name);
    const okName = an.includes(cleanedName) || cleanedName.includes(an);
    const okCurrency = !hintedCurrency || a.currency === hintedCurrency;
    return okName && okCurrency;
  });
  if (partial) return partial.id;

  // 3) Match por tokens (más permisivo)
  const tokens = cleanedName.split(" ").filter(Boolean);
  const tokenMatch = accounts.find((a) => {
    const an = normalizeText(a.name);
    const okCurrency = !hintedCurrency || a.currency === hintedCurrency;
    const score = tokens.reduce((acc, t) => acc + (an.includes(t) ? 1 : 0), 0);
    return okCurrency && score >= Math.min(2, tokens.length); // al menos 2 tokens (si existen)
  });
  return tokenMatch?.id ?? null;
}

/**
 * Intenta mapear columnas comunes:
 *  - fecha, date, dia, periodo
 *  - monto, amount, importe
 *  - tipo, type, movimiento, clase
 *  - categoria, category
 *  - descripcion, description, detalle
 *  - cuenta / banco / medio / origen / wallet (NUEVO)
 *
 * La idea es adaptar tu Google Sheets:
 *  Tipo | Categoría | Monto | Descripción | Medio | Periodo | Año | ID
 */
function mapCsvRow(rawRow: Record<string, any>): MovementImportRow | null {
  const entries = Object.entries(rawRow ?? {});
  if (!entries.length) return null;

  const normalized: Record<string, string> = {};
  for (const [key, value] of entries) {
    const normKey = normalizeHeader(key);
    normalized[normKey] = String(value ?? "").trim();
  }

  // Fecha: aceptamos "Fecha" normal o tu columna "Periodo" (YYYY-MM)
  const date =
    normalized["fecha"] ||
    normalized["date"] ||
    normalized["dia"] ||
    normalized["periodo"] || // <-- Google Sheets: Periodo
    "";

  if (!date) return null;

  // Monto: limpiamos símbolo $, puntos de miles y comas decimales
  const amountStr = normalized["monto"] || normalized["amount"] || normalized["importe"] || "";
  const amount = Number(
    amountStr
      .replace(/\$/g, "") // quita $
      .replace(/\./g, "") // quita separador de miles 27.531 -> 27531
      .replace(",", ".") // coma decimal -> punto
  );

  if (!amount || isNaN(amount)) return null;

  // Tipo
  const type =
    normalized["tipo"] ||
    normalized["type"] ||
    normalized["movimiento"] ||
    normalized["clase"] ||
    null;

  // Categoría
  const category = normalized["categoria"] || normalized["category"] || null;

  // Descripción
  const description =
    normalized["descripcion"] ||
    normalized["description"] ||
    normalized["detalle"] ||
    null;

  // Cuenta / Medio / Banco (NUEVO)
  const accountName = extractAccountFromRow(normalized);

  return { date, amount, type, category, description, accountName };
}

export default function ImportCsv({ onImported }: Props) {
  const router = useRouter();

  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<MovementImportRow[]>([]);
  const [rowsToSend, setRowsToSend] = useState<MovementImportRow[]>([]);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  // Fallback (solo se usa si una fila no trae cuenta o no se pudo resolver)
  const [defaultAccountId, setDefaultAccountId] = useState<string>("");

  const selectedFallbackAccount = useMemo(
    () => accounts.find((a) => a.id === defaultAccountId) ?? null,
    [accounts, defaultAccountId]
  );

  const stats = useMemo(() => {
    const total = rowsToSend.length;
    const withAccountId = rowsToSend.filter((r) => !!r.accountId).length;
    const withAccountName = rowsToSend.filter((r) => !!r.accountName).length;
    const missing = total - withAccountId;
    return { total, withAccountId, withAccountName, missing };
  }, [rowsToSend]);

  // Traer cuentas (usa tu endpoint existente /api/accounts)
  useEffect(() => {
    let alive = true;

    async function loadAccounts() {
      try {
        setAccountsError(null);
        const res = await fetch("/api/accounts", { method: "GET" });
        const json = await res.json();

        if (!res.ok) throw new Error(json?.error || "Error al cargar cuentas.");

        const list: AccountOption[] = Array.isArray(json?.accounts)
          ? json.accounts
          : Array.isArray(json)
          ? json
          : [];

        if (!alive) return;

        setAccounts(list);

        // fallback default: primera cuenta si no hay nada elegido
        if (!defaultAccountId && list.length > 0) {
          setDefaultAccountId(list[0].id);
        }
      } catch (e: any) {
        if (!alive) return;
        setAccountsError(e?.message || "No se pudieron cargar las cuentas.");
      }
    }

    loadAccounts();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            "No se encontraron filas válidas. Verificá que el CSV tenga columnas como Fecha/Periodo, Monto, Tipo..."
          );
          return;
        }

        // Resolver accountId por fila si ya tenemos accounts
        const resolved = mapped.map((r) => {
          if (!r.accountName || !accounts.length) return r;
          const accountId = resolveAccountId(r.accountName, accounts);
          return { ...r, accountId };
        });

        setRowsToSend(resolved);
        setPreview(resolved.slice(0, 5));
      },
      error: (err) => {
        console.error("[ImportCsv] CSV parse error:", err);
        setParsingError("Error al leer el archivo CSV.");
      },
    });
  };

  // Si las accounts cargan después de parsear, resolvemos accountId retroactivamente
  useEffect(() => {
    if (!accounts.length) return;
    if (!rowsToSend.length) return;

    const updated = rowsToSend.map((r) => {
      if (r.accountId) return r;
      if (!r.accountName) return r;
      const accountId = resolveAccountId(r.accountName, accounts);
      return { ...r, accountId };
    });

    // Evitar renders innecesarios
    const changed = updated.some((u, i) => u.accountId !== rowsToSend[i]?.accountId);
    if (changed) {
      setRowsToSend(updated);
      setPreview(updated.slice(0, 5));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  const handleImport = async () => {
    if (!rowsToSend.length) {
      setParsingError("No hay datos para importar.");
      return;
    }

    // Solo exigimos fallback si hay filas sin cuenta resuelta
    if (stats.missing > 0 && !defaultAccountId) {
      setParsingError("Hay movimientos sin cuenta detectada. Elegí una cuenta fallback.");
      return;
    }

    try {
      setImporting(true);
      setParsingError(null);
      setImportResult(null);

      const res = await fetch("/api/movements/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rowsToSend, // incluye accountId por fila (si se pudo resolver)
          defaultAccountId: stats.missing > 0 ? defaultAccountId : null, // fallback solo si hace falta
        }),
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

      router.refresh();
      if (onImported) onImported();
    } catch (err: any) {
      console.error("[ImportCsv] Import error:", err);
      setParsingError("Error inesperado al enviar los datos.");
    } finally {
      setImporting(false);
    }
  };

  // Mostrar selector solo si hace falta (hay filas sin cuenta detectada/resuelta)
  const showFallbackSelector = stats.total > 0 && stats.missing > 0;

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Importar movimientos desde CSV
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Exportá tus movimientos desde Excel, Google Sheets o Notas en formato .csv con columnas como{" "}
            <strong>Fecha / Periodo</strong>, <strong>Monto</strong>, <strong>Tipo</strong>,{" "}
            <strong>Categoría</strong>, <strong>Descripción</strong>.{" "}
            Si tu CSV incluye <strong>Cuenta / Medio / Banco</strong>, la asignación se hace automáticamente.
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

      {/* Estado de detección de cuentas */}
      {stats.total > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs">
          <div className="text-slate-200">
            <span className="font-medium">Cuentas detectadas:</span>{" "}
            <span className="text-slate-300">
              {stats.withAccountId}/{stats.total}
            </span>{" "}
            <span className="text-slate-500">
              (con nombre en CSV: {stats.withAccountName}/{stats.total})
            </span>
          </div>

          {stats.missing === 0 ? (
            <div className="text-emerald-200">
              OK: todas las filas tienen cuenta asignada automáticamente.
            </div>
          ) : (
            <div className="text-amber-200">
              Hay {stats.missing} fila(s) sin cuenta detectada o sin match con tus cuentas. Se usará una cuenta fallback.
            </div>
          )}
        </div>
      )}

      {/* Selector fallback solo si hace falta */}
      {showFallbackSelector && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-400">
            <span className="font-medium text-slate-200">Cuenta fallback:</span>{" "}
            {selectedFallbackAccount ? (
              <>
                {selectedFallbackAccount.name}{" "}
                <span className="text-slate-500">({selectedFallbackAccount.currency})</span>
              </>
            ) : (
              "—"
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={defaultAccountId}
              onChange={(e) => setDefaultAccountId(e.target.value)}
              className="h-8 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 outline-none focus:border-slate-500"
            >
              {accounts.length === 0 ? (
                <option value="">Cargando cuentas...</option>
              ) : (
                accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      )}

      {accountsError && (
        <div className="rounded border border-red-700 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {accountsError}
        </div>
      )}

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
                  <th className="px-2 py-1 text-left">Fecha / Periodo</th>
                  <th className="px-2 py-1 text-right">Monto</th>
                  <th className="px-2 py-1 text-left">Tipo</th>
                  <th className="px-2 py-1 text-left">Categoría</th>
                  <th className="px-2 py-1 text-left">Descripción</th>
                  <th className="px-2 py-1 text-left">Cuenta</th>
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
                    <td className="px-2 py-1">
                      {row.accountName ? (
                        row.accountId ? (
                          <span className="text-emerald-200">{row.accountName}</span>
                        ) : (
                          <span className="text-amber-200">{row.accountName}</span>
                        )
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
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
              disabled={
                importing ||
                rowsToSend.length === 0 ||
                (showFallbackSelector && !defaultAccountId)
              }
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
