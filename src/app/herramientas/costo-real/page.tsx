"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Clock, DollarSign, Settings, Zap, Package,
  AlertCircle, CheckCircle, HelpCircle, History,
  Trash2, X, RefreshCw,
} from "lucide-react";
import { useExchangeRates } from "@/hooks/useExchangeRates";

// ─── TIPOS ────────────────────────────────────────────────────────────────────
type SalaryConfig = {
  monthlyNet: number;
  hoursPerDay: number;
  daysPerMonth: number;
  currency: string;
};
type ConsultaItem = {
  id: string;
  name: string;
  price: number;
  currency: string;
  priceConverted: number;
  hours: number;
  days: number;
  perMonth: number;
  worthIt: "yes" | "maybe" | "no";
  savedAt: string;
};

const CURRENCIES = ["USD", "UYU", "ARS", "EUR", "BRL"];
const STORAGE_KEY_SALARY  = "costo_real_salary";
const STORAGE_KEY_HISTORY = "costo_real_history";
const DEFAULT_SALARY: SalaryConfig = {
  monthlyNet: 0, hoursPerDay: 8, daysPerMonth: 22, currency: "USD",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmtMoney(n: number, currency = "USD") {
  const abs = Math.abs(n), sign = n < 0 ? "-" : "";
  const sym: Record<string,string> = { USD:"US$", UYU:"$U", ARS:"$", EUR:"€", BRL:"R$" };
  const s = sym[currency] ?? "$";
  if (abs >= 1_000_000) return `${sign}${s}${(abs/1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${sign}${s}${(abs/1_000).toFixed(1)}k`;
  return `${sign}${s}${abs.toLocaleString("es-UY",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}
function fmtHours(h: number) {
  if (h < 1/60) return "< 1 min";
  if (h < 1)    return `${Math.round(h * 60)} min`;
  if (h < 24)   return `${h.toFixed(1).replace(/\.0$/,"")} h`;
  return `${(h/24).toFixed(1).replace(/\.0$/,"")} días`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-UY", { day:"2-digit", month:"short", year:"2-digit" });
}
function getId() { return Math.random().toString(36).slice(2,10); }
function worthItLevel(hours: number, totalHours: number): "yes"|"maybe"|"no" {
  const pct = (hours / totalHours) * 100;
  return pct <= 2 ? "yes" : pct <= 10 ? "maybe" : "no";
}

// ─── ESTILOS BASE ─────────────────────────────────────────────────────────────
const IS: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10, padding: "9px 12px", color: "white", fontSize: 13,
  outline: "none", width: "100%",
};

// ─── ATOMS ────────────────────────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] text-slate-600 uppercase tracking-wider mb-1.5 block font-medium">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-700 mt-1">{hint}</p>}
    </div>
  );
}
function CurrencySelect({ value, onChange }: { value: string; onChange: (v:string)=>void }) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{...IS, appearance:"none" as const, cursor:"pointer"}}>
      {CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
    </select>
  );
}

// ─── GAUGE ────────────────────────────────────────────────────────────────────
function WorthItGauge({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 100);
  const color = clamped <= 2 ? "#34d399" : clamped <= 10 ? "#fbbf24" : "#f87171";
  const label = clamped <= 2 ? "Vale la pena" : clamped <= 10 ? "Pensalo dos veces" : "Muy caro para vos";
  const Icon  = clamped <= 2 ? CheckCircle : clamped <= 10 ? HelpCircle : AlertCircle;
  const R = 52, CX = 64, CY = 64, arc = Math.PI * R;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{width:128,height:72}}>
        <svg width={128} height={72} viewBox="0 0 128 72">
          <path d={`M ${CX-R},${CY} A ${R},${R} 0 0,1 ${CX+R},${CY}`}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} strokeLinecap="round"/>
          <path d={`M ${CX-R},${CY} A ${R},${R} 0 0,1 ${CX+R},${CY}`}
            fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
            strokeDasharray={`${arc}`} strokeDashoffset={arc*(1-clamped/100)}
            style={{transition:"stroke-dashoffset 0.6s ease, stroke 0.4s ease"}}/>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <Icon className="w-4 h-4 mb-0.5" style={{color}}/>
          <span className="text-[10px] font-bold" style={{color}}>{clamped.toFixed(1)}%</span>
          <span className="text-[9px] text-slate-600">de tu mes</span>
        </div>
      </div>
      <div className="text-xs font-semibold" style={{color}}>{label}</div>
    </div>
  );
}

// ─── RESULT CARD ──────────────────────────────────────────────────────────────
function ResultCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl p-3.5"
      style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}>
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-lg flex items-center justify-center"
          style={{background:`${color}15`,border:`1px solid ${color}25`}}>
          {icon}
        </div>
        <span className="text-[10px] text-slate-600 uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="text-lg font-bold text-white tabular-nums leading-none">{value}</div>
      {sub && <div className="text-[10px] text-slate-600">{sub}</div>}
    </div>
  );
}

// ─── HISTORY ROW ──────────────────────────────────────────────────────────────
function HistoryRow({ item, onDelete, onReload }: {
  item: ConsultaItem; onDelete:()=>void; onReload:()=>void;
}) {
  const color = item.worthIt==="yes"?"#34d399":item.worthIt==="maybe"?"#fbbf24":"#f87171";
  const Icon  = item.worthIt==="yes"?CheckCircle:item.worthIt==="maybe"?HelpCircle:AlertCircle;
  return (
    <div className="flex items-center gap-3 px-4 py-3 group transition-colors"
      style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}
      onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.014)")}
      onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
      <Icon className="w-4 h-4 shrink-0" style={{color}}/>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-white truncate">{item.name||"Sin nombre"}</div>
        <div className="text-[10px] text-slate-600 mt-0.5 tabular-nums">
          {fmtMoney(item.price,item.currency)} · {fmtHours(item.hours)} de trabajo · {fmtDate(item.savedAt)}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onReload} title="Cargar"
          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 hover:text-sky-400 hover:bg-sky-400/10 transition-all">
          <Zap className="w-3 h-3"/>
        </button>
        <button onClick={onDelete} title="Eliminar"
          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 hover:text-rose-400 hover:bg-rose-400/10 transition-all">
          <Trash2 className="w-3 h-3"/>
        </button>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function CostoRealPage() {
  const { convert, loading: ratesLoading, error: ratesError, fromCache } = useExchangeRates();

  const [salary,      setSalaryState] = useState<SalaryConfig>(DEFAULT_SALARY);
  const [showSetup,   setShowSetup]   = useState(false);
  const [history,     setHistory]     = useState<ConsultaItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [productName,     setProductName]     = useState("");
  const [productPrice,    setProductPrice]    = useState("");
  const [productCurrency, setProductCurrency] = useState("USD");
  const [hasResult,       setHasResult]       = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY_SALARY);
      if (s) setSalaryState(JSON.parse(s));
      const h = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (h) setHistory(JSON.parse(h));
    } catch {}
  }, []);

  function saveSalary(s: SalaryConfig) {
    setSalaryState(s);
    try { localStorage.setItem(STORAGE_KEY_SALARY, JSON.stringify(s)); } catch {}
  }

  const totalHoursMonth = salary.hoursPerDay * salary.daysPerMonth;

  const hourlyRate = useMemo(() =>
    salary.monthlyNet && totalHoursMonth > 0 ? salary.monthlyNet / totalHoursMonth : 0,
    [salary, totalHoursMonth]
  );

  const priceConverted = useMemo(() => {
    const raw = parseFloat(productPrice.replace(",", "."));
    if (!raw || isNaN(raw) || raw <= 0) return null;
    return convert(raw, productCurrency, salary.currency);
  }, [productPrice, productCurrency, salary.currency, convert]);

  const result = useMemo(() => {
    if (!priceConverted || !hourlyRate) return null;
    const hours    = priceConverted / hourlyRate;
    const days     = hours / salary.hoursPerDay;
    const perMonth = salary.monthlyNet / priceConverted;
    const pctMonth = (hours / totalHoursMonth) * 100;
    return { hours, days, perMonth, pctMonth, worthIt: worthItLevel(hours, totalHoursMonth) };
  }, [priceConverted, hourlyRate, salary, totalHoursMonth]);

  function handleCalculate() { if (result) setHasResult(true); }

  function handleSave() {
    if (!result || !hasResult || !priceConverted) return;
    const raw = parseFloat(productPrice.replace(",", "."));
    const item: ConsultaItem = {
      id: getId(), name: productName, price: raw, currency: productCurrency,
      priceConverted, hours: result.hours, days: result.days,
      perMonth: result.perMonth, worthIt: result.worthIt,
      savedAt: new Date().toISOString(),
    };
    const next = [item, ...history].slice(0, 50);
    setHistory(next);
    try { localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(next)); } catch {}
  }

  function deleteHistory(id: string) {
    const next = history.filter(h => h.id !== id);
    setHistory(next);
    try { localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(next)); } catch {}
  }

  function reloadItem(item: ConsultaItem) {
    setProductName(item.name); setProductPrice(String(item.price));
    setProductCurrency(item.currency); setHasResult(false); setShowHistory(false);
  }

  const salaryConfigured = salary.monthlyNet > 0;
  const differentCurrency = productCurrency !== salary.currency;

  return (
    <div className="px-4 md:px-6 py-5 md:py-6 space-y-5 max-w-2xl mx-auto">

      {/* HEADER */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Costo real</h1>
          <p className="text-xs text-slate-600 mt-1">¿Cuánto trabajo vale ese precio?</p>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button onClick={()=>setShowHistory(v=>!v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all"
              style={{
                background: showHistory?"rgba(99,102,241,0.1)":"rgba(255,255,255,0.04)",
                border: showHistory?"1px solid rgba(99,102,241,0.25)":"1px solid rgba(255,255,255,0.07)",
                color: showHistory?"#a5b4fc":"rgba(148,163,184,0.7)",
              }}>
              <History className="w-3 h-3"/>
              Historial ({history.length})
            </button>
          )}
          <button onClick={()=>setShowSetup(v=>!v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all"
            style={{
              background: showSetup?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.04)",
              border:"1px solid rgba(255,255,255,0.08)",
              color: salaryConfigured?"#34d399":"#f87171",
            }}>
            <Settings className="w-3 h-3"/>
            {salaryConfigured?`${fmtMoney(salary.monthlyNet,salary.currency)}/mes`:"Configurar sueldo"}
          </button>
        </div>
      </div>

      {/* ESTADO TIPO DE CAMBIO */}
      {!ratesLoading && (
        <div className="flex items-center gap-1.5 text-[10px]"
          style={{color:ratesError?"#f87171":"rgba(100,116,139,0.6)"}}>
          <RefreshCw className="w-2.5 h-2.5"/>
          {ratesError
            ? "Tipo de cambio no disponible — usando tasas aproximadas"
            : fromCache
            ? "Tipo de cambio de hoy (caché)"
            : "Tipo de cambio actualizado ahora"}
        </div>
      )}

      {/* SETUP SUELDO */}
      {(showSetup || !salaryConfigured) && (
        <div className="rounded-2xl p-5 space-y-4"
          style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.09)"}}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-white">Tu sueldo</div>
              <div className="text-[11px] text-slate-600 mt-0.5">Solo se guarda en este dispositivo</div>
            </div>
            {showSetup && salaryConfigured && (
              <button onClick={()=>setShowSetup(false)} className="text-slate-600 hover:text-white transition-colors">
                <X className="w-4 h-4"/>
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sueldo mensual neto">
              <input type="number" placeholder="ej: 2500" value={salary.monthlyNet||""}
                onChange={e=>saveSalary({...salary,monthlyNet:parseFloat(e.target.value)||0})}
                style={IS}/>
            </Field>
            <Field label="Moneda">
              <CurrencySelect value={salary.currency} onChange={v=>saveSalary({...salary,currency:v})}/>
            </Field>
            <Field label="Horas por día" hint="Horas reales de trabajo">
              <input type="number" placeholder="8" value={salary.hoursPerDay}
                onChange={e=>saveSalary({...salary,hoursPerDay:parseFloat(e.target.value)||8})}
                style={IS}/>
            </Field>
            <Field label="Días laborables/mes" hint="Normalmente 20–23">
              <input type="number" placeholder="22" value={salary.daysPerMonth}
                onChange={e=>saveSalary({...salary,daysPerMonth:parseFloat(e.target.value)||22})}
                style={IS}/>
            </Field>
          </div>
          {salaryConfigured && (
            <div className="rounded-xl px-4 py-2.5 flex items-center justify-between text-[11px]"
              style={{background:"rgba(52,211,153,0.07)",border:"1px solid rgba(52,211,153,0.15)"}}>
              <span className="text-slate-500">Tu valor hora</span>
              <span className="font-bold text-emerald-400 tabular-nums">
                {fmtMoney(hourlyRate,salary.currency)}/hora
              </span>
            </div>
          )}
        </div>
      )}

      {/* HISTORIAL */}
      {showHistory && history.length > 0 && (
        <div className="rounded-2xl overflow-hidden"
          style={{border:"1px solid rgba(255,255,255,0.07)"}}>
          <div className="flex items-center justify-between px-4 py-3"
            style={{borderBottom:"1px solid rgba(255,255,255,0.05)",background:"rgba(255,255,255,0.02)"}}>
            <div className="text-sm font-semibold text-white">Consultas guardadas</div>
            <button onClick={()=>{setHistory([]);try{localStorage.removeItem(STORAGE_KEY_HISTORY);}catch{}}}
              className="text-[10px] text-slate-700 hover:text-rose-400 transition-colors">
              Borrar todo
            </button>
          </div>
          {history.map(item=>(
            <HistoryRow key={item.id} item={item}
              onDelete={()=>deleteHistory(item.id)}
              onReload={()=>reloadItem(item)}/>
          ))}
        </div>
      )}

      {/* CALCULADORA */}
      {salaryConfigured && (
        <div className="rounded-2xl p-5 space-y-4"
          style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.09)"}}>
          <div className="text-sm font-semibold text-white">¿Cuánto cuesta en horas?</div>
          <div className="space-y-3">
            <Field label="Producto o servicio (opcional)">
              <input placeholder="ej: iPhone 16, Netflix, Zapatillas…" value={productName}
                onChange={e=>{setProductName(e.target.value);setHasResult(false);}}
                style={IS}/>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Field label="Precio">
                  <input type="number" placeholder="0,00" value={productPrice}
                    onChange={e=>{setProductPrice(e.target.value);setHasResult(false);}}
                    onKeyDown={e=>e.key==="Enter"&&handleCalculate()}
                    style={IS}/>
                </Field>
              </div>
              <Field label="Moneda">
                <CurrencySelect value={productCurrency}
                  onChange={v=>{setProductCurrency(v);setHasResult(false);}}/>
              </Field>
            </div>

            {/* Preview conversión en tiempo real */}
            {differentCurrency && priceConverted && !ratesLoading && (
              <div className="rounded-xl px-3 py-2 flex items-center justify-between text-[11px]"
                style={{background:"rgba(96,165,250,0.07)",border:"1px solid rgba(96,165,250,0.15)"}}>
                <span className="text-slate-500">
                  {fmtMoney(parseFloat(productPrice),productCurrency)} en {salary.currency}
                </span>
                <span className="font-semibold text-sky-400 tabular-nums">
                  ≈ {fmtMoney(priceConverted,salary.currency)}
                </span>
              </div>
            )}
          </div>

          {result && !hasResult && (
            <button onClick={handleCalculate}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white active:scale-95 transition-all"
              style={{background:"linear-gradient(135deg,#0d9488,#2563eb)"}}>
              Calcular
            </button>
          )}
        </div>
      )}

      {/* RESULTADO */}
      {salaryConfigured && result && hasResult && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <ResultCard label="Tiempo de trabajo" value={fmtHours(result.hours)}
              sub={result.hours>=salary.hoursPerDay?`${result.days.toFixed(1)} días laborables`:`${Math.round(result.hours*60)} min en total`}
              icon={<Clock className="w-3 h-3" style={{color:"#60a5fa"}}/>} color="#60a5fa"/>
            <ResultCard label="Cuántos por mes" value={`× ${result.perMonth.toFixed(1)}`}
              sub={`Podés comprar ${Math.floor(result.perMonth)} al mes`}
              icon={<Package className="w-3 h-3" style={{color:"#a78bfa"}}/>} color="#a78bfa"/>
          </div>

          <div className="rounded-2xl p-5 flex flex-col items-center gap-4"
            style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.09)"}}>
            <WorthItGauge pct={result.pctMonth}/>

            <div className="w-full rounded-xl px-4 py-3 text-sm text-slate-400 leading-relaxed"
              style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.05)"}}>
              {productName
                ? <><span className="text-white font-semibold">{productName}</span> te cuesta </>
                : "Este producto te cuesta "}
              <span className="text-white font-semibold">{fmtHours(result.hours)}</span> de trabajo
              {result.hours >= salary.hoursPerDay && (
                <>, o sea <span className="text-white font-semibold">{result.days.toFixed(1)} días</span> completos</>
              )}.
              {differentCurrency && priceConverted && (
                <> Al tipo de cambio de hoy equivale a{" "}
                  <span className="text-white font-semibold">{fmtMoney(priceConverted,salary.currency)}</span>.
                </>
              )}
              {" "}Con tu sueldo actual podés comprarlo{" "}
              <span className="text-white font-semibold">
                {Math.floor(result.perMonth)} {Math.floor(result.perMonth)===1?"vez":"veces"}
              </span> al mes.
              {" "}{result.worthIt==="yes"&&"Parece razonable."}
              {result.worthIt==="maybe"&&"Pensalo bien antes de comprarlo."}
              {result.worthIt==="no"&&"Es una compra que pesa bastante en tu presupuesto mensual."}
            </div>

            <div className="w-full grid grid-cols-3 gap-2 text-center">
              {[
                {label:"de tu jornada",value:`${((result.hours/salary.hoursPerDay)*100).toFixed(0)}%`},
                {label:"de tu semana", value:`${((result.hours/(salary.hoursPerDay*5))*100).toFixed(0)}%`},
                {label:"de tu mes",    value:`${result.pctMonth.toFixed(1)}%`},
              ].map(c=>(
                <div key={c.label} className="rounded-xl py-2.5"
                  style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
                  <div className="text-base font-bold text-white tabular-nums">{c.value}</div>
                  <div className="text-[10px] text-slate-600 mt-0.5">{c.label}</div>
                </div>
              ))}
            </div>

            <button onClick={handleSave}
              className="w-full py-2 rounded-xl text-[11px] font-semibold transition-all"
              style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(148,163,184,0.7)"}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.07)";e.currentTarget.style.color="white";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.04)";e.currentTarget.style.color="rgba(148,163,184,0.7)";}}>
              Guardar en historial
            </button>
          </div>

          <button onClick={()=>setHasResult(false)}
            className="w-full py-2 rounded-xl text-[11px] text-slate-600 hover:text-slate-400 transition-colors">
            ← Calcular otro
          </button>
        </>
      )}

      {/* EMPTY */}
      {!salaryConfigured && !showSetup && (
        <div className="rounded-2xl flex flex-col items-center justify-center py-14 gap-3"
          style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)"}}>
          <DollarSign className="w-8 h-8 text-slate-700"/>
          <div className="text-sm text-slate-600">Primero configurá tu sueldo</div>
          <div className="text-xs text-slate-700 text-center max-w-xs">
            Solo se guarda en este dispositivo, nunca se envía al servidor
          </div>
          <button onClick={()=>setShowSetup(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white mt-1"
            style={{background:"linear-gradient(135deg,#0d9488,#2563eb)"}}>
            <Settings className="w-3.5 h-3.5"/> Configurar sueldo
          </button>
        </div>
      )}
    </div>
  );
}
