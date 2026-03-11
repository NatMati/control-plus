// src/app/movimientos/ImportBankStatement.tsx
"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

type MovementType = "INCOME" | "EXPENSE" | "TRANSFER_PENDING";

type ExtractedMovement = {
  date: string;
  amount: number;
  type: MovementType;
  transferDirection?: "IN" | "OUT";
  category: string | null;
  description: string;
  raw: string;
  accountId?: string | null;
  counterpartyAccountId?: string | null;
};

type AccountOption = {
  id: string;
  name: string;
  currency: string;
};

type Meta = {
  period: string | null;
  bank: string | null;
  currency: string;
  opening_balance: number | null;
  closing_balance: number | null;
  total_extracted: number;
};

const CATEGORIES = [
  "Comida", "Transporte", "Supermercado", "Servicios",
  "Entretenimiento", "Salud", "Educación", "Regalos",
  "Suscripciones", "Inversiones", "Transferencia", "Cambio de moneda", "Otro",
];

// ── Tipos aceptados ───────────────────────────────────────────────────────────
const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "application/pdf",
  "image/jpeg":      "image/jpeg",
  "image/jpg":       "image/jpeg",
  "image/png":       "image/png",
  "image/webp":      "image/webp",
  "image/gif":       "image/gif",
};
const ACCEPT_ATTR = "application/pdf,image/jpeg,image/jpg,image/png,image/webp";

function fmtMoney(n: number) {
  return n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Props = {
  accounts: AccountOption[];
  onImported?: () => void;
};

export default function ImportBankStatement({ accounts, onImported }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"idle" | "loading" | "review" | "importing" | "done">("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [movements, setMovements] = useState<ExtractedMovement[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [defaultAccountId, setDefaultAccountId] = useState<string>(accounts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  const pendingTransfers = movements.filter(
    (m) => m.type === "TRANSFER_PENDING" && !m.counterpartyAccountId
  ).length;

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    const mediaType = ACCEPTED_TYPES[file.type];
    if (!mediaType) {
      setError("Formato no soportado. Subí un PDF o imagen (JPG, PNG, WEBP).");
      return;
    }

    // Límite de tamaño
    const maxSize = file.type === "application/pdf" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`Archivo demasiado grande (máx. ${file.type === "application/pdf" ? "10" : "5"}MB).`);
      return;
    }

    setFileName(file.name);
    setError(null);
    setStep("loading");

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // PDF → pdfBase64 | imagen → imageBase64
      const isPdf = file.type === "application/pdf";
      const body = isPdf
        ? { pdfBase64: base64, mediaType }
        : { imageBase64: base64, mediaType };

      const res = await fetch("/api/movements/import-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`);

      const withAccount = (data.movements as ExtractedMovement[]).map((m) => ({
        ...m,
        accountId: defaultAccountId || null,
      }));

      setMovements(withAccount);
      setMeta(data.meta);
      setStep("review");
    } catch (e: any) {
      setError(e?.message ?? "Error inesperado.");
      setStep("idle");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function updateMovement(idx: number, field: keyof ExtractedMovement, value: any) {
    setMovements((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  }

  function removeMovement(idx: number) {
    setMovements((prev) => prev.filter((_, i) => i !== idx));
  }

  function assignAccountToAll(accountId: string) {
    setDefaultAccountId(accountId);
    setMovements((prev) => prev.map((m) => ({ ...m, accountId })));
  }

  function resolveType(m: ExtractedMovement): "INCOME" | "EXPENSE" | "TRANSFER" {
    if (m.type === "TRANSFER_PENDING") {
      if (m.counterpartyAccountId) return "TRANSFER";
      return m.transferDirection === "IN" ? "INCOME" : "EXPENSE";
    }
    return m.type;
  }

  async function handleConfirm() {
    if (!movements.length) return;
    setStep("importing");
    setError(null);

    try {
      const rows = movements.map((m) => {
        const resolvedType = resolveType(m);
        return {
          date: m.date,
          amount: m.amount,
          type: resolvedType,
          category: m.category,
          description: m.description,
          accountId: m.accountId || defaultAccountId || null,
          ...(resolvedType === "TRANSFER" && {
            counterpartyAccountId: m.counterpartyAccountId,
            transferLeg: m.transferDirection ?? "OUT",
          }),
        };
      });

      const res = await fetch("/api/movements/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, defaultAccountId: defaultAccountId || null }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`);

      setImportedCount(data.inserted ?? movements.length);
      setStep("done");
      router.refresh();
      if (onImported) onImported();
    } catch (e: any) {
      setError(e?.message ?? "Error al importar.");
      setStep("review");
    }
  }

  function handleReset() {
    setStep("idle");
    setMovements([]);
    setMeta(null);
    setFileName(null);
    setError(null);
    setImportedCount(0);
  }

  function typeLabel(m: ExtractedMovement) {
    if (m.type === "INCOME") return { label: "Ingreso", color: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" };
    if (m.type === "EXPENSE") return { label: "Gasto", color: "text-rose-300 bg-rose-500/10 border-rose-500/30" };
    if (m.type === "TRANSFER_PENDING") {
      if (m.counterpartyAccountId)
        return { label: m.transferDirection === "IN" ? "Transfer ↓" : "Transfer ↑", color: "text-sky-300 bg-sky-500/10 border-sky-500/30" };
      return { label: m.transferDirection === "IN" ? "Traspaso ↓" : "Traspaso ↑", color: "text-amber-300 bg-amber-500/10 border-amber-500/30" };
    }
    return { label: "—", color: "" };
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">✦</span>
            <h3 className="text-sm font-semibold text-slate-100">Importar estado de cuenta con IA</h3>
            <span className="px-1.5 py-0.5 rounded text-xs bg-teal-500/10 text-teal-300 border border-teal-500/20">Beta</span>
          </div>
          <p className="text-xs text-slate-400 mt-1 pl-6">
            Subí el PDF o una foto de tu estado de cuenta. La IA extrae y categoriza los movimientos automáticamente.
          </p>
        </div>

        {step === "idle" && (
          <label className="shrink-0 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-teal-700/50 bg-teal-950/30 px-3 py-1.5 text-xs font-medium text-teal-300 hover:bg-teal-950/60 transition-colors">
            📎 Subir archivo
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTR}
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        )}

        {(step === "review" || step === "done") && (
          <button onClick={handleReset} className="shrink-0 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 transition-colors">
            Nuevo archivo
          </button>
        )}
      </div>

      {/* Formatos */}
      {step === "idle" && (
        <div className="flex items-center gap-2 pl-6 flex-wrap">
          {["PDF", "JPG", "PNG", "WEBP"].map(f => (
            <span key={f} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800/60 text-slate-500 border border-slate-700/40 font-mono">{f}</span>
          ))}
          <span className="text-[10px] text-slate-600">· máx. 10MB PDF / 5MB imagen</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-700/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">{error}</div>
      )}

      {/* Loading */}
      {step === "loading" && (
        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-5">
          <div className="w-5 h-5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin shrink-0" />
          <div>
            <div className="text-sm text-slate-200">Analizando {fileName}...</div>
            <div className="text-xs text-slate-500 mt-0.5">Claude está leyendo y extrayendo los movimientos. Puede tomar 10-20 segundos.</div>
          </div>
        </div>
      )}

      {/* Done */}
      {step === "done" && (
        <div className="rounded-lg border border-emerald-700/50 bg-emerald-950/20 px-4 py-4 text-sm text-emerald-300">
          ✓ {importedCount} movimientos importados correctamente.
        </div>
      )}

      {/* Review */}
      {step === "review" && (
        <div className="space-y-4">

          {meta && (
            <div className="flex flex-wrap gap-2 text-xs">
              {meta.bank && <span className="px-2 py-1 rounded-md bg-slate-800 text-slate-300">🏦 {meta.bank}</span>}
              {meta.period && <span className="px-2 py-1 rounded-md bg-slate-800 text-slate-300">📅 {meta.period}</span>}
              <span className="px-2 py-1 rounded-md bg-slate-800 text-slate-300">💱 {meta.currency}</span>
              {meta.opening_balance !== null && (
                <span className="px-2 py-1 rounded-md bg-slate-800 text-slate-300">Apertura: {fmtMoney(meta.opening_balance)}</span>
              )}
              {meta.closing_balance !== null && (
                <span className="px-2 py-1 rounded-md bg-slate-800 text-slate-300">Cierre: {fmtMoney(meta.closing_balance)}</span>
              )}
              <span className="px-2 py-1 rounded-md bg-teal-900/40 text-teal-300 border border-teal-700/30">
                {movements.length} movimientos
              </span>
            </div>
          )}

          {pendingTransfers > 0 && (
            <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 px-3 py-2.5 text-xs text-amber-300">
              <span className="font-semibold">{pendingTransfers} traspaso{pendingTransfers > 1 ? "s" : ""} sin cuenta contraparte.</span>{" "}
              En la columna <span className="font-semibold">Contraparte</span> elegí a qué cuenta tuya corresponde cada traspaso.
              Si no lo asignás, se importará como ingreso o gasto según la dirección.
            </div>
          )}

          <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5">
            <span className="text-xs text-slate-400 shrink-0">Cuenta origen (todos):</span>
            <select
              value={defaultAccountId}
              onChange={(e) => assignAccountToAll(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500/50"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-xs">
              <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Descripción</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Categoría</th>
                  <th className="px-3 py-2 text-right">Monto</th>
                  <th className="px-3 py-2 text-left">Cuenta origen</th>
                  <th className="px-3 py-2 text-left">Contraparte</th>
                  <th className="px-3 py-2 text-center">✕</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {movements.map((m, idx) => {
                  const { label, color } = typeLabel(m);
                  const isTransfer = m.type === "TRANSFER_PENDING";
                  const amtColor = m.transferDirection === "IN" || m.type === "INCOME"
                    ? "text-emerald-300"
                    : "text-rose-300";
                  const sign = m.transferDirection === "IN" || m.type === "INCOME" ? "+" : "-";

                  return (
                    <tr key={idx} className={`hover:bg-slate-900/40 transition-colors ${isTransfer && !m.counterpartyAccountId ? "bg-amber-950/10" : "bg-slate-950/20"}`}>
                      <td className="px-3 py-2 font-mono text-slate-300 whitespace-nowrap">{m.date}</td>
                      <td className="px-3 py-2 max-w-[160px]">
                        <input
                          value={m.description}
                          onChange={(e) => updateMovement(idx, "description", e.target.value)}
                          className="w-full bg-transparent border-b border-transparent hover:border-slate-600 focus:border-teal-500 outline-none text-slate-200 py-0.5"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${color}`}>{label}</span>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={m.category ?? ""}
                          onChange={(e) => updateMovement(idx, "category", e.target.value || null)}
                          className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500/50 max-w-[120px]"
                        >
                          <option value="">Sin categoría</option>
                          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                        <span className={amtColor}>{sign}{fmtMoney(m.amount)}</span>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={m.accountId ?? defaultAccountId}
                          onChange={(e) => updateMovement(idx, "accountId", e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500/50 max-w-[110px]"
                        >
                          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        {isTransfer ? (
                          <select
                            value={m.counterpartyAccountId ?? ""}
                            onChange={(e) => updateMovement(idx, "counterpartyAccountId", e.target.value || null)}
                            className={`border rounded px-1.5 py-0.5 text-xs focus:outline-none max-w-[120px] ${
                              m.counterpartyAccountId
                                ? "bg-slate-900 border-teal-700/50 text-slate-200 focus:border-teal-500/50"
                                : "bg-amber-950/20 border-amber-700/50 text-amber-300 focus:border-amber-500/50"
                            }`}
                          >
                            <option value="">Sin vincular</option>
                            {accounts
                              .filter((a) => a.id !== (m.accountId ?? defaultAccountId))
                              .map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => removeMovement(idx)} className="text-slate-600 hover:text-rose-400 transition-colors">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-4 pt-1">
            <div className="flex flex-wrap gap-4 text-xs text-slate-400">
              <span>
                Gastos:{" "}
                <span className="text-rose-300 font-mono">
                  -{fmtMoney(movements.filter(m => m.type === "EXPENSE" || (m.type === "TRANSFER_PENDING" && m.transferDirection === "OUT")).reduce((s, m) => s + m.amount, 0))}
                </span>
              </span>
              <span>
                Ingresos:{" "}
                <span className="text-emerald-300 font-mono">
                  +{fmtMoney(movements.filter(m => m.type === "INCOME" || (m.type === "TRANSFER_PENDING" && m.transferDirection === "IN")).reduce((s, m) => s + m.amount, 0))}
                </span>
              </span>
              {pendingTransfers > 0 && (
                <span className="text-amber-300">{pendingTransfers} traspaso{pendingTransfers > 1 ? "s" : ""} sin vincular → se importarán como ingreso/gasto</span>
              )}
            </div>

            <div className="flex gap-2 shrink-0">
              <button onClick={handleReset} className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={!movements.length || !defaultAccountId}
                className="px-4 py-1.5 text-xs rounded-lg bg-teal-500 hover:bg-teal-400 text-black font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar e importar {movements.length} movimientos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
