"use client";

import { useState } from "react";
import Modal from "./Modal";
import { useSettings } from "../context/SettingsContext";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate?: (payload: FormData) => Promise<void> | void;
};

const CLASSES = ["acciones", "etfs", "cripto", "bonos", "metales"] as const;
type AssetClass = (typeof CLASSES)[number];

type SearchResult = {
  source: "crypto" | "stock";
  symbol: string;
  name: string;
  extra?: string | null;
};

type OperationSide = "compra" | "venta";

export default function AddAssetModal({ open, onClose, onCreate }: Props) {
  const { currency, format } = useSettings();

  // 🔹 NUEVOS campos
  const [date, setDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );
  const [side, setSide] = useState<OperationSide>("compra");
  const [fee, setFee] = useState<string>("");

  // Campos base
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [aclass, setAclass] = useState<AssetClass>("acciones");
  const [qty, setQty] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [err, setErr] = useState<string>("");

  // Búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const reset = () => {
    setSymbol("");
    setName("");
    setAclass("acciones");
    setQty("");
    setPrice("");
    setErr("");
    setSearchTerm("");
    setSearchResults([]);
    setSearchLoading(false);
    setSearchError(null);
    setDate(new Date().toISOString().slice(0, 10));
    setSide("compra");
    setFee("");
  };

  const submit = async () => {
    if (!symbol.trim())
      return setErr(
        "El símbolo es obligatorio (ej: AAPL, VOO, BTC)."
      );
    if (!name.trim()) return setErr("El nombre es obligatorio.");
    if (!date) return setErr("La fecha es obligatoria.");

    const qn = Number(qty.replace(",", "."));
    const pn = Number(price.replace(",", "."));
    const fn = fee ? Number(fee.replace(",", ".")) : 0;

    if (!(qn > 0))
      return setErr("La cantidad debe ser un número mayor a 0.");
    if (!(pn >= 0)) return setErr("El precio debe ser un número válido.");
    if (isNaN(fn) || fn < 0)
      return setErr("La comisión debe ser un número válido (>= 0).");

    setErr("");
    const fd = new FormData();

    // 🔹 Campos nuevos estilo Google Sheets
    fd.set("fecha", date); // ej: 2025-08-11
    fd.set("tipoOperacion", side === "compra" ? "Compra" : "Venta");
    fd.set("comisionUsd", String(fn));

    // 🔹 Campos que ya usabas
    fd.set("symbol", symbol.trim().toUpperCase());
    fd.set("name", name.trim());
    fd.set("class", aclass);
    fd.set("quantity", String(qn));
    fd.set("price", String(pn));
    fd.set("currency", currency);

    // 🔹 Monto total aproximado (por si lo querés usar en el backend)
    const monto = qn * pn + fn;
    fd.set("montoUsd", String(monto));

    try {
      if (onCreate) await onCreate(fd);
      onClose();
      reset();
    } catch (e: any) {
      setErr(e?.message ?? "No se pudo crear el activo.");
    }
  };

  const handleSelectResult = (r: SearchResult) => {
    setSymbol(r.symbol);
    setName(r.name);
    if (r.source === "crypto") {
      setAclass("cripto");
    }
    if (r.source === "stock" && aclass === "cripto") {
      setAclass("acciones");
    }
  };

  const handleSearch = async () => {
    const term = searchTerm.trim();
    if (!term) return;
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const endpoint =
        aclass === "cripto" ? "/api/crypto-search" : "/api/stock-search";

      const res = await fetch(
        `${endpoint}?q=${encodeURIComponent(term)}`
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (aclass === "cripto") {
        const raw = (data.results ?? []) as Array<{
          symbol: string;
          name: string;
          rank?: number | null;
        }>;
        const mapped: SearchResult[] = raw.map((c) => ({
          source: "crypto",
          symbol: c.symbol.toUpperCase(),
          name: c.name,
          extra: c.rank ? `#${c.rank}` : null,
        }));
        setSearchResults(mapped);
      } else {
        const raw = (data.results ?? []) as Array<{
          symbol: string;
          name: string;
          exchange?: string | null;
          type?: string | null;
        }>;
        const mapped: SearchResult[] = raw.map((s) => ({
          source: "stock",
          symbol: s.symbol,
          name: s.name,
          extra: s.exchange || s.type || null,
        }));
        setSearchResults(mapped);
      }
    } catch (e: any) {
      console.error("[AddAssetModal search] error", e);
      setSearchError(e?.message ?? "No se pudo buscar el activo.");
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
        setErr("");
      }}
      title="Agregar activo"
    >
      <div className="space-y-4">
        {/* 🔹 NUEVO: Fecha + Compra/Venta */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Fecha
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-[#0b1221] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Tipo de operación
            </label>
            <div className="flex rounded-lg border border-slate-700 bg-[#0b1221] overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setSide("compra")}
                className={
                  "flex-1 px-3 py-2 " +
                  (side === "compra"
                    ? "bg-[#3b82f6] text-white"
                    : "text-slate-200")
                }
              >
                Compra
              </button>
              <button
                type="button"
                onClick={() => setSide("venta")}
                className={
                  "flex-1 px-3 py-2 " +
                  (side === "venta"
                    ? "bg-rose-600 text-white"
                    : "text-slate-200")
                }
              >
                Venta
              </button>
            </div>
          </div>
        </div>

        {/* 🔍 Buscador por símbolo/nombre */}
        <div className="space-y-2">
          <label className="block text-xs text-slate-400">
            Buscar activo por símbolo o nombre
          </label>
          <div className="flex gap-2">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                aclass === "cripto"
                  ? "BTC, ETH, Solana..."
                  : "AAPL, VOO, QQQ..."
              }
              className="flex-1 bg-[#0b1221] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={searchLoading}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-100 disabled:opacity-60"
            >
              {searchLoading ? "Buscando..." : "Buscar"}
            </button>
          </div>
          {searchError && (
            <div className="text-xs text-rose-400">{searchError}</div>
          )}

          {searchResults.length > 0 && (
            <div className="max-h-52 overflow-y-auto mt-2 border border-slate-800 rounded-lg bg-[#020617]">
              {searchResults.map((r) => (
                <button
                  key={`${r.source}-${r.symbol}`}
                  type="button"
                  onClick={() => handleSelectResult(r)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-medium text-slate-100">
                      {r.symbol}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {r.name}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700">
                      {r.source === "crypto" ? "CRYPTO" : "STOCK / ETF"}
                    </span>
                    {r.extra && (
                      <span className="text-[10px] text-slate-500">
                        {r.extra}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Campos manuales (símbolo, nombre, etc.) */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Símbolo
            </label>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="AAPL / VOO / BTC"
              className="w-full bg-[#0b1221] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Nombre
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Apple Inc."
              className="w-full bg-[#0b1221] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-3 sm:col-span-1">
            <label className="block text-xs text-slate-400 mb-1">
              Clase
            </label>
            <select
              value={aclass}
              onChange={(e) => setAclass(e.target.value as AssetClass)}
              className="w-full bg-[#0b1221] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none"
            >
              {CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Cantidad
            </label>
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              inputMode="decimal"
              className="w-full bg-[#0b1221] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Precio ({currency})
            </label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="w-full bg-[#0b1221] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
            {price && (
              <div className="text-xs text-slate-400 mt-1">
                {(() => {
                  const pn = Number(price.replace(",", "."));
                  const qn = Number(qty.replace(",", "."));
                  return isNaN(pn) || isNaN(qn)
                    ? ""
                    : `Monto aprox. (sin comisión): ${format(qn * pn)}`;
                })()}
              </div>
            )}
          </div>
        </div>

        {/* 🔹 NUEVO: Comisión */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-3 sm:col-span-1">
            <label className="block text-xs text-slate-400 mb-1">
              Comisión (USD)
            </label>
            <input
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="w-full bg-[#0b1221] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>
        </div>

        {err && <div className="text-sm text-rose-400">{err}</div>}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={() => {
              onClose();
              reset();
            }}
            className="px-4 py-2 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800/50 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            className="px-4 py-2 rounded-lg bg-[#3b82f6] hover:bg-blue-500 text-white text-sm"
          >
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}
