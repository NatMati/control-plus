// src/components/ImportInvestmentsAI.tsx
"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  X, Upload, FileText, Image, FileSpreadsheet,
  CheckCircle2, AlertTriangle, Loader2, Trash2,
  ChevronRight, Sparkles, Building2, RefreshCw,
  ArrowUpRight, ArrowDownRight, Plus, Minus,
  DollarSign, TrendingUp, TrendingDown,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

type TradeSide = "BUY" | "SELL";
type CashType  = "deposit" | "withdrawal" | "dividend" | "fee" | "other";

type ParsedTrade = {
  id: string;
  date: string;
  symbol: string;
  side: TradeSide;
  quantity: number;
  price: number;
  total_usd: number;
  fee_usd: number;
  note?: string;
  _removed?: boolean;
  _edited?: boolean;
};

type ParsedCashMovement = {
  id: string;
  date: string;
  type: CashType;
  amount_usd: number;
  note?: string;
  _removed?: boolean;
};

type PreviewData = {
  broker: string;
  brokerAccountId: string | null;
  brokerIsNew: boolean;
  currency: string;
  trades: ParsedTrade[];
  cashMovements: ParsedCashMovement[];
  warnings: string[];
  fileName: string;
  fileSizeMB: number;
};

type Step = "idle" | "processing" | "broker" | "preview" | "confirming" | "done" | "error";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10); }

function formatUsd(n: number) {
  const sign = n < 0 ? "-" : "";
  const abs  = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseNum(v: string): number {
  const n = Number(v.trim().replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function getFileIcon(name: string) {
  if (name.endsWith(".pdf"))               return <FileText       className="w-5 h-5 text-rose-400"    />;
  if (name.match(/\.(jpg|jpeg|png|webp)$/)) return <Image          className="w-5 h-5 text-sky-400"     />;
  return                                          <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
}

function getFileColor(name: string) {
  if (name.endsWith(".pdf"))               return { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" };
  if (name.match(/\.(jpg|jpeg|png|webp)$/)) return { color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.2)"  };
  return                                          { color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.2)"  };
}

const CASH_TYPE_LABELS: Record<CashType, { label: string; color: string; icon: React.ReactNode }> = {
  deposit:    { label: "Depósito",  color: "#34d399", icon: <TrendingUp   className="w-3 h-3" /> },
  withdrawal: { label: "Retiro",    color: "#f97316", icon: <TrendingDown className="w-3 h-3" /> },
  dividend:   { label: "Dividendo", color: "#60a5fa", icon: <DollarSign   className="w-3 h-3" /> },
  fee:        { label: "Comisión",  color: "#f87171", icon: <Minus        className="w-3 h-3" /> },
  other:      { label: "Otro",      color: "#94a3b8", icon: <DollarSign   className="w-3 h-3" /> },
};

const BROKER_ICONS: Record<string, string> = {
  "Interactive Brokers": "🏛️", "IBKR": "🏛️",
  "Hapi": "🟢", "Balanz": "🔵", "Banza": "🟠",
  "Genérico": "📄", "CSV": "📊",
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTES
// ─────────────────────────────────────────────────────────────────────────────

function EditableCell({ value, type = "text", onChange }: {
  value: string; type?: "text" | "number"; onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);

  function commit() {
    setEditing(false);
    if (draft !== value) onChange(draft);
  }

  if (!editing) {
    return (
      <button
        className="text-left w-full px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors text-xs tabular-nums"
        onClick={() => { setDraft(value); setEditing(true); }}>
        {value}
      </button>
    );
  }

  return (
    <input
      autoFocus value={draft} type={type}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
      className="w-full px-1.5 py-0.5 rounded text-xs outline-none tabular-nums"
      style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.4)", color: "white" }}
    />
  );
}

function StepDot({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
        done   ? "bg-emerald-500 text-white" :
        active ? "bg-indigo-500 text-white ring-2 ring-indigo-400/30" :
                 "bg-white/5 text-slate-600"
      }`}>
        {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : n}
      </div>
      <span className={`text-xs font-medium transition-colors ${active ? "text-white" : done ? "text-emerald-400" : "text-slate-600"}`}>
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function ImportInvestmentsAI({
  open, onClose, onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const [step,          setStep]          = useState<Step>("idle");
  const [dragOver,      setDragOver]      = useState(false);
  const [preview,       setPreview]       = useState<PreviewData | null>(null);
  const [trades,        setTrades]        = useState<ParsedTrade[]>([]);
  const [cashMovements, setCashMovements] = useState<ParsedCashMovement[]>([]);
  const [brokerAccountId, setBrokerAccountId] = useState<string | null>(null);
  const [errMsg,        setErrMsg]        = useState<string | null>(null);
  const [progress,      setProgress]      = useState(0);
  const [doneInfo,      setDoneInfo]      = useState<{ trades: number; cash: number } | null>(null);
  const [activeTab,     setActiveTab]     = useState<"trades" | "cash">("trades");

  const fileRef = useRef<HTMLInputElement>(null);

  // ── Reset ──────────────────────────────────────────────────────────────────

  function reset() {
    setStep("idle");
    setPreview(null);
    setTrades([]);
    setCashMovements([]);
    setBrokerAccountId(null);
    setErrMsg(null);
    setProgress(0);
    setDoneInfo(null);
    setActiveTab("trades");
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() { reset(); onClose(); }

  // ── Procesar archivo ───────────────────────────────────────────────────────

  async function processFile(file: File) {
    setStep("processing");
    setErrMsg(null);
    setProgress(0);

    const interval = window.setInterval(() => {
      setProgress(p => p < 85 ? p + Math.random() * 12 : p);
    }, 600);

    try {
      const form = new FormData();
      form.append("file", file);

      const res  = await fetch("/api/investments/import-ai", { method: "POST", body: form });
      clearInterval(interval);
      setProgress(100);

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`);

      const withIds: ParsedTrade[] = (data.trades ?? []).map((t: ParsedTrade) => ({
        ...t, id: uid(), _removed: false, _edited: false,
      }));

      const cashWithIds: ParsedCashMovement[] = (data.cashMovements ?? []).map((m: ParsedCashMovement) => ({
        ...m, id: uid(), _removed: false,
      }));

      const pd: PreviewData = {
        broker:          data.broker,
        brokerAccountId: data.brokerAccountId,
        brokerIsNew:     data.brokerIsNew,
        currency:        data.currency,
        warnings:        data.warnings ?? [],
        fileName:        data.fileName,
        fileSizeMB:      data.fileSizeMB,
        trades:          withIds,
        cashMovements:   cashWithIds,
      };

      setPreview(pd);
      setTrades(withIds);
      setCashMovements(cashWithIds);

      setTimeout(() => {
        // Si el broker es nuevo → paso de confirmación de broker
        // Si ya existe → ir directo al preview
        if (data.brokerIsNew) {
          setStep("broker");
        } else {
          setBrokerAccountId(data.brokerAccountId);
          setStep("preview");
        }
      }, 300);

    } catch (err: unknown) {
      clearInterval(interval);
      setErrMsg(err instanceof Error ? err.message : "Error procesando el archivo.");
      setStep("error");
    }
  }

  // ── Drag & drop ────────────────────────────────────────────────────────────

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Confirmar creación de broker ───────────────────────────────────────────

  async function confirmBroker(create: boolean) {
    if (!preview) return;

    if (!create) {
      // Importar sin asociar a broker
      setBrokerAccountId(null);
      setStep("preview");
      return;
    }

    try {
      const res  = await fetch("/api/investments/broker-accounts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: preview.broker, currency: preview.currency }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      setBrokerAccountId(data.id);
    } catch (e: unknown) {
      console.warn("No se pudo crear el broker:", e);
      setBrokerAccountId(null);
    }

    setStep("preview");
  }

  // ── Edición de trades ──────────────────────────────────────────────────────

  function updateTrade(id: string, field: keyof ParsedTrade, rawValue: string) {
    setTrades(prev => prev.map(t => {
      if (t.id !== id) return t;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated: any = { ...t, _edited: true };
      if (field === "date")      updated.date      = rawValue;
      if (field === "symbol")    updated.symbol    = rawValue.toUpperCase().trim();
      if (field === "note")      updated.note      = rawValue;
      if (field === "side")      updated.side      = rawValue as TradeSide;
      if (field === "quantity")  { const n = parseNum(rawValue); if (n > 0)  updated.quantity  = n; }
      if (field === "price")     { const n = parseNum(rawValue); if (n > 0)  updated.price     = n; }
      if (field === "total_usd") { const n = parseNum(rawValue); if (n >= 0) updated.total_usd = n; }
      if (field === "fee_usd")   { const n = parseNum(rawValue); if (n >= 0) updated.fee_usd   = n; }
      return updated;
    }));
  }

  function toggleRemoveTrade(id: string) {
    setTrades(prev => prev.map(t => t.id === id ? { ...t, _removed: !t._removed } : t));
  }

  function toggleRemoveCash(id: string) {
    setCashMovements(prev => prev.map(m => m.id === id ? { ...m, _removed: !m._removed } : m));
  }

  function addEmptyTrade() {
    setTrades(prev => [{
      id: uid(), date: new Date().toISOString().slice(0, 10),
      symbol: "", side: "BUY", quantity: 0, price: 0, total_usd: 0,
      fee_usd: 0, note: "", _removed: false, _edited: true,
    }, ...prev]);
  }

  // ── Confirmar importación ──────────────────────────────────────────────────

  async function confirmImport() {
    const toImport     = trades.filter(t => !t._removed && t.symbol && t.quantity > 0 && t.price > 0);
    const cashToImport = cashMovements.filter(m => !m._removed);

    setStep("confirming");

    let insertedTrades = 0;
    let insertedCash   = 0;

    // Insertar trades
    for (const t of toImport) {
      try {
        const res = await fetch("/api/investments/trades", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            date:              t.date,
            symbol:            t.symbol,
            side:              t.side,
            quantity:          t.quantity,
            price:             t.price,
            total_usd:         t.total_usd > 0 ? t.total_usd : t.quantity * t.price,
            fee_usd:           t.fee_usd ?? 0,
            note:              t.note ?? null,
            broker_account_id: brokerAccountId,
          }),
        });
        if (res.ok) insertedTrades++;
      } catch { /* silencioso */ }
    }

    // Insertar cash movements (si hay broker asociado)
    if (cashToImport.length && brokerAccountId) {
      try {
        const payload = cashToImport.map(m => ({
          broker_account_id: brokerAccountId,
          date:              m.date,
          type:              m.type,
          amount_usd:        m.amount_usd,
          note:              m.note ?? null,
        }));

        const res = await fetch("/api/investments/cash-movements", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload),
        });
        const data = await res.json();
        insertedCash = data?.inserted ?? 0;
      } catch { /* silencioso */ }
    }

    setDoneInfo({ trades: insertedTrades, cash: insertedCash });
    setStep("done");
    onImported(insertedTrades);
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const activeCount   = trades.filter(t => !t._removed).length;
  const removedCount  = trades.filter(t => t._removed).length;
  const editedCount   = trades.filter(t => t._edited && !t._removed).length;
  const buyCount      = trades.filter(t => !t._removed && t.side === "BUY").length;
  const sellCount     = trades.filter(t => !t._removed && t.side === "SELL").length;
  const totalVolume   = trades.filter(t => !t._removed).reduce((a, t) => a + t.total_usd, 0);
  const activeCash    = cashMovements.filter(m => !m._removed).length;

  // Liquidez estimada (depósitos - retiros - compras + ventas)
  const cashIn   = cashMovements.filter(m => !m._removed && ["deposit","dividend"].includes(m.type)).reduce((a,m) => a + m.amount_usd, 0);
  const cashOut  = cashMovements.filter(m => !m._removed && ["withdrawal","fee"].includes(m.type)).reduce((a,m) => a + m.amount_usd, 0);
  const netBuys  = trades.filter(t => !t._removed && t.side === "BUY").reduce((a,t) => a + t.total_usd, 0);
  const netSells = trades.filter(t => !t._removed && t.side === "SELL").reduce((a,t) => a + t.total_usd, 0);
  const estimatedLiquidity = cashIn - cashOut - netBuys + netSells;

  // Steps helper
  const stepIndex = { idle: 0, processing: 1, broker: 1.5, preview: 2, confirming: 3, done: 3, error: 0 };
  const si = stepIndex[step] ?? 0;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)" }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>

      <div
        className="w-full sm:max-w-4xl rounded-t-3xl sm:rounded-2xl flex flex-col shadow-2xl"
        style={{
          background: "linear-gradient(160deg,#070f1e 0%,#040c1a 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
          maxHeight: "92dvh",
        }}>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>

          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,rgba(13,148,136,0.25),rgba(37,99,235,0.25))", border: "1px solid rgba(99,102,241,0.3)" }}>
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-bold text-white text-sm">Importar con IA</div>
            <div className="text-[11px] text-slate-600 mt-0.5">PDF · Imagen · CSV · Detecta el broker automáticamente</div>
          </div>

          <div className="hidden sm:flex items-center gap-4">
            <StepDot n={1} label="Subir"    active={step==="idle"}      done={si > 0}/>
            <ChevronRight className="w-3 h-3 text-slate-700"/>
            <StepDot n={2} label="Analizar" active={step==="processing"||step==="broker"} done={si > 1.5}/>
            <ChevronRight className="w-3 h-3 text-slate-700"/>
            <StepDot n={3} label="Revisar"  active={step==="preview"}   done={si > 2}/>
            <ChevronRight className="w-3 h-3 text-slate-700"/>
            <StepDot n={4} label="Confirmar" active={step==="confirming"||step==="done"} done={step==="done"}/>
          </div>

          <button onClick={handleClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 hover:text-white hover:bg-white/8 transition-all shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Contenido ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── IDLE ──────────────────────────────────────────────────── */}
          {step === "idle" && (
            <div className="p-6">
              <div
                className="rounded-2xl flex flex-col items-center justify-center gap-4 py-14 px-6 text-center cursor-pointer transition-all"
                style={{
                  border: `2px dashed ${dragOver ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.1)"}`,
                  background: dragOver ? "rgba(99,102,241,0.06)" : "rgba(255,255,255,0.02)",
                }}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}>

                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}>
                  <Upload className="w-7 h-7 text-indigo-400" />
                </div>

                <div>
                  <div className="text-white font-semibold text-sm mb-1">Arrastrá o hacé click para subir</div>
                  <div className="text-slate-600 text-xs">PDF, JPG, PNG, WEBP o CSV · Máx. 20MB</div>
                </div>

                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {[
                    { icon: "🏛️", label: "Interactive Brokers" },
                    { icon: "🟢", label: "Hapi" },
                    { icon: "🔵", label: "Balanz" },
                    { icon: "🟠", label: "Banza" },
                    { icon: "📄", label: "Cualquier broker" },
                  ].map(b => (
                    <div key={b.label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] text-slate-500"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <span>{b.icon}</span> {b.label}
                    </div>
                  ))}
                </div>

                <input ref={fileRef} type="file"
                  accept=".pdf,.csv,.jpg,.jpeg,.png,.webp,image/*,application/pdf,text/csv"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: <FileText className="w-4 h-4 text-rose-400"/>,        title: "Estado de cuenta PDF", desc: "Sube el PDF que te manda tu broker. La IA extrae trades y depósitos." },
                  { icon: <Image className="w-4 h-4 text-sky-400"/>,            title: "Foto de operación",    desc: "Captura de pantalla o foto de la confirmación de compra." },
                  { icon: <FileSpreadsheet className="w-4 h-4 text-emerald-400"/>, title: "CSV exportado",     desc: "Exportá desde tu broker como CSV y la IA lo interpreta." },
                ].map(t => (
                  <div key={t.title} className="rounded-xl px-3.5 py-3"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-2 mb-1">{t.icon}<span className="text-xs font-semibold text-slate-300">{t.title}</span></div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── PROCESSING ─────────────────────────────────────────────── */}
          {step === "processing" && (
            <div className="flex flex-col items-center justify-center py-20 px-6 gap-6">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20"/>
                <div className="absolute inset-0 rounded-full border-2 border-t-indigo-400 animate-spin"/>
                <div className="absolute inset-2 rounded-full border-2 border-t-teal-400 animate-spin" style={{ animationDuration: "1.5s", animationDirection: "reverse" }}/>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-indigo-400" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <div className="text-white font-semibold">Analizando con IA…</div>
                <div className="text-slate-600 text-xs max-w-xs">Claude está leyendo el documento e identificando trades y movimientos de cash.</div>
              </div>
              <div className="w-64 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, background: "linear-gradient(90deg,#0d9488,#6366f1)" }}/>
              </div>
              <div className="text-[11px] text-slate-600">{Math.round(progress)}%</div>
            </div>
          )}

          {/* ── BROKER — confirmar si crear ─────────────────────────────── */}
          {step === "broker" && preview && (
            <div className="flex flex-col items-center justify-center py-16 px-6 gap-6 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}>
                {BROKER_ICONS[preview.broker] ?? "🏛️"}
              </div>

              <div>
                <div className="text-white font-bold text-base">Broker nuevo detectado</div>
                <div className="text-indigo-300 font-semibold text-lg mt-1">{preview.broker}</div>
                <div className="text-slate-500 text-xs mt-2 max-w-xs">
                  ¿Querés crear una cuenta para este broker? Así podés ver la liquidez disponible y trackear todos tus movimientos.
                </div>
              </div>

              {/* Preview de cash movements detectados */}
              {preview.cashMovements.length > 0 && (
                <div className="w-full max-w-sm rounded-xl px-4 py-3 text-left"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="text-[11px] text-slate-500 mb-2">Movimientos de cash detectados</div>
                  <div className="space-y-1.5">
                    {preview.cashMovements.slice(0, 4).map((m, i) => {
                      const meta = CASH_TYPE_LABELS[m.type];
                      return (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: meta.color }}>
                            {meta.icon} {meta.label}
                          </div>
                          <div className="text-xs text-white tabular-nums">{formatUsd(m.amount_usd)}</div>
                        </div>
                      );
                    })}
                    {preview.cashMovements.length > 4 && (
                      <div className="text-[11px] text-slate-600">+{preview.cashMovements.length - 4} más…</div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => confirmBroker(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}>
                  Omitir
                </button>
                <button onClick={() => confirmBroker(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)", boxShadow: "0 4px 14px rgba(13,148,136,0.25)" }}>
                  <Building2 className="w-3.5 h-3.5"/>
                  Crear cuenta {preview.broker}
                </button>
              </div>
            </div>
          )}

          {/* ── PREVIEW ────────────────────────────────────────────────── */}
          {step === "preview" && preview && (
            <div className="flex flex-col">

              {/* Info archivo + broker + stats */}
              <div className="flex flex-col sm:flex-row gap-3 px-5 py-4"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>

                {(() => {
                  const fc = getFileColor(preview.fileName);
                  return (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl flex-1"
                      style={{ background: fc.bg, border: `1px solid ${fc.border}` }}>
                      {getFileIcon(preview.fileName)}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{preview.fileName}</div>
                        <div className="text-[10px] text-slate-600">{preview.fileSizeMB}MB</div>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                  style={{ background: brokerAccountId ? "rgba(16,185,129,0.08)" : "rgba(99,102,241,0.08)", border: `1px solid ${brokerAccountId ? "rgba(16,185,129,0.2)" : "rgba(99,102,241,0.2)"}` }}>
                  <Building2 className="w-4 h-4 shrink-0" style={{ color: brokerAccountId ? "#34d399" : "#818cf8" }} />
                  <div>
                    <div className="text-[10px] text-slate-600">{brokerAccountId ? "Broker vinculado" : "Sin broker"}</div>
                    <div className="text-xs font-bold" style={{ color: brokerAccountId ? "#34d399" : "#818cf8" }}>
                      {BROKER_ICONS[preview.broker] ?? "📄"} {preview.broker}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl flex-wrap"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="text-center">
                    <div className="text-sm font-bold text-white">{activeCount}</div>
                    <div className="text-[10px] text-slate-600">trades</div>
                  </div>
                  <div className="w-px h-6 bg-white/10"/>
                  <div className="text-center">
                    <div className="text-sm font-bold text-emerald-400">{buyCount}</div>
                    <div className="text-[10px] text-slate-600">compras</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-orange-400">{sellCount}</div>
                    <div className="text-[10px] text-slate-600">ventas</div>
                  </div>
                  {activeCash > 0 && <>
                    <div className="w-px h-6 bg-white/10"/>
                    <div className="text-center">
                      <div className="text-sm font-bold text-sky-400">{activeCash}</div>
                      <div className="text-[10px] text-slate-600">cash</div>
                    </div>
                  </>}
                  <div className="w-px h-6 bg-white/10"/>
                  <div className="text-center">
                    <div className="text-xs font-bold text-white">{formatUsd(totalVolume)}</div>
                    <div className="text-[10px] text-slate-600">volumen</div>
                  </div>
                  {brokerAccountId && activeCash > 0 && <>
                    <div className="w-px h-6 bg-white/10"/>
                    <div className="text-center">
                      <div className="text-xs font-bold" style={{ color: estimatedLiquidity >= 0 ? "#34d399" : "#f87171" }}>
                        {formatUsd(estimatedLiquidity)}
                      </div>
                      <div className="text-[10px] text-slate-600">liquidez est.</div>
                    </div>
                  </>}
                </div>
              </div>

              {/* Warnings */}
              {preview.warnings.length > 0 && (
                <div className="mx-5 mt-4 rounded-xl px-4 py-3"
                  style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)" }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-xs font-semibold text-amber-400">Advertencias</span>
                  </div>
                  <ul className="space-y-0.5">
                    {preview.warnings.map((w, i) => <li key={i} className="text-[11px] text-amber-300/70">· {w}</li>)}
                  </ul>
                </div>
              )}

              {/* Tabs trades / cash */}
              <div className="flex gap-1 px-5 pt-4">
                {[
                  { key: "trades", label: `Trades (${activeCount})` },
                  { key: "cash",   label: `Cash (${activeCash})`, show: cashMovements.length > 0 },
                ].filter(t => t.show !== false).map(t => (
                  <button key={t.key}
                    onClick={() => setActiveTab(t.key as "trades" | "cash")}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: activeTab === t.key ? "rgba(99,102,241,0.15)" : "transparent",
                      color:      activeTab === t.key ? "#a5b4fc" : "#475569",
                      border:     `1px solid ${activeTab === t.key ? "rgba(99,102,241,0.3)" : "transparent"}`,
                    }}>
                    {t.label}
                  </button>
                ))}
                {activeTab === "trades" && (
                  <button onClick={addEmptyTrade}
                    className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "#94a3b8" }}>
                    <Plus className="w-3 h-3" /> Agregar fila
                  </button>
                )}
              </div>

              {/* Hint */}
              <div className="px-5 pt-2 pb-1">
                <p className="text-[11px] text-slate-600">
                  Hacé click en cualquier celda para editar · Tachá las que no querés importar
                  {editedCount  > 0 && <span className="ml-2 text-indigo-400">{editedCount} editada{editedCount > 1 ? "s" : ""}</span>}
                  {removedCount > 0 && <span className="ml-2 text-rose-400">{removedCount} excluida{removedCount > 1 ? "s" : ""}</span>}
                </p>
              </div>

              {/* Tabla trades */}
              {activeTab === "trades" && (
                <div className="overflow-x-auto px-5 pb-4">
                  <table className="w-full text-xs" style={{ minWidth: 780 }}>
                    <thead>
                      <tr className="text-[10px] uppercase tracking-widest text-slate-700"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <th className="py-2 text-left pl-2">Fecha</th>
                        <th className="py-2 text-left">Símbolo</th>
                        <th className="py-2 text-center">Op.</th>
                        <th className="py-2 text-right">Cantidad</th>
                        <th className="py-2 text-right">Precio</th>
                        <th className="py-2 text-right">Total USD</th>
                        <th className="py-2 text-right">Fee</th>
                        <th className="py-2 text-left">Nota</th>
                        <th className="py-2"/>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                      {trades.map(t => (
                        <tr key={t.id} className="transition-opacity group" style={{ opacity: t._removed ? 0.3 : 1 }}>
                          <td className="py-1.5 pl-2"><EditableCell value={t.date} onChange={v => updateTrade(t.id, "date", v)}/></td>
                          <td className="py-1.5"><EditableCell value={t.symbol} onChange={v => updateTrade(t.id, "symbol", v)}/></td>
                          <td className="py-1.5 text-center">
                            <button onClick={() => updateTrade(t.id, "side", t.side === "BUY" ? "SELL" : "BUY")}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full transition-all"
                              style={{
                                background: t.side === "BUY" ? "rgba(16,185,129,0.12)" : "rgba(249,115,22,0.12)",
                                color:      t.side === "BUY" ? "#34d399" : "#fb923c",
                                border:     `1px solid ${t.side === "BUY" ? "rgba(16,185,129,0.25)" : "rgba(249,115,22,0.25)"}`,
                              }}>
                              {t.side === "BUY"
                                ? <><ArrowUpRight   className="w-2.5 h-2.5 inline mr-0.5"/>BUY</>
                                : <><ArrowDownRight className="w-2.5 h-2.5 inline mr-0.5"/>SELL</>}
                            </button>
                          </td>
                          <td className="py-1.5"><EditableCell value={String(t.quantity)}  type="number" onChange={v => updateTrade(t.id, "quantity",  v)}/></td>
                          <td className="py-1.5"><EditableCell value={String(t.price)}     type="number" onChange={v => updateTrade(t.id, "price",     v)}/></td>
                          <td className="py-1.5"><EditableCell value={String(t.total_usd)} type="number" onChange={v => updateTrade(t.id, "total_usd", v)}/></td>
                          <td className="py-1.5"><EditableCell value={String(t.fee_usd)}   type="number" onChange={v => updateTrade(t.id, "fee_usd",   v)}/></td>
                          <td className="py-1.5"><EditableCell value={t.note ?? ""}        onChange={v => updateTrade(t.id, "note", v)}/></td>
                          <td className="py-1.5 pr-1">
                            <button onClick={() => toggleRemoveTrade(t.id)}
                              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                                t._removed ? "text-emerald-400 bg-emerald-400/10" : "text-slate-700 hover:text-rose-400 hover:bg-rose-400/10"}`}>
                              {t._removed ? <Plus className="w-3 h-3"/> : <Minus className="w-3 h-3"/>}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tabla cash movements */}
              {activeTab === "cash" && (
                <div className="overflow-x-auto px-5 pb-4">
                  {!brokerAccountId && (
                    <div className="mb-3 px-4 py-3 rounded-xl text-xs text-amber-300/80"
                      style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
                      ⚠️ No hay broker vinculado — los movimientos de cash no se guardarán. Volvé atrás y creá la cuenta del broker.
                    </div>
                  )}
                  <table className="w-full text-xs" style={{ minWidth: 480 }}>
                    <thead>
                      <tr className="text-[10px] uppercase tracking-widest text-slate-700"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <th className="py-2 text-left pl-2">Fecha</th>
                        <th className="py-2 text-left">Tipo</th>
                        <th className="py-2 text-right">Monto USD</th>
                        <th className="py-2 text-left">Nota</th>
                        <th className="py-2"/>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                      {cashMovements.map(m => {
                        const meta = CASH_TYPE_LABELS[m.type];
                        return (
                          <tr key={m.id} className="transition-opacity" style={{ opacity: m._removed ? 0.3 : 1 }}>
                            <td className="py-2 pl-2 text-slate-400 tabular-nums">{m.date}</td>
                            <td className="py-2">
                              <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: meta.color }}>
                                {meta.icon} {meta.label}
                              </span>
                            </td>
                            <td className="py-2 text-right tabular-nums text-white font-medium">{formatUsd(m.amount_usd)}</td>
                            <td className="py-2 text-slate-500 text-[11px]">{m.note ?? "—"}</td>
                            <td className="py-2 pr-1">
                              <button onClick={() => toggleRemoveCash(m.id)}
                                className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                                  m._removed ? "text-emerald-400 bg-emerald-400/10" : "text-slate-700 hover:text-rose-400 hover:bg-rose-400/10"}`}>
                                {m._removed ? <Plus className="w-3 h-3"/> : <Minus className="w-3 h-3"/>}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── CONFIRMING ─────────────────────────────────────────────── */}
          {step === "confirming" && (
            <div className="flex flex-col items-center justify-center py-20 px-6 gap-5">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-t-teal-400 animate-spin"/>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <div className="text-white font-semibold">Guardando…</div>
                <div className="text-slate-600 text-xs mt-1">Trades y movimientos de cash al portfolio</div>
              </div>
            </div>
          )}

          {/* ── DONE ───────────────────────────────────────────────────── */}
          {step === "done" && doneInfo && (
            <div className="flex flex-col items-center justify-center py-16 px-6 gap-6 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}>
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <div className="text-white font-bold text-lg">
                  {doneInfo.trades} trade{doneInfo.trades !== 1 ? "s" : ""} importado{doneInfo.trades !== 1 ? "s" : ""}
                </div>
                {doneInfo.cash > 0 && (
                  <div className="text-sky-400 text-sm mt-1">
                    + {doneInfo.cash} movimiento{doneInfo.cash !== 1 ? "s" : ""} de cash registrado{doneInfo.cash !== 1 ? "s" : ""}
                  </div>
                )}
                <div className="text-slate-600 text-xs mt-1">Ya están sumados a tu portfolio</div>
              </div>
              <div className="flex gap-3">
                <button onClick={reset}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}>
                  <RefreshCw className="w-3.5 h-3.5"/> Importar otro
                </button>
                <button onClick={handleClose}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)" }}>
                  Ver portfolio
                </button>
              </div>
            </div>
          )}

          {/* ── ERROR ──────────────────────────────────────────────────── */}
          {step === "error" && (
            <div className="flex flex-col items-center justify-center py-16 px-6 gap-5 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <AlertTriangle className="w-7 h-7 text-rose-400" />
              </div>
              <div>
                <div className="text-white font-semibold">No se pudo procesar</div>
                <div className="text-slate-600 text-xs mt-1 max-w-sm">{errMsg}</div>
              </div>
              <button onClick={reset}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}>
                <RefreshCw className="w-3.5 h-3.5"/> Intentar de nuevo
              </button>
            </div>
          )}

        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        {step === "preview" && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 shrink-0"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(4,12,26,0.8)", backdropFilter: "blur(12px)" }}>

            <div className="text-[11px] text-slate-600">
              {activeCount > 0
                ? <><span className="text-white font-semibold">{activeCount}</span> trades · <span className="text-white">{formatUsd(totalVolume)}</span>{activeCash > 0 && <> · <span className="text-sky-400">{activeCash} cash</span></>}</>
                : "Ninguna operación seleccionada"}
            </div>

            <div className="flex gap-2 shrink-0">
              <button onClick={reset}
                className="px-3 py-2 rounded-xl text-xs text-slate-500"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                Volver
              </button>
              <button onClick={confirmImport} disabled={activeCount === 0}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40 transition-all"
                style={{ background: "linear-gradient(135deg,#0d9488,#2563eb)", boxShadow: activeCount > 0 ? "0 4px 18px rgba(13,148,136,0.25)" : "none" }}>
                <CheckCircle2 className="w-3.5 h-3.5"/>
                Importar {activeCount} trade{activeCount !== 1 ? "s" : ""}
                {activeCash > 0 && brokerAccountId && ` + ${activeCash} cash`}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
