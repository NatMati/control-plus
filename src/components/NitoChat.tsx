// src/components/NitoChat.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSettings } from "@/context/SettingsContext";
import { useRouter } from "next/navigation";
import { useSubscription, canUseNito, canUseImporter } from "@/hooks/useSubscription";
import { useAchievements } from "@/context/AchievementsContext";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
  action?: NitoAction | null;
  importPayload?: ImportPayload | null;
  timestamp: Date;
};

type NitoAction = {
  action: "register_movement";
  data: {
    date: string; amount: number; type: "INCOME" | "EXPENSE";
    category: string; description: string; accountId: string | null;
  };
};

type ExtractedMovement = {
  date: string; amount: number;
  type: "INCOME" | "EXPENSE" | "TRANSFER_PENDING";
  transferDirection?: "IN" | "OUT";
  category: string | null; description: string; raw: string;
  accountId?: string | null; counterpartyAccountId?: string | null;
  isDuplicate: boolean; duplicateOf: string | null; duplicateDesc?: string | null;
  // Estado de revisión del usuario
  _skip?: boolean;
  _forceImport?: boolean;
};

type ImportMeta = {
  period: string | null; bank: string | null; currency: string;
  opening_balance: number | null; closing_balance: number | null;
  total_extracted: number; duplicates_found: number; transfers_detected: number;
};

type AccountOption = { id: string; name: string; currency: string };

type ImportPayload = {
  movements: ExtractedMovement[];
  meta: ImportMeta;
  accounts: AccountOption[];
  defaultAccountId: string;
};

type Props = {
  fullPage?: boolean;
  accounts?: AccountOption[];
};

// ── Constantes ────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "application/pdf",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
};
const ACCEPT_ATTR = "application/pdf,image/jpeg,image/png,image/webp";

const SUGGESTIONS = [
  { icon: "📊", text: "¿Cómo estoy este mes?" },
  { icon: "🍔", text: "¿Cuánto gasté en comida?" },
  { icon: "💳", text: "¿Cuáles son mis deudas?" },
  { icon: "💡", text: "Dame un consejo financiero" },
];

function uid() { return Math.random().toString(36).slice(2, 10); }
function formatTime(d: Date) { return d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" }); }
function fmtMoney(n: number) { return n.toLocaleString("es-UY", { minimumFractionDigits: 2 }); }

function renderContent(text: string) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const isList = /^[\-\*•]\s/.test(line);
        const parts = line.replace(/^[\-\*•]\s/, "").split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        const rendered = parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**"))
            return <strong key={j} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
          if (part.startsWith("`") && part.endsWith("`"))
            return <code key={j} className="bg-white/10 text-teal-300 px-1.5 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
          return <span key={j}>{part}</span>;
        });
        return (
          <span key={i} className={isList ? "flex gap-2 mt-1" : undefined}>
            {isList && <span className="text-teal-400 mt-0.5 shrink-0">·</span>}
            <span>{rendered}</span>
            {i < lines.length - 1 && !isList && <br />}
          </span>
        );
      })}
    </>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function NitoChat({ fullPage = false, accounts: propAccounts = [] }: Props) {
  const { currency } = useSettings();
  const router = useRouter();
  const { plan, loading: planLoading } = useSubscription();
  const { completeStep } = useAchievements();

  const hasNito     = canUseNito(plan);
  const hasImporter = canUseImporter(plan);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ msgId: string; action: NitoAction } | null>(null);
  // Rastrea si ya se completó el logro first_nito en esta sesión
  const firstNitoDone = useRef(false);

  // Estado del importador dentro del chat
  const [importMsgId, setImportMsgId] = useState<string | null>(null);
  const [importMovements, setImportMovements] = useState<ExtractedMovement[]>([]);
  const [importMeta, setImportMeta] = useState<ImportMeta | null>(null);
  const [importAccounts, setImportAccounts] = useState<AccountOption[]>([]);
  const [importDefaultAccount, setImportDefaultAccount] = useState<string>("");
  const [importSaving, setImportSaving] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, importMovements]);

  useEffect(() => {
    if ((open || fullPage) && inputRef.current)
      setTimeout(() => inputRef.current?.focus(), 150);
  }, [open, fullPage]);

  useEffect(() => {
    if (messages.length === 0) {
      const hour = new Date().getHours();
      const greeting = hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";
      setMessages([{
        id: uid(), role: "assistant", timestamp: new Date(),
        content: `${greeting} ✦\n\nSoy **Nito**, tu asistente financiero personal. Tengo acceso a tus cuentas, movimientos y deudas en tiempo real.\n\nTambién podés adjuntar un **PDF o foto** de tu estado de cuenta y lo analizo por vos.`,
      }]);
    }
  }, []);

  // ── Enviar mensaje de texto ───────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    const userText = text.trim();
    if (!userText || loading) return;

    const userMsg: Message = { id: uid(), role: "user", content: userText, timestamp: new Date() };
    const loadingMsg: Message = { id: uid(), role: "assistant", content: "", loading: true, timestamp: new Date() };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput("");
    setLoading(true);

    // ── Logro: primer mensaje enviado a Nito ──
    if (!firstNitoDone.current) {
      firstNitoDone.current = true;
      completeStep("first_nito");
    }

    try {
      const history = [...messages, userMsg].filter(m => !m.loading).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/nito", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, currency }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`);

      const assistantMsg: Message = {
        id: uid(), role: "assistant",
        content: data.reply, action: data.action ?? null, timestamp: new Date(),
      };
      setMessages(prev => [...prev.filter(m => !m.loading), assistantMsg]);
      if (data.action?.action === "register_movement")
        setPendingAction({ msgId: assistantMsg.id, action: data.action });
    } catch (e: any) {
      setMessages(prev => [
        ...prev.filter(m => !m.loading),
        { id: uid(), role: "assistant", content: `Hubo un error: ${e.message}`, timestamp: new Date() },
      ]);
    } finally { setLoading(false); }
  }, [messages, loading, currency, completeStep]);

  // ── Adjuntar archivo ──────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    const mediaType = ACCEPTED_TYPES[file.type];
    if (!mediaType) {
      addAssistantMsg("Formato no soportado. Subí un PDF, JPG, PNG o WEBP.");
      return;
    }
    const maxSize = file.type === "application/pdf" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      addAssistantMsg(`El archivo es demasiado grande (máx. ${file.type === "application/pdf" ? "10" : "5"}MB).`);
      return;
    }

    // Mensaje del usuario mostrando el archivo adjunto
    const userMsg: Message = {
      id: uid(), role: "user", timestamp: new Date(),
      content: `📎 ${file.name}`,
    };
    const loadingMsg: Message = { id: uid(), role: "assistant", content: "", loading: true, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setLoading(true);

    // ── Logro: primer uso de Nito (adjuntar archivo también cuenta) ──
    if (!firstNitoDone.current) {
      firstNitoDone.current = true;
      completeStep("first_nito");
    }

    try {
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res((reader.result as string).split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });

      const isPdf = file.type === "application/pdf";
      const body: any = { mediaType };
      if (isPdf) body.pdfBase64 = base64;
      else body.imageBase64 = base64;

      // Usar la primera cuenta disponible como origen por defecto
      const firstAccount = propAccounts[0]?.id ?? "";
      if (firstAccount) body.accountId = firstAccount;

      const res = await fetch("/api/movements/import-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`);

      const { movements, meta, accounts } = data;
      const msgId = uid();

      // Inicializar _skip/_forceImport
      const enriched: ExtractedMovement[] = movements.map((m: ExtractedMovement) => ({
        ...m,
        _skip: m.isDuplicate, // duplicados marcados por defecto para saltear
        _forceImport: false,
        accountId: m.accountId ?? firstAccount,
      }));

      setImportMovements(enriched);
      setImportMeta(meta);
      setImportAccounts(accounts?.length ? accounts : propAccounts);
      setImportDefaultAccount(firstAccount);
      setImportMsgId(msgId);

      const dupeWarning = meta.duplicates_found > 0
        ? `\n\n⚠️ **${meta.duplicates_found} posible${meta.duplicates_found > 1 ? "s" : ""} duplicado${meta.duplicates_found > 1 ? "s" : ""}** detectado${meta.duplicates_found > 1 ? "s" : ""} — los marqué para saltear, pero podés revisarlos.`
        : "";
      const transferWarning = meta.transfers_detected > 0
        ? `\n\n🔁 **${meta.transfers_detected} transferencia${meta.transfers_detected > 1 ? "s" : ""} entre cuentas** detectada${meta.transfers_detected > 1 ? "s" : ""} — revisá la contraparte antes de confirmar.`
        : "";

      const assistantMsg: Message = {
        id: msgId, role: "assistant", timestamp: new Date(),
        content: `Analicé **${file.name}** y encontré **${meta.total_extracted} movimientos** de ${meta.bank ?? "tu banco"} (${meta.currency}).${dupeWarning}${transferWarning}\n\nRevisá abajo y confirmá los que querés importar.`,
      };

      setMessages(prev => [...prev.filter(m => !m.loading), assistantMsg]);
    } catch (e: any) {
      setMessages(prev => [
        ...prev.filter(m => !m.loading),
        { id: uid(), role: "assistant", content: `Error al analizar el archivo: ${e.message}`, timestamp: new Date() },
      ]);
      setImportMsgId(null);
    } finally { setLoading(false); }
  }

  function addAssistantMsg(content: string) {
    setMessages(prev => [...prev, { id: uid(), role: "assistant", content, timestamp: new Date() }]);
  }

  // ── Confirmar importación ─────────────────────────────────────────────────

  async function handleConfirmImport() {
    const toImport = importMovements.filter(m => !m._skip);
    if (!toImport.length) {
      addAssistantMsg("No hay movimientos seleccionados para importar.");
      setImportMsgId(null);
      return;
    }
    setImportSaving(true);

    try {
      function resolveType(m: ExtractedMovement): "INCOME" | "EXPENSE" | "TRANSFER" {
        if (m.type === "TRANSFER_PENDING") {
          if (m.counterpartyAccountId) return "TRANSFER";
          return m.transferDirection === "IN" ? "INCOME" : "EXPENSE";
        }
        return m.type;
      }

      const rows = toImport.map(m => {
        const resolvedType = resolveType(m);
        return {
          date: m.date, amount: m.amount, type: resolvedType,
          category: m.category, description: m.description,
          accountId: m.accountId || importDefaultAccount || null,
          ...(resolvedType === "TRANSFER" && {
            counterpartyAccountId: m.counterpartyAccountId,
            transferLeg: m.transferDirection ?? "OUT",
          }),
        };
      });

      const res = await fetch("/api/movements/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, defaultAccountId: importDefaultAccount || null }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`);

      router.refresh();
      addAssistantMsg(`✓ **${data.inserted} movimientos importados** correctamente.${data.invalid ? ` (${data.invalid} inválidos ignorados)` : ""}`);
      setImportMsgId(null);
      setImportMovements([]);
    } catch (e: any) {
      addAssistantMsg(`Error al importar: ${e.message}`);
    } finally { setImportSaving(false); }
  }

  function toggleSkip(idx: number) {
    setImportMovements(prev => prev.map((m, i) =>
      i === idx ? { ...m, _skip: !m._skip, _forceImport: m._skip ? false : m._forceImport } : m
    ));
  }

  function updateImportMovement(idx: number, field: keyof ExtractedMovement, value: any) {
    setImportMovements(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  }

  function updateAllAccounts(accountId: string) {
    setImportDefaultAccount(accountId);
    setImportMovements(prev => prev.map(m => ({ ...m, accountId })));
  }

  // ── Confirmar acción de texto (registro dictado) ──────────────────────────

  async function confirmAction() {
    if (!pendingAction) return;
    const { data } = pendingAction.action;
    setPendingAction(null);
    try {
      const res = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: data.date, amount: data.amount, type: data.type,
          category: data.category, description: data.description,
          account_id: data.accountId || propAccounts[0]?.id || null,
          currency,
        }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
      addAssistantMsg(`✓ Registrado: **${data.type === "INCOME" ? "Ingreso" : "Gasto"}** de ${fmtMoney(data.amount)} · ${data.description}`);
    } catch {
      addAssistantMsg("No pude registrar el movimiento. Podés hacerlo manualmente.");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  // ── Panel de revisión de importación ─────────────────────────────────────

  const importPanel = importMsgId && importMovements.length > 0 && (
    <div className="rounded-2xl overflow-hidden mx-0 my-2"
      style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>

      {/* Header del panel */}
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
        <div className="flex items-center gap-2">
          <span className="text-teal-400 font-bold text-xs uppercase tracking-wider">Revisión de movimientos</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="text-emerald-400">{importMovements.filter(m => !m._skip).length} a importar</span>
          {importMovements.filter(m => m._skip).length > 0 && (
            <span className="text-slate-500">{importMovements.filter(m => m._skip).length} a saltear</span>
          )}
        </div>
      </div>

      {/* Alertas */}
      {importMeta && (importMeta.duplicates_found > 0 || importMeta.transfers_detected > 0) && (
        <div className="px-4 py-2.5 space-y-1.5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          {importMeta.duplicates_found > 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-300">
              <span className="shrink-0">⚠️</span>
              <span>{importMeta.duplicates_found} movimiento{importMeta.duplicates_found > 1 ? "s marcados" : " marcado"} como posible duplicado. Están desactivados por defecto — activálos si querés importarlos igual.</span>
            </div>
          )}
          {importMeta.transfers_detected > 0 && (
            <div className="flex items-start gap-2 text-xs text-sky-300">
              <span className="shrink-0">🔁</span>
              <span>{importMeta.transfers_detected} transferencia{importMeta.transfers_detected > 1 ? "s" : ""} entre cuentas detectada{importMeta.transfers_detected > 1 ? "s" : ""}. Verificá la cuenta contraparte.</span>
            </div>
          )}
        </div>
      )}

      {/* Cuenta por defecto */}
      <div className="px-4 py-2.5 flex items-center gap-2"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <span className="text-[11px] text-slate-500 shrink-0">Cuenta origen:</span>
        <select
          value={importDefaultAccount}
          onChange={e => updateAllAccounts(e.target.value)}
          className="flex-1 bg-transparent border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-teal-500/40">
          {importAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
        </select>
      </div>

      {/* Lista de movimientos */}
      <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.04]">
        {importMovements.map((m, idx) => {
          const isIncome = m.type === "INCOME" || (m.type === "TRANSFER_PENDING" && m.transferDirection === "IN");
          const isTransfer = m.type === "TRANSFER_PENDING";
          const skipped = !!m._skip;

          return (
            <div key={idx}
              className={`px-4 py-3 transition-all ${skipped ? "opacity-40" : ""}`}
              style={{ background: m.isDuplicate && !skipped ? "rgba(251,191,36,0.03)" : isTransfer && !skipped ? "rgba(14,165,233,0.03)" : "transparent" }}>

              <div className="flex items-start gap-3">
                {/* Toggle */}
                <button onClick={() => toggleSkip(idx)}
                  className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all ${!skipped ? "bg-teal-500 text-black" : "border border-white/20"}`}
                  title={skipped ? "Activar" : "Desactivar"}>
                  {!skipped && <span className="text-[10px] font-bold">✓</span>}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono text-slate-400">{m.date}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
                      isTransfer && m.counterpartyAccountId
                        ? "text-sky-300 bg-sky-500/10 border-sky-500/30"
                        : isTransfer
                        ? "text-amber-300 bg-amber-500/10 border-amber-500/30"
                        : isIncome
                        ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
                        : "text-rose-300 bg-rose-500/10 border-rose-500/30"
                    }`}>
                      {isTransfer && m.counterpartyAccountId ? "Transfer ↔" : isTransfer ? (m.transferDirection === "IN" ? "Traspaso ↓" : "Traspaso ↑") : isIncome ? "Ingreso" : "Gasto"}
                    </span>
                    {m.isDuplicate && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full border text-amber-400 bg-amber-500/10 border-amber-500/30">
                        ⚠ Posible duplicado
                      </span>
                    )}
                    <span className={`ml-auto font-mono text-sm font-semibold ${isIncome ? "text-emerald-300" : "text-rose-300"}`}>
                      {isIncome ? "+" : "-"}{fmtMoney(m.amount)}
                    </span>
                  </div>

                  {/* Descripción editable */}
                  <input
                    value={m.description}
                    onChange={e => updateImportMovement(idx, "description", e.target.value)}
                    disabled={skipped}
                    className="w-full bg-transparent text-xs text-slate-300 border-b border-transparent hover:border-white/10 focus:border-teal-500/40 outline-none py-0.5 disabled:cursor-not-allowed"
                  />

                  {/* Contraparte para transferencias */}
                  {isTransfer && !skipped && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 shrink-0">Cuenta contraparte:</span>
                      <select
                        value={m.counterpartyAccountId ?? ""}
                        onChange={e => updateImportMovement(idx, "counterpartyAccountId", e.target.value || null)}
                        className={`flex-1 border rounded px-1.5 py-0.5 text-[11px] focus:outline-none max-w-[180px] ${
                          m.counterpartyAccountId
                            ? "bg-transparent border-sky-700/40 text-slate-200"
                            : "bg-amber-950/20 border-amber-700/40 text-amber-300"
                        }`}>
                        <option value="">Sin vincular</option>
                        {importAccounts
                          .filter(a => a.id !== (m.accountId ?? importDefaultAccount))
                          .map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Info duplicado */}
                  {m.isDuplicate && m.duplicateDesc && !skipped && (
                    <div className="text-[10px] text-amber-400/70 italic">
                      Ya existe: "{m.duplicateDesc}"
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer del panel */}
      <div className="px-4 py-3 flex items-center justify-between gap-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={() => { setImportMsgId(null); setImportMovements([]); }}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-3 py-1.5 rounded-lg border border-white/5 hover:border-white/10">
          Cancelar
        </button>
        <button
          onClick={handleConfirmImport}
          disabled={importSaving || importMovements.filter(m => !m._skip).length === 0}
          className="flex-1 py-2 rounded-xl text-xs font-bold text-black transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "linear-gradient(135deg, #0d9488, #2563eb)", boxShadow: "0 4px 15px rgba(13,148,136,0.3)" }}>
          {importSaving ? "Importando..." : `Importar ${importMovements.filter(m => !m._skip).length} movimientos`}
        </button>
      </div>
    </div>
  );

  // ── Paywall screen (plan FREE) ────────────────────────────────────────────

  const paywallContent = (
    <div className={`flex flex-col items-center justify-center ${fullPage ? "h-full" : "h-[580px]"} relative overflow-hidden px-8`}
      style={{ background: "linear-gradient(160deg, #040916 0%, #060d1f 50%, #050b18 100%)" }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(ellipse, #2dd4bf 0%, transparent 70%)" }} />
      </div>
      <div className="relative text-center max-w-xs">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
          style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)", boxShadow: "0 0 40px rgba(13,148,136,0.3)" }}>
          ✦
        </div>
        <div className="text-white font-bold text-lg mb-2">Nito ✦ es Pro</div>
        <div className="text-slate-400 text-sm mb-6 leading-relaxed">
          Tu asistente financiero con IA, importador de estados de cuenta y análisis en tiempo real.
          Disponible en los planes <span className="text-blue-400 font-medium">Pro</span> y <span className="text-amber-400 font-medium">Deluxe</span>.
        </div>
        <button onClick={() => router.push("/upgrade")}
          className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
          style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)", boxShadow: "0 8px 25px rgba(13,148,136,0.3)" }}>
          Ver planes →
        </button>
        {!fullPage && (
          <button onClick={() => setOpen(false)} className="mt-3 text-xs text-slate-600 hover:text-slate-400 transition-colors">
            Cerrar
          </button>
        )}
      </div>
    </div>
  );

  // ── Chat content ──────────────────────────────────────────────────────────

  const chatContent = (
    <div className={`flex flex-col ${fullPage ? "h-full" : "h-[580px]"} relative overflow-hidden`}
      style={{ background: "linear-gradient(160deg, #040916 0%, #060d1f 50%, #050b18 100%)" }}>

      {/* Fondo decorativo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(ellipse, #2dd4bf 0%, transparent 70%)" }} />
        <div className="absolute bottom-20 right-0 w-[300px] h-[300px] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(ellipse, #3b82f6 0%, transparent 70%)" }} />
        <div className="absolute inset-0 opacity-[0.015]"
          style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
      </div>

      {/* Header */}
      <div className="relative flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0"
        style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.03) 0%,transparent 100%)" }}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold text-white"
              style={{ background: "linear-gradient(135deg,#0d9488 0%,#2563eb 100%)", boxShadow: "0 0 20px rgba(13,148,136,0.4)" }}>
              ✦
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#040916]" />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-wide">Nito <span className="text-teal-400">✦</span></div>
            <div className="text-[10px] text-slate-500 tracking-wider uppercase font-medium">Asistente financiero</div>
          </div>
        </div>
        {!fullPage && (
          <button onClick={() => setOpen(false)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all">
            ✕
          </button>
        )}
      </div>

      {/* Mensajes */}
      <div className="relative flex-1 overflow-y-auto px-4 py-5 space-y-4"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.05) transparent" }}>

        {messages.map((msg) => (
          <div key={msg.id}>
            <div className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 mt-1"
                  style={{ background: "linear-gradient(135deg,#0d9488 0%,#2563eb 100%)" }}>
                  ✦
                </div>
              )}
              <div className={`flex flex-col gap-1 max-w-[82%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === "user" ? "rounded-tr-sm" : "rounded-tl-sm"}`}
                  style={msg.role === "user"
                    ? { background: "linear-gradient(135deg,#1d4ed8 0%,#1e40af 100%)", boxShadow: "0 4px 15px rgba(29,78,216,0.3)", color: "white" }
                    : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#cbd5e1" }}>
                  {msg.loading ? (
                    <div className="flex items-center gap-1.5 py-1 px-1">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-teal-400/70 animate-bounce"
                          style={{ animationDelay: `${i * 0.12}s`, animationDuration: "0.8s" }} />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-0.5">{renderContent(msg.content)}</div>
                  )}
                </div>
                {!msg.loading && (
                  <span className="text-[10px] text-slate-600 px-1">{formatTime(msg.timestamp)}</span>
                )}

                {/* Confirmación de acción (movimiento dictado) */}
                {msg.action?.action === "register_movement" && pendingAction?.msgId === msg.id && (
                  <div className="w-full rounded-xl overflow-hidden mt-1"
                    style={{ border: "1px solid rgba(13,148,136,0.3)", background: "rgba(13,148,136,0.05)" }}>
                    <div className="px-4 py-3 space-y-2.5">
                      <div className="text-teal-400 text-xs font-bold uppercase tracking-wider">Confirmar registro</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div className="text-slate-500">Tipo</div>
                        <div className={msg.action.data.type === "INCOME" ? "text-emerald-400 font-medium" : "text-rose-400 font-medium"}>
                          {msg.action.data.type === "INCOME" ? "↑ Ingreso" : "↓ Gasto"}
                        </div>
                        <div className="text-slate-500">Monto</div>
                        <div className="text-white font-mono font-semibold">{fmtMoney(msg.action.data.amount)}</div>
                        <div className="text-slate-500">Descripción</div>
                        <div className="text-slate-200">{msg.action.data.description}</div>
                        <div className="text-slate-500">Fecha</div>
                        <div className="text-slate-200">{msg.action.data.date}</div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={confirmAction}
                          className="flex-1 py-2 rounded-lg text-xs font-bold text-black transition-all hover:opacity-90"
                          style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)" }}>
                          Confirmar
                        </button>
                        <button onClick={() => setPendingAction(null)}
                          className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 transition-colors"
                          style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Panel de importación justo después del mensaje de Nito que lo inició */}
            {msg.id === importMsgId && importPanel}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Sugerencias */}
      {messages.length <= 1 && (
        <div className="relative px-4 pb-2 flex flex-wrap gap-2 shrink-0">
          {SUGGESTIONS.map(s => (
            <button key={s.text} onClick={() => sendMessage(s.text)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 transition-all hover:scale-[1.02]"
              style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
              <span className="text-sm">{s.icon}</span>
              <span>{s.text}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative px-4 pb-4 pt-2 shrink-0">
        <div className="relative rounded-2xl overflow-hidden transition-all"
          style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)" }}>

          {/* Botón adjuntar */}
          {hasImporter ? (
            <label className="absolute left-3 bottom-3 w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer transition-all hover:bg-white/5"
              title="Adjuntar PDF o imagen"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <input ref={fileInputRef} type="file" accept={ACCEPT_ATTR} className="hidden" onChange={handleFileChange} />
            </label>
          ) : (
            <button
              onClick={() => router.push("/upgrade")}
              title="Importador IA — Plan Pro"
              className="absolute left-3 bottom-3 w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-amber-500/10"
              style={{ border: "1px solid rgba(245,158,11,0.2)" }}>
              <svg className="w-3.5 h-3.5 text-amber-500/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-6V7m0 0a2 2 0 10-4 0v1m4-1a2 2 0 114 0v1m-4-1H8m4 0h4" />
              </svg>
            </button>
          )}

          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Preguntale algo a Nito..."
            rows={1}
            disabled={loading}
            className="w-full bg-transparent px-4 py-3.5 pl-14 pr-14 text-sm text-slate-100 placeholder:text-slate-600 resize-none outline-none max-h-32 leading-relaxed disabled:opacity-40"
            style={{ fieldSizing: "content" } as any}
          />

          {/* Botón enviar */}
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="absolute right-3 bottom-3 w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed"
            style={{
              background: input.trim() ? "linear-gradient(135deg,#0d9488,#2563eb)" : "rgba(255,255,255,0.05)",
              boxShadow: input.trim() ? "0 4px 15px rgba(13,148,136,0.4)" : "none",
            }}>
            <svg className="w-3.5 h-3.5 text-white rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-2">
          <span className="w-1 h-1 rounded-full bg-teal-500/40" />
          <span className="text-[10px] text-slate-700 tracking-wide">
            {hasImporter ? "Nito usa tus datos reales · PDF e imágenes aceptados" : "Nito usa tus datos reales en tiempo real"}
          </span>
          <span className="w-1 h-1 rounded-full bg-teal-500/40" />
        </div>
      </div>
    </div>
  );

  // ── Página completa ───────────────────────────────────────────────────────
  if (fullPage) {
    return (
      <div className="h-[calc(100vh-10rem)] max-w-2xl mx-auto rounded-2xl overflow-hidden shadow-2xl"
        style={{ border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 25px 80px rgba(0,0,0,0.6)" }}>
        {!planLoading && !hasNito ? paywallContent : chatContent}
      </div>
    );
  }

  // ── Flotante ──────────────────────────────────────────────────────────────
  return (
    <>
      {!open && (
        <div className="fixed bottom-6 right-6 z-50">
          <button onClick={() => setOpen(true)}
            className="group relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            style={{ background: "linear-gradient(135deg,#0d9488 0%,#2563eb 100%)", boxShadow: "0 8px 30px rgba(13,148,136,0.4)" }}>
            <span className="text-xl text-white font-bold relative z-10">✦</span>
            <span className="absolute inset-0 rounded-2xl animate-ping opacity-20"
              style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)" }} />
            <span className="absolute right-16 whitespace-nowrap text-xs text-slate-200 px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ background: "rgba(10,15,35,0.95)", border: "1px solid rgba(255,255,255,0.08)" }}>
              Nito ✦ — Asistente
            </span>
          </button>
        </div>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] rounded-2xl overflow-hidden"
          style={{
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.7), 0 0 60px rgba(13,148,136,0.08)",
            animation: "nitoChatIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both",
          }}>
          <style>{`
            @keyframes nitoChatIn {
              from { opacity:0; transform:translateY(16px) scale(0.95); }
              to   { opacity:1; transform:translateY(0) scale(1); }
            }
          `}</style>
          {!planLoading && !hasNito ? paywallContent : chatContent}
        </div>
      )}
    </>
  );
}
