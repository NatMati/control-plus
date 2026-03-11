// src/app/inversiones/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, AreaChart, Area,
} from "recharts";
import {
  Wallet, Hash, Upload, Trash2, Plus, Minus, Pencil, X,
  ChevronRight, RefreshCw, ChevronDown, ChevronUp,
  ArrowUpRight, ArrowDownRight, BarChart3, Clock, Calendar, Pin,
  Sparkles, FileText, Image, Building2, DollarSign, TrendingUp, TrendingDown,
  Activity,
} from "lucide-react";
import ImportInvestmentsAI from "@/components/ImportInvestmentsAI";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

type AssetType = "Acción" | "ETFs" | "Cripto" | "Metales" | "Bonos" | "Cash";
type ChartMode = "VALOR" | "RENDIMIENTO" | "AMBOS";
type PieMode   = "TIPO" | "ACTIVO";
type TimeRange = "1M" | "3M" | "6M" | "1Y" | "TODO" | "CUSTOM";

type SnapshotPosition = { symbol:string; type?:string; quantity:number; buyPrice:number; currentPrice?:number; isCash?:boolean; brokerName?:string };
type UiPosition = {
  symbol:string; type:AssetType; quantity:number; buyPrice:number;
  currentPrice:number|null; invested:number; valueNow:number; pnl:number; pnlPct:number;
  isCash:boolean; brokerName?:string;
};
type HistoryPoint  = { date:string; value:number; contributed:number; performance:number };
type QuoteResponse = { price:number|null };
type PositionOverride = { symbol:string; buyPrice?:number; quantity?:number; updatedAt:string };
type OverridesMap  = Record<string, PositionOverride>;
type RecentTrade   = {
  id:string; date:string; symbol:string; side:"BUY"|"SELL";
  quantity:number; price:number; total_usd:number; fee_usd?:number; note?:string;
};
type BrokerLiquidity = {
  broker_account_id: string;
  broker_name: string;
  currency: string;
  liquidity_usd: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function toNum(v:any):number { const n=Number(v); return Number.isFinite(n)?n:0; }

function formatUsd(n:number, compact=false) {
  const sign=n<0?"-":""; const abs=Math.abs(n);
  if(compact&&abs>=1_000_000) return `${sign}US$${(abs/1_000_000).toFixed(2)}M`;
  if(compact&&abs>=1_000)     return `${sign}US$${(abs/1_000).toFixed(1)}k`;
  return `${sign}US$ ${abs.toLocaleString("es-UY",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}
function formatPct(n:number, showSign=true) {
  const sign=showSign?(n>=0?"+":"-"):(n<0?"-":"");
  return `${sign}${Math.abs(n).toLocaleString("es-UY",{minimumFractionDigits:2,maximumFractionDigits:2})}%`;
}
function formatQty(n:number){ return n.toLocaleString("es-UY",{minimumFractionDigits:0,maximumFractionDigits:6}); }
function monthLabel(d:string){ const dt=new Date(d+"T00:00:00Z"); const m=new Intl.DateTimeFormat("es-UY",{month:"short"}).format(dt); return m.charAt(0).toUpperCase()+m.slice(1); }
function shortDate(d:string){ const dt=new Date(d+"T00:00:00Z"); return new Intl.DateTimeFormat("es-UY",{day:"2-digit",month:"short"}).format(dt); }
function todayIso(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function parseNum(v:string):number {
  const s=v.trim(); if(!s) return NaN;
  let n=s;
  if(s.includes(",")&&s.includes(".")) n=s.replace(/\./g,"").replace(",",".");
  else if(s.includes(",")) n=s.replace(",",".");
  const r=Number(n); return Number.isFinite(r)?r:NaN;
}

const OVERRIDES_KEY="controlplus_investments_overrides_v1";
function readOverrides():OverridesMap{ if(typeof window==="undefined") return {}; try{ const r=localStorage.getItem(OVERRIDES_KEY); return r?JSON.parse(r):{}; }catch{ return {}; } }
function writeOverrides(o:OverridesMap){ if(typeof window!=="undefined") localStorage.setItem(OVERRIDES_KEY,JSON.stringify(o)); }

const CRYPTO_SET=new Set(["BTC","ETH","ADA","XRP","SOL"]);
const METALS_SET=new Set(["SLV","IAU","GLD"]);
const ETF_SET=new Set(["VOO","QQQ","QQQM","RSP","VTI","SPY","IVV","VT","VEA","VWO","AVUV"]);
function inferType(s:string, isCash?:boolean):AssetType {
  if(isCash||s.startsWith("CASH::")) return "Cash";
  const u=s.trim().toUpperCase();
  if(CRYPTO_SET.has(u)||u.endsWith("-USD")) return "Cripto";
  if(METALS_SET.has(u)) return "Metales";
  if(ETF_SET.has(u))    return "ETFs";
  return "Acción";
}

const TYPE_COLOR:Record<string,{color:string;bg:string;border:string;glow:string}> = {
  "Acción": {color:"#60a5fa",bg:"rgba(96,165,250,0.08)",  border:"rgba(96,165,250,0.22)", glow:"rgba(96,165,250,0.15)"},
  "ETFs":   {color:"#34d399",bg:"rgba(52,211,153,0.08)",  border:"rgba(52,211,153,0.22)", glow:"rgba(52,211,153,0.15)"},
  "Cripto": {color:"#fbbf24",bg:"rgba(251,191,36,0.08)",  border:"rgba(251,191,36,0.22)", glow:"rgba(251,191,36,0.15)"},
  "Metales":{color:"#a78bfa",bg:"rgba(167,139,250,0.08)", border:"rgba(167,139,250,0.22)",glow:"rgba(167,139,250,0.15)"},
  "Bonos":  {color:"#f87171",bg:"rgba(248,113,113,0.08)", border:"rgba(248,113,113,0.22)",glow:"rgba(248,113,113,0.15)"},
  "Cash":   {color:"#22d3ee",bg:"rgba(34,211,238,0.08)",  border:"rgba(34,211,238,0.22)", glow:"rgba(34,211,238,0.15)"},
  "Todas":  {color:"#94a3b8",bg:"rgba(148,163,184,0.06)", border:"rgba(148,163,184,0.18)",glow:"rgba(148,163,184,0.1)"},
};

const PIE_COLORS=["#60A5FA","#34D399","#FBBF24","#A78BFA","#F87171","#22D3EE","#FB923C","#4ADE80","#C084FC","#F472B6","#38BDF8","#A3E635"];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES ATÓMICOS
// ─────────────────────────────────────────────────────────────────────────────

function TypeBadge({type}:{type:string}){
  const cfg=TYPE_COLOR[type]??TYPE_COLOR["Todas"];
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{color:cfg.color,background:cfg.bg,border:`1px solid ${cfg.border}`}}>{type}</span>;
}

function PnlBadge({value,pct,compact=false}:{value:number;pct?:number;compact?:boolean}){
  const pos=value>=0;
  return (
    <div className={`flex items-center gap-1 ${pos?"text-emerald-400":"text-rose-400"}`}>
      {pos?<ArrowUpRight className="w-3 h-3 shrink-0"/>:<ArrowDownRight className="w-3 h-3 shrink-0"/>}
      <span className="font-bold tabular-nums text-xs">{formatUsd(value,compact)}</span>
      {pct!==undefined&&<span className="text-[10px] opacity-70">({formatPct(pct)})</span>}
    </div>
  );
}

function RangePills({value,onChange,showCustom=false}:{value:TimeRange;onChange:(v:TimeRange)=>void;showCustom?:boolean}){
  const opts:TimeRange[]=["1M","3M","6M","1Y","TODO",...(showCustom?["CUSTOM" as TimeRange]:[])];
  return (
    <div className="flex rounded-xl p-0.5 gap-0.5 flex-wrap" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>
      {opts.map(r=>(
        <button key={r} onClick={()=>onChange(r)} className="px-2 py-0.5 rounded-lg text-[11px] font-medium transition-all"
          style={{background:r===value?"rgba(255,255,255,0.1)":"transparent",color:r===value?"white":"rgba(148,163,184,0.55)",border:r===value?"1px solid rgba(255,255,255,0.12)":"1px solid transparent"}}>
          {r==="TODO"?"Todo":r==="CUSTOM"?"Custom":r}
        </button>
      ))}
    </div>
  );
}

function MField({label,hint,children}:{label:string;hint?:string;children:React.ReactNode}){
  return (
    <div>
      <label className="text-[10px] text-slate-600 mb-1.5 block uppercase tracking-wider">{label}</label>
      {children}
      {hint&&<p className="text-[10px] text-slate-700 mt-1">{hint}</p>}
    </div>
  );
}
const iStyle:React.CSSProperties={background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 12px",color:"white",fontSize:13,outline:"none",width:"100%"};

function Modal({open,title,sub,onClose,children}:{open:boolean;title:string;sub?:string;onClose:()=>void;children:React.ReactNode}){
  if(!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{background:"rgba(0,0,0,0.8)",backdropFilter:"blur(8px)"}}
      onClick={e=>{if(e.target===e.currentTarget) onClose();}}>
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
        style={{background:"linear-gradient(160deg,#07101f,#040c1a)",border:"1px solid rgba(255,255,255,0.1)",maxHeight:"92dvh",overflowY:"auto"}}>
        <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
          style={{borderBottom:"1px solid rgba(255,255,255,0.07)",background:"rgba(7,16,31,0.96)",backdropFilter:"blur(12px)"}}>
          <div>
            <div className="font-bold text-white text-sm">{title}</div>
            {sub&&<div className="text-[11px] text-slate-600 mt-0.5">{sub}</div>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 hover:text-white hover:bg-white/5 transition-all">
            <X className="w-4 h-4"/>
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI CARD — rediseñada
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, iconColor, iconBg, iconBorder,
  accent, progress, children, colSpan,
}:{
  label:string; value:React.ReactNode; sub?:React.ReactNode;
  icon:React.ElementType; iconColor:string; iconBg:string; iconBorder:string;
  accent?:string; progress?:number; children?:React.ReactNode; colSpan?:string;
}){
  return (
    <div className={`relative rounded-2xl p-4 flex flex-col gap-3 overflow-hidden ${colSpan??""}`}
      style={{
        background:"rgba(255,255,255,0.025)",
        border:"1px solid rgba(255,255,255,0.07)",
      }}>
      {/* Accent glow top-left */}
      {accent&&<div className="absolute -top-6 -left-6 w-24 h-24 rounded-full blur-2xl pointer-events-none" style={{background:accent,opacity:0.18}}/>}
      <div className="flex items-center justify-between relative z-10">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{background:iconBg,border:`1px solid ${iconBorder}`}}>
          <Icon className="w-3.5 h-3.5" style={{color:iconColor}}/>
        </div>
      </div>
      <div className="relative z-10">
        <div className="text-xl font-bold text-white tabular-nums leading-none">{value}</div>
        {sub&&<div className="text-[11px] text-slate-600 mt-1">{sub}</div>}
      </div>
      {progress!==undefined&&(
        <div className="relative z-10">
          <div className="h-0.5 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.06)"}}>
            <div className="h-full rounded-full transition-all duration-700" style={{width:`${Math.min(100,Math.max(0,progress))}%`,background:iconColor,opacity:0.6}}/>
          </div>
        </div>
      )}
      {children&&<div className="relative z-10">{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BROKER LIQUIDITY PANEL
// ─────────────────────────────────────────────────────────────────────────────

function BrokerLiquidityPanel({ liquidity, loading }: { liquidity: BrokerLiquidity[]; loading: boolean }) {
  const total = liquidity.reduce((a, b) => a + toNum(b.liquidity_usd), 0);
  const maxVal = Math.max(...liquidity.map(b => Math.abs(toNum(b.liquidity_usd))), 1);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="px-5 py-3.5 flex items-center gap-2"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
        <Building2 className="w-4 h-4 text-slate-600" />
        <span className="text-sm font-semibold text-white">Liquidez por broker</span>
        <span className="ml-auto text-[11px] font-bold tabular-nums"
          style={{ color: total >= 0 ? "#34d399" : "#f87171" }}>
          {formatUsd(total, true)}
        </span>
      </div>
      {loading && <div className="px-5 py-6 text-center text-slate-700 text-xs">Cargando…</div>}
      {!loading && liquidity.length === 0 && (
        <div className="px-5 py-8 text-center space-y-2">
          <div className="text-slate-700 text-xs">No hay brokers con movimientos registrados.</div>
          <div className="text-[11px] text-slate-700">Importá un estado de cuenta con IA para trackear la liquidez.</div>
        </div>
      )}
      {!loading && liquidity.length > 0 && (
        <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
          {liquidity.map((b) => {
            const val = toNum(b.liquidity_usd);
            const pct = (Math.abs(val) / maxVal) * 100;
            const isNeg = val < 0;
            const color = isNeg ? "#f87171" : "#34d399";
            return (
              <div key={b.broker_account_id} className="px-5 py-3 hover:bg-white/[0.015] transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>
                      <Building2 className="w-3 h-3 text-indigo-400" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">{b.broker_name}</div>
                      <div className="text-[10px] text-slate-600">{b.currency}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold tabular-nums" style={{ color }}>{formatUsd(val, true)}</div>
                    <div className="text-[10px] text-slate-600">{isNeg ? "sobreinvertido" : "disponible"}</div>
                  </div>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: isNeg ? "rgba(248,113,113,0.6)" : "rgba(52,211,153,0.6)" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!loading && liquidity.length > 0 && (
        <div className="px-5 py-3 text-[10px] text-slate-700" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          Liquidez = depósitos − retiros − compras + ventas
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACORDEÓN MÓVIL
// ─────────────────────────────────────────────────────────────────────────────

function PositionCard({p,hasOverride,isDeleting,onEdit,onDelete}:{p:UiPosition;hasOverride:boolean;isDeleting:boolean;onEdit:()=>void;onDelete:()=>void}){
  const [open,setOpen]=useState(false);
  const cfg=TYPE_COLOR[p.type]??TYPE_COLOR["Todas"];
  return (
    <div className="rounded-2xl overflow-hidden" style={{background:"rgba(255,255,255,0.025)",border:`1px solid ${open?cfg.border:"rgba(255,255,255,0.06)"}`}}>
      <button className="w-full flex items-center gap-3 px-4 py-3.5 text-left" onClick={()=>setOpen(v=>!v)}>
        <div className="w-1 h-8 rounded-full shrink-0" style={{background:cfg.color,opacity:0.7}}/>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-bold text-sm text-white">{p.isCash?p.brokerName:p.symbol}</span>
            <TypeBadge type={p.type}/>
            {hasOverride&&<span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{background:"rgba(251,191,36,0.1)",border:"1px solid rgba(251,191,36,0.2)",color:"#fbbf24"}}>override</span>}
          </div>
          <div className="text-[11px] text-slate-600">{p.isCash?"Efectivo disponible":`${formatQty(p.quantity)} unid · compra ${formatUsd(p.buyPrice)}`}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold text-white tabular-nums">{formatUsd(p.valueNow,true)}</div>
          {!p.isCash&&p.currentPrice!=null&&<div className={`text-[11px] font-semibold ${p.pnl>=0?"text-emerald-400":"text-rose-400"}`}>{formatPct(p.pnlPct)}</div>}
          {p.isCash&&<div className="text-[11px] text-cyan-400">cash</div>}
        </div>
        <div className="ml-1 shrink-0">{open?<ChevronUp className="w-4 h-4 text-slate-600"/>:<ChevronDown className="w-4 h-4 text-slate-600"/>}</div>
      </button>
      {open&&(
        <div className="px-4 pb-4 space-y-3" style={{borderTop:"1px solid rgba(255,255,255,0.06)"}}>
          <div className="grid grid-cols-2 gap-2 pt-3">
            {(p.isCash
              ? ([
                  {label:"Disponible",value:formatUsd(p.valueNow),color:"#22d3ee" as string|undefined},
                  {label:"Broker",value:p.brokerName??"—",color:undefined as string|undefined},
                ] as {label:string;value:string;color?:string}[])
              : ([
                  {label:"Precio actual",value:p.currentPrice!=null?formatUsd(p.currentPrice):"—",color:undefined},
                  {label:"Invertido",    value:formatUsd(p.invested),color:undefined},
                  {label:"Valor actual", value:p.currentPrice!=null?formatUsd(p.valueNow):"—",color:undefined},
                  {label:"G/P neta",     value:p.currentPrice!=null?formatUsd(p.pnl):"—",color:p.currentPrice!=null?(p.pnl>=0?"#34d399":"#f87171"):undefined},
                  {label:"% Rent.",      value:p.currentPrice!=null?formatPct(p.pnlPct):"—",color:p.currentPrice!=null?(p.pnlPct>=0?"#34d399":"#f87171"):undefined},
                  {label:"Cantidad",     value:formatQty(p.quantity),color:undefined},
                ] as {label:string;value:string;color?:string}[])
            ).map(({label,value,color})=>(
              <div key={label} className="rounded-xl px-3 py-2" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
                <div className="text-[10px] text-slate-600 mb-0.5 uppercase tracking-wider">{label}</div>
                <div className="text-xs font-bold tabular-nums" style={{color:color??"white"}}>{value}</div>
              </div>
            ))}
          </div>
          {!p.isCash&&(
            <div className="flex gap-2">
              <Link href={`/inversiones/${encodeURIComponent(p.symbol)}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold"
                style={{background:"rgba(96,165,250,0.08)",border:"1px solid rgba(96,165,250,0.2)",color:"#60a5fa"}}>
                <ChevronRight className="w-3.5 h-3.5"/> Ver detalle
              </Link>
              <button onClick={onEdit} className="flex items-center justify-center px-3 py-2 rounded-xl text-xs"
                style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",color:"#94a3b8"}}>
                <Pencil className="w-3.5 h-3.5"/>
              </button>
              <button onClick={onDelete} disabled={isDeleting} className="flex items-center justify-center px-3 py-2 rounded-xl text-xs disabled:opacity-40"
                style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",color:"#f87171"}}>
                <Trash2 className="w-3.5 h-3.5"/>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESUMEN POR TIPO
// ─────────────────────────────────────────────────────────────────────────────

function TypeSummaryPanel({positions}:{positions:UiPosition[]}){
  const byType=useMemo(()=>{
    const map=new Map<AssetType,{invested:number;valueNow:number;count:number}>();
    for(const p of positions){
      const c=map.get(p.type)??{invested:0,valueNow:0,count:0};
      map.set(p.type,{invested:c.invested+p.invested,valueNow:c.valueNow+p.valueNow,count:c.count+1});
    }
    const total=Array.from(map.values()).reduce((a,x)=>a+x.valueNow,0);
    return Array.from(map.entries()).map(([type,d])=>({
      type,...d,pnl:d.valueNow-d.invested,pnlPct:d.invested>0?((d.valueNow-d.invested)/d.invested)*100:0,
      weight:total>0?(d.valueNow/total)*100:0,
    })).sort((a,b)=>b.valueNow-a.valueNow);
  },[positions]);

  if(!byType.length) return null;
  const total=byType.reduce((a,x)=>a+x.valueNow,0);
  return (
    <div className="rounded-2xl overflow-hidden" style={{border:"1px solid rgba(255,255,255,0.07)"}}>
      <div className="px-5 py-3.5 flex items-center gap-2" style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(255,255,255,0.02)"}}>
        <BarChart3 className="w-4 h-4 text-slate-600"/>
        <span className="text-sm font-semibold text-white">Por clase de activo</span>
        <span className="ml-auto text-[11px] text-slate-600">{formatUsd(total,true)}</span>
      </div>
      <div className="px-5 pt-4 pb-2">
        <div className="h-1.5 rounded-full overflow-hidden flex gap-px">
          {byType.map((t,i)=>(
            <div key={t.type} className="h-full rounded-full" style={{width:`${t.weight}%`,background:TYPE_COLOR[t.type]?.color??PIE_COLORS[i],minWidth:t.weight>0.5?3:0}}/>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mt-2">
          {byType.map((t,i)=>(
            <div key={t.type} className="flex items-center gap-1.5 text-[10px]">
              <div className="w-1.5 h-1.5 rounded-full" style={{background:TYPE_COLOR[t.type]?.color??PIE_COLORS[i]}}/>
              <span className="text-slate-500">{t.type}</span>
              <span className="text-slate-700">{t.weight.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="divide-y" style={{borderColor:"rgba(255,255,255,0.04)"}}>
        {byType.map(t=>{
          const cfg=TYPE_COLOR[t.type];
          return (
            <div key={t.type} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.015] transition-colors">
              <div className="w-2 h-2 rounded-full shrink-0" style={{background:cfg?.color,boxShadow:`0 0 5px ${cfg?.color}`}}/>
              <div className="w-20 shrink-0"><TypeBadge type={t.type}/></div>
              <div className="hidden sm:block w-16 text-[11px] text-slate-600">{t.count} activo{t.count>1?"s":""}</div>
              <div className="flex-1 hidden md:block">
                <div className="h-0.5 rounded-full" style={{background:"rgba(255,255,255,0.06)"}}>
                  <div className="h-full rounded-full" style={{width:`${t.weight}%`,background:cfg?.color,opacity:0.5}}/>
                </div>
              </div>
              <div className="text-right ml-auto">
                <div className="text-xs font-bold text-white tabular-nums">{formatUsd(t.valueNow,true)}</div>
                {t.type!=="Cash"&&<PnlBadge value={t.pnl} pct={t.pnlPct} compact/>}
                {t.type==="Cash"&&<div className="text-[10px] text-cyan-400">efectivo</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERACIONES RECIENTES
// ─────────────────────────────────────────────────────────────────────────────

function RecentTrades({trades,loading}:{trades:RecentTrade[];loading:boolean}){
  return (
    <div className="rounded-2xl overflow-hidden" style={{border:"1px solid rgba(255,255,255,0.07)"}}>
      <div className="px-5 py-3.5 flex items-center gap-2" style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(255,255,255,0.02)"}}>
        <Clock className="w-4 h-4 text-slate-600"/>
        <span className="text-sm font-semibold text-white">Operaciones recientes</span>
      </div>
      <div className="divide-y" style={{borderColor:"rgba(255,255,255,0.04)"}}>
        {loading&&<div className="px-5 py-6 text-center text-slate-700 text-xs">Cargando…</div>}
        {!loading&&trades.length===0&&<div className="px-5 py-6 text-center text-slate-700 text-xs">No hay operaciones registradas.</div>}
        {!loading&&trades.slice(0,10).map(t=>(
          <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.015] transition-colors">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{background:t.side==="BUY"?"rgba(16,185,129,0.12)":"rgba(249,115,22,0.12)",color:t.side==="BUY"?"#34d399":"#fb923c",border:`1px solid ${t.side==="BUY"?"rgba(16,185,129,0.25)":"rgba(249,115,22,0.25)"}`}}>
              {t.side}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Link href={`/inversiones/${encodeURIComponent(t.symbol)}`} className="text-sm font-bold text-sky-400 hover:text-sky-300">{t.symbol}</Link>
                {t.note&&<span className="text-[10px] text-slate-600 truncate hidden sm:block">{t.note}</span>}
              </div>
              <div className="text-[10px] text-slate-600">{shortDate(t.date)} · {formatQty(t.quantity)} × {formatUsd(t.price)}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs font-bold text-white tabular-nums">{formatUsd(t.total_usd,true)}</div>
              {(t.fee_usd??0)>0&&<div className="text-[10px] text-slate-700">fee {formatUsd(t.fee_usd??0)}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PIE DISTRIBUCIÓN
// ─────────────────────────────────────────────────────────────────────────────

function DistributionChart({positions,pieMode,setPieMode}:{positions:UiPosition[];pieMode:PieMode;setPieMode:(m:PieMode)=>void}){
  const [hoverKey,setHoverKey]=useState<string|null>(null);
  const [pinnedKey,setPinnedKey]=useState<string|null>(null);

  const pieData=useMemo(()=>{
    const list=positions.filter(p=>p.valueNow>0).map(p=>({key:p.symbol,label:p.isCash?(p.brokerName??p.symbol):p.symbol,type:p.type,value:p.valueNow}));
    const total=list.reduce((a,x)=>a+x.value,0);
    if(pieMode==="TIPO"){
      const byType=new Map<string,number>();
      for(const x of list) byType.set(x.type,(byType.get(x.type)??0)+x.value);
      return {total,items:Array.from(byType.entries()).map(([t,v])=>({key:t,label:t,value:v,pct:total>0?(v/total)*100:0})).sort((a,b)=>b.value-a.value),breakdown:[]as{label:string;value:number;pct:number}[]};
    }
    const sorted=[...list].sort((a,b)=>b.value-a.value);
    const top=sorted.slice(0,11),rest=sorted.slice(11);
    const restSum=rest.reduce((a,x)=>a+x.value,0);
    const items=top.map(x=>({key:x.key,label:x.label,value:x.value,pct:total>0?(x.value/total)*100:0}));
    if(restSum>0&&total>0&&(restSum/total)*100>=1) items.push({key:"Otros",label:"Otros",value:restSum,pct:(restSum/total)*100});
    return {total,items,breakdown:rest.map(x=>({label:x.label,value:x.value,pct:total>0?(x.value/total)*100:0})).sort((a,b)=>b.value-a.value)};
  },[positions,pieMode]);

  const displayKey=pinnedKey??hoverKey;
  const displayItem=pieData.items.find(x=>x.key===displayKey)??null;

  return (
    <div className="rounded-2xl overflow-hidden" style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)"}}>
      <div className="flex items-center justify-between gap-3 px-5 py-4" style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div>
          <div className="text-sm font-semibold text-white">Distribución</div>
          <div className="text-[11px] text-slate-600 mt-0.5">{pieMode==="TIPO"?"Por clase":"Por activo"}</div>
        </div>
        <div className="flex rounded-xl p-0.5 gap-0.5" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>
          {(["TIPO","ACTIVO"] as PieMode[]).map(m=>(
            <button key={m} onClick={()=>{setPieMode(m);setPinnedKey(null);setHoverKey(null);}}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
              style={{background:m===pieMode?"rgba(255,255,255,0.1)":"transparent",color:m===pieMode?"white":"rgba(148,163,184,0.55)",border:m===pieMode?"1px solid rgba(255,255,255,0.12)":"1px solid transparent"}}>
              {m==="TIPO"?"Clase":"Activo"}
            </button>
          ))}
        </div>
      </div>
      <div className="px-5 py-4">
        <div className="h-[190px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData.items as any[]} dataKey="value" nameKey="label"
                innerRadius={54} outerRadius={80} paddingAngle={2} strokeWidth={0}
                onMouseEnter={(_,i)=>{if(pinnedKey) return; const it=(pieData.items as any[])[i]; if(it) setHoverKey(String(it.key));}}
                onMouseLeave={()=>{if(!pinnedKey) setHoverKey(null);}}
                onClick={(_,i)=>{const it=(pieData.items as any[])[i]; if(!it) return; const k=String(it.key); setPinnedKey(p=>p===k?null:k);}}>
                {(pieData.items as any[]).map((_:any,i:number)=>(
                  <Cell key={i}
                    fill={pieMode==="TIPO"?(TYPE_COLOR[(pieData.items[i] as any).key]?.color??PIE_COLORS[i]):PIE_COLORS[i%PIE_COLORS.length]}
                    opacity={displayKey?(String((pieData.items[i] as any).key)===displayKey?1:0.3):1}/>
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {displayItem?(
              <div className="text-center px-2">
                <div className="text-xs font-bold text-white">{String((displayItem as any).label)}</div>
                <div className="text-lg font-bold tabular-nums"
                  style={{color:pieMode==="TIPO"?(TYPE_COLOR[(displayItem as any).key]?.color??"#60a5fa"):PIE_COLORS[pieData.items.findIndex((x:any)=>x.key===(displayItem as any).key)%PIE_COLORS.length]}}>
                  {toNum((displayItem as any).pct).toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-500">{formatUsd(toNum((displayItem as any).value),true)}</div>
                {pinnedKey&&<div className="flex items-center justify-center gap-0.5 mt-0.5"><Pin className="w-2 h-2 text-slate-600"/><span className="text-[9px] text-slate-600">fijado</span></div>}
              </div>
            ):(
              <div className="text-center">
                <div className="text-sm font-bold text-white">{formatUsd(pieData.total,true)}</div>
                <div className="text-[10px] text-slate-600">portfolio</div>
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 space-y-0.5 max-h-[200px] overflow-y-auto">
          {(pieData.items as any[]).map((item:any,i:number)=>{
            const color=pieMode==="TIPO"?(TYPE_COLOR[item.key]?.color??PIE_COLORS[i]):PIE_COLORS[i%PIE_COLORS.length];
            const active=displayKey===String(item.key);
            return (
              <button key={item.key} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl transition-all text-left"
                style={{background:active?"rgba(255,255,255,0.06)":"transparent"}}
                onMouseEnter={()=>{if(!pinnedKey) setHoverKey(String(item.key));}}
                onMouseLeave={()=>{if(!pinnedKey) setHoverKey(null);}}
                onClick={()=>setPinnedKey(p=>p===String(item.key)?null:String(item.key))}>
                <div className="w-2 h-2 rounded-full shrink-0" style={{background:color}}/>
                <span className="text-[11px] text-slate-400 flex-1 truncate">{item.label}</span>
                <span className="text-[10px] text-slate-600 tabular-nums">{formatUsd(item.value,true)}</span>
                <span className="text-[10px] font-bold tabular-nums w-10 text-right" style={{color}}>{item.pct.toFixed(1)}%</span>
                {active&&pinnedKey&&<Pin className="w-2 h-2 shrink-0" style={{color,opacity:0.7}}/>}
              </button>
            );
          })}
        </div>
        {displayKey==="Otros"&&pieData.breakdown.length>0&&(
          <div className="mt-3 rounded-xl px-3 py-2.5" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
            <div className="text-[10px] text-slate-600 mb-1.5">{pieData.breakdown.length} activos en "Otros":</div>
            <div className="max-h-[100px] overflow-y-auto space-y-1">
              {pieData.breakdown.map(x=>(
                <div key={x.label} className="flex justify-between text-[10px]">
                  <span className="text-slate-500">{x.label}</span>
                  <span className="text-slate-600 tabular-nums">{formatUsd(x.value,true)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOLTIP del área chart
// ─────────────────────────────────────────────────────────────────────────────

function ChartTooltip({active,payload,label,chartMode}:any){
  if(!active||!payload?.length) return null;
  const vE=payload.find((x:any)=>x?.dataKey==="value");
  const pE=payload.find((x:any)=>x?.dataKey==="performance");
  const row=vE?.payload??pE?.payload??{};
  const val=toNum(vE?.value),perf=toNum(pE?.value),cont=toNum(row?.contributed);
  return (
    <div className="rounded-xl px-3 py-2.5 text-xs shadow-2xl min-w-[160px]" style={{background:"rgba(2,6,23,0.98)",border:"1px solid rgba(255,255,255,0.1)"}}>
      <div className="text-slate-600 mb-2 text-[10px] uppercase tracking-widest">{String(label??"")}</div>
      {(chartMode==="VALOR"||chartMode==="AMBOS")&&<div className="flex justify-between gap-6 mb-0.5"><span className="text-slate-500">Valor</span><span className="font-bold text-sky-300 tabular-nums">{formatUsd(val)}</span></div>}
      {(chartMode==="RENDIMIENTO"||chartMode==="AMBOS")&&<div className="flex justify-between gap-6 mb-0.5"><span className="text-slate-500">Rend.</span><span className={`font-bold tabular-nums ${perf>=0?"text-emerald-400":"text-rose-400"}`}>{formatUsd(perf)}</span></div>}
      <div className="flex justify-between gap-6 mt-1 pt-1" style={{borderTop:"1px solid rgba(255,255,255,0.06)"}}>
        <span className="text-slate-700">Aportes</span><span className="text-slate-600 tabular-nums">{formatUsd(cont)}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function InversionesPage() {
  const [activeTab,   setActiveTab]   = useState<AssetType|"Todas">("Todas");
  const [chartMode,   setChartMode]   = useState<ChartMode>("AMBOS");
  const [pieMode,     setPieMode]     = useState<PieMode>("TIPO");
  const [range,       setRange]       = useState<TimeRange>("TODO");
  const [customFrom,  setCustomFrom]  = useState("");
  const [customTo,    setCustomTo]    = useState(todayIso());
  const [importAIOpen,setImportAIOpen]= useState(false);

  const [snapshotRaw,     setSnapshotRaw]     = useState<SnapshotPosition[]>([]);
  const [history,         setHistory]         = useState<HistoryPoint[]>([]);
  const [quotes,          setQuotes]          = useState<Record<string,number|null>>({});
  const [recentTrades,    setRecentTrades]    = useState<RecentTrade[]>([]);
  const [brokerLiquidity, setBrokerLiquidity] = useState<BrokerLiquidity[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [tradesLoading,   setTradesLoading]   = useState(true);
  const [liquidityLoading,setLiquidityLoading]= useState(true);
  const [err,             setErr]             = useState<string|null>(null);
  const [clearing,        setClearing]        = useState(false);
  const [deletingSymbol,  setDeletingSymbol]  = useState<string|null>(null);
  const [overrides,       setOverrides]       = useState<OverridesMap>({});

  const [editOpen,     setEditOpen]     = useState(false);
  const [editSymbol,   setEditSymbol]   = useState("");
  const [editBuyPrice, setEditBuyPrice] = useState("");
  const [editQty,      setEditQty]      = useState("");
  const [editErr,      setEditErr]      = useState<string|null>(null);

  const [tradeOpen,     setTradeOpen]     = useState(false);
  const [tradeSide,     setTradeSide]     = useState<"BUY"|"SELL">("BUY");
  const [tradeDate,     setTradeDate]     = useState(todayIso());
  const [tradeSymbol,   setTradeSymbol]   = useState("");
  const [tradeQty,      setTradeQty]      = useState("");
  const [tradePrice,    setTradePrice]    = useState("");
  const [tradeTotal,    setTradeTotal]    = useState("");
  const [tradeFee,      setTradeFee]      = useState("0");
  const [tradeRealized, setTradeRealized] = useState("");
  const [tradeNote,     setTradeNote]     = useState("");
  const [tradeSaving,   setTradeSaving]   = useState(false);
  const [tradeErr,      setTradeErr]      = useState<string|null>(null);

  const refreshTimer=useRef<number|null>(null);

  useEffect(()=>{ setOverrides(readOverrides()); },[]);

  useEffect(()=>{
    const q=parseNum(tradeQty),p=parseNum(tradePrice);
    if(Number.isFinite(q)&&Number.isFinite(p)&&q>0&&p>0&&!tradeTotal) setTradeTotal(String(q*p));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tradeQty,tradePrice]);

  async function fetchSnapshot(){ const r=await fetch("/api/investments/snapshot",{cache:"no-store"}); if(!r.ok) throw new Error(`HTTP ${r.status}`); return ((await r.json())?.positions??[]) as SnapshotPosition[]; }
  async function fetchHistory(){  const r=await fetch("/api/investments/history",{cache:"no-store"});  if(!r.ok) throw new Error(`HTTP ${r.status}`); return ((await r.json())?.points??[]) as HistoryPoint[]; }
  async function fetchTrades(){   try{ const r=await fetch("/api/investments/trades?limit=20",{cache:"no-store"}); if(!r.ok) return []; return ((await r.json())?.trades??[]) as RecentTrade[]; }catch{ return []; } }
  async function fetchLiquidity(){
    try{ const r=await fetch("/api/investments/cash-movements",{cache:"no-store"}); if(!r.ok) return []; return ((await r.json())?.liquidity??[]) as BrokerLiquidity[]; }catch{ return []; }
  }

  async function refreshQuotes(symbols:string[]){
    if(!symbols.length) return;
    const uniq=Array.from(new Set(symbols.filter(s=>!s.startsWith("CASH::")).map(s=>s.trim().toUpperCase()).filter(Boolean)));
    const results=await Promise.all(uniq.map(async s=>{ try{ const r=await fetch(`/api/quotes/${encodeURIComponent(s)}`,{cache:"no-store"}); if(!r.ok) return [s,null] as const; const d=await r.json() as QuoteResponse; return [s,typeof d.price==="number"?d.price:null] as const; }catch{ return [s,null] as const; } }));
    setQuotes(prev=>{ const n={...prev}; for(const [s,p] of results) n[s]=p; return n; });
  }

  async function reloadAll(){
    const [snap,hist,trades,liq]=await Promise.all([fetchSnapshot(),fetchHistory(),fetchTrades(),fetchLiquidity()]);
    setSnapshotRaw(snap); setHistory(hist); setRecentTrades(trades); setTradesLoading(false);
    setBrokerLiquidity(liq); setLiquidityLoading(false);
    const syms=snap.map(p=>String(p.symbol||"").toUpperCase()).filter(s=>!s.startsWith("CASH::"));
    await refreshQuotes(syms);
    if(refreshTimer.current) window.clearInterval(refreshTimer.current);
    refreshTimer.current=window.setInterval(()=>refreshQuotes(syms),60_000);
  }

  useEffect(()=>{
    let c=false;
    (async()=>{ try{ setLoading(true); setErr(null); await reloadAll(); if(!c) setLoading(false); }catch(e:any){ if(!c){ setErr(e?.message??"Error"); setLoading(false); } } })();
    return ()=>{ c=true; if(refreshTimer.current) window.clearInterval(refreshTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  async function handleClear(){
    if(!window.confirm("Esto va a eliminar TODAS tus operaciones.\n\n¿Continuar?")) return;
    try{ setClearing(true); const r=await fetch("/api/investments/clear",{method:"DELETE"}); const b=await r.json().catch(()=>({})); if(!r.ok) throw new Error(b?.error??`Error ${r.status}`); setSnapshotRaw([]); setHistory([]); setQuotes({}); setRecentTrades([]); setBrokerLiquidity([]); await reloadAll(); }catch(e:any){ alert(e?.message); }finally{ setClearing(false); }
  }
  async function handleDeleteSymbol(symbol:string){
    if(!window.confirm(`Eliminar todas las ops de "${symbol}".\n\n¿Continuar?`)) return;
    try{ setDeletingSymbol(symbol); const r=await fetch(`/api/investments/positions/${encodeURIComponent(symbol)}`,{method:"DELETE"}); const b=await r.json().catch(()=>({})); if(!r.ok) throw new Error(b?.error??`Error ${r.status}`); await reloadAll(); }catch(e:any){ alert(e?.message); }finally{ setDeletingSymbol(null); }
  }
  function openEdit(p:UiPosition){ setEditErr(null); setEditSymbol(p.symbol); const ov=overrides[p.symbol]; setEditBuyPrice(String(typeof ov?.buyPrice==="number"?ov.buyPrice:p.buyPrice)); setEditQty(String(typeof ov?.quantity==="number"?ov.quantity:p.quantity)); setEditOpen(true); }
  function saveEdit(){ setEditErr(null); const sym=editSymbol.trim().toUpperCase(); const buy=parseNum(editBuyPrice),qty=parseNum(editQty); if(!Number.isFinite(buy)||buy<=0){ setEditErr("Precio inválido."); return; } if(!Number.isFinite(qty)||qty<0){ setEditErr("Cantidad inválida."); return; } const next={...overrides,[sym]:{symbol:sym,buyPrice:buy,quantity:qty,updatedAt:new Date().toISOString()}}; setOverrides(next); writeOverrides(next); setEditOpen(false); }
  function clearOverride(sym:string){ const next={...overrides}; delete next[sym.toUpperCase()]; setOverrides(next); writeOverrides(next); }
  function openTrade(side:"BUY"|"SELL"){ setTradeErr(null); setTradeSide(side); setTradeDate(todayIso()); setTradeSymbol(""); setTradeQty(""); setTradePrice(""); setTradeTotal(""); setTradeFee("0"); setTradeRealized(""); setTradeNote(""); setTradeOpen(true); }
  async function saveTrade(){
    try{ setTradeSaving(true); setTradeErr(null); const sym=tradeSymbol.trim().toUpperCase(); if(!sym) throw new Error("Símbolo inválido."); const qty=parseNum(tradeQty),price=parseNum(tradePrice),total=tradeTotal?parseNum(tradeTotal):NaN,fee=tradeFee?parseNum(tradeFee):0; if(!Number.isFinite(qty)||qty<=0) throw new Error("Cantidad inválida."); if(!Number.isFinite(price)||price<=0) throw new Error("Precio inválido."); const totalUsd=Number.isFinite(total)&&total>0?total:qty*price; const payload:any={date:tradeDate,symbol:sym,side:tradeSide,quantity:qty,price,total_usd:totalUsd,fee_usd:Number.isFinite(fee)?fee:0,note:tradeNote.trim()||null}; if(tradeSide==="SELL"&&tradeRealized.trim()){ const rz=parseNum(tradeRealized); if(!Number.isFinite(rz)) throw new Error("Ganancia realizada inválida."); payload.realized_pnl_usd=rz; } const r=await fetch("/api/investments/trades",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}); const b=await r.json().catch(()=>({})); if(!r.ok) throw new Error(b?.error??`Error ${r.status}`); setTradeOpen(false); await reloadAll(); setActiveTab("Todas"); }catch(e:any){ setTradeErr(e?.message); }finally{ setTradeSaving(false); }
  }

  const positions:UiPosition[]=useMemo(()=>(snapshotRaw.flatMap(p=>{
    const sym=String(p.symbol||"").trim().toUpperCase();
    if(!sym) return [];
    const isCash=!!(p as any).isCash||sym.startsWith("CASH::");
    if(isCash){
      const val=toNum((p as any).currentValue??p.quantity);
      return [{symbol:sym,type:"Cash" as AssetType,quantity:toNum(p.quantity),buyPrice:1,currentPrice:1 as number|null,invested:Math.max(0,val),valueNow:val,pnl:0,pnlPct:0,isCash:true,brokerName:(p as any).brokerName} as UiPosition];
    }
    const ov=overrides[sym];
    const qty=typeof ov?.quantity==="number"?ov.quantity:toNum(p.quantity);
    const buy=typeof ov?.buyPrice==="number"?ov.buyPrice:toNum(p.buyPrice);
    const live=quotes[sym];
    const cur:number|null=typeof live==="number"?live:null;
    const inv=qty*buy,val=qty*(cur??0),pnl=val-inv;
    return [{symbol:sym,type:inferType(sym),quantity:qty,buyPrice:buy,currentPrice:cur,invested:inv,valueNow:val,pnl,pnlPct:inv>0?(pnl/inv)*100:0,isCash:false,brokerName:undefined} as UiPosition];
  }) as UiPosition[]),[snapshotRaw,quotes,overrides]);

  const filteredPositions=useMemo(()=>activeTab==="Todas"?positions:positions.filter(p=>p.type===activeTab),[positions,activeTab]);

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis=useMemo(()=>{
    const invPos=positions.filter(p=>!p.isCash);
    const tv=invPos.reduce((a,p)=>a+p.valueNow,0);
    const ti=invPos.reduce((a,p)=>a+p.invested,0);
    const tp=tv-ti;
    const wins=invPos.filter(p=>p.pnl>0);
    const losses=invPos.filter(p=>p.pnl<0);
    return {
      totalValue:tv,totalInvested:ti,totalPnl:tp,
      totalPct:ti>0?(tp/ti)*100:0,
      gains:wins.reduce((a,p)=>a+p.pnl,0),
      losses:Math.abs(losses.reduce((a,p)=>a+p.pnl,0)),
      winCount:wins.length, lossCount:losses.length,
      count:invPos.length,
    };
  },[positions]);

  const totalLiquidity=useMemo(()=>brokerLiquidity.reduce((a,b)=>a+toNum(b.liquidity_usd),0),[brokerLiquidity]);

  const filteredHistory=useMemo(()=>{
    const pts=[...(history??[])].sort((a,b)=>a.date<b.date?-1:1);
    if(!pts.length) return pts;
    if(range==="CUSTOM"&&customFrom&&customTo) return pts.filter(p=>p.date>=customFrom&&p.date<=customTo);
    const counts:Record<string,number>={"1M":2,"3M":4,"6M":7,"1Y":13,"TODO":pts.length};
    const take=counts[range]??pts.length;
    return pts.length<=take?pts:pts.slice(pts.length-take);
  },[history,range,customFrom,customTo]);

  const chartData=useMemo(()=>filteredHistory.map(p=>({...p,month:monthLabel(p.date)})),[filteredHistory]);

  const periodPerf=useMemo(()=>{
    if(filteredHistory.length<2) return {pnl:0,pct:0,contributions:0};
    const first=filteredHistory[0],last=filteredHistory[filteredHistory.length-1];
    const vd=toNum(last.value)-toNum(first.value),cd=toNum(last.contributed)-toNum(first.contributed),pnl=vd-cd,base=toNum(first.value)+cd;
    return {pnl,pct:base>0?(pnl/base)*100:0,contributions:cd};
  },[filteredHistory]);

  // ── Total portfolio (incluye cash) ─────────────────────────────────────────
  const totalWithCash=useMemo(()=>positions.reduce((a,p)=>a+p.valueNow,0),[positions]);

  // ── Porcentaje de allocation por posición ──────────────────────────────────
  const allocationPct=useMemo(()=>{
    const total=totalWithCash||1;
    return Object.fromEntries(positions.map(p=>[p.symbol,p.valueNow/total*100]));
  },[positions,totalWithCash]);

  return (
    <div className="px-4 md:px-6 py-5 md:py-6 space-y-5 max-w-screen-xl mx-auto">

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight">Inversiones</h1>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-slate-700"
              style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>
              <RefreshCw className="w-2.5 h-2.5"/> Live · 60s
            </div>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">Portfolio personal · precios en tiempo real</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={()=>openTrade("BUY")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white"
            style={{background:"linear-gradient(135deg,#0d9488,#2563eb)",boxShadow:"0 4px 18px rgba(13,148,136,0.22)"}}>
            <Plus className="w-3.5 h-3.5"/> Compra
          </button>
          <button onClick={()=>openTrade("SELL")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold"
            style={{background:"rgba(249,115,22,0.1)",border:"1px solid rgba(249,115,22,0.22)",color:"#fb923c"}}>
            <Minus className="w-3.5 h-3.5"/> Venta
          </button>
        </div>
      </div>

      {/* ── BANNER IMPORT IA ────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)"}}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{background:"linear-gradient(135deg,rgba(13,148,136,0.2),rgba(99,102,241,0.2))",border:"1px solid rgba(99,102,241,0.25)"}}>
              <Sparkles className="w-5 h-5 text-indigo-400"/>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">Importar con IA</div>
              <div className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1"><FileText className="w-3 h-3 text-rose-400"/> PDF</span>
                <span className="text-slate-700">·</span>
                <span className="flex items-center gap-1"><Image className="w-3 h-3 text-sky-400"/> Foto</span>
                <span className="text-slate-700">·</span>
                <span className="flex items-center gap-1"><Upload className="w-3 h-3 text-emerald-400"/> CSV</span>
                <span className="text-slate-700">·</span>
                <span className="text-slate-600">Detecta el broker y extrae todas las operaciones automáticamente</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button onClick={handleClear} disabled={clearing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium disabled:opacity-50"
              style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.17)",color:"#f87171"}}>
              <Trash2 className="w-3 h-3"/> {clearing?"Limpiando…":"Limpiar todo"}
            </button>
            <button onClick={()=>setImportAIOpen(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[11px] font-bold text-white transition-all"
              style={{background:"linear-gradient(135deg,rgba(13,148,136,0.8),rgba(99,102,241,0.8))",border:"1px solid rgba(99,102,241,0.3)",boxShadow:"0 2px 12px rgba(99,102,241,0.2)"}}>
              <Sparkles className="w-3 h-3"/> Importar con IA
            </button>
          </div>
        </div>
      </div>

      {err&&<div className="rounded-xl px-4 py-3 text-xs text-rose-300" style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)"}}>{err}</div>}

      {/* ── KPIs — 5 cards rediseñadas ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">

        {/* Portfolio */}
        <KpiCard
          label="Portfolio total"
          value={formatUsd(totalWithCash,true)}
          sub={`Invertido: ${formatUsd(kpis.totalInvested,true)}`}
          icon={Wallet} iconColor="#60a5fa" iconBg="rgba(96,165,250,0.1)" iconBorder="rgba(96,165,250,0.2)"
          accent="rgba(96,165,250,0.6)"
          progress={kpis.totalInvested>0?(kpis.totalValue/Math.max(kpis.totalValue,kpis.totalInvested))*100:0}
        />

        {/* G/P total */}
        <div className="rounded-2xl p-4 flex flex-col gap-2.5 relative overflow-hidden"
          style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)"}}>
          <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full blur-2xl pointer-events-none"
            style={{background:kpis.totalPnl>=0?"rgba(52,211,153,0.4)":"rgba(248,113,113,0.4)",opacity:0.2}}/>
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">G/P total</span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{background:kpis.totalPnl>=0?"rgba(52,211,153,0.1)":"rgba(248,113,113,0.1)",border:`1px solid ${kpis.totalPnl>=0?"rgba(52,211,153,0.2)":"rgba(248,113,113,0.2)"}`}}>
              {kpis.totalPnl>=0?<TrendingUp className="w-3.5 h-3.5 text-emerald-400"/>:<TrendingDown className="w-3.5 h-3.5 text-rose-400"/>}
            </div>
          </div>
          <div className="relative z-10">
            <PnlBadge value={kpis.totalPnl} pct={kpis.totalPct}/>
          </div>
          <div className="relative z-10 rounded-xl px-2.5 py-2" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.05)"}}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-slate-700">Período</span>
              <RangePills value={range} onChange={setRange} showCustom/>
            </div>
            <PnlBadge value={periodPerf.pnl} pct={periodPerf.pct} compact/>
          </div>
        </div>

        {/* Wins / Losses */}
        <div className="rounded-2xl p-4 flex flex-col gap-2.5 relative overflow-hidden"
          style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)"}}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Posiciones</span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{background:"rgba(148,163,184,0.07)",border:"1px solid rgba(148,163,184,0.14)"}}>
              <Activity className="w-3.5 h-3.5 text-slate-400"/>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 shrink-0"/>
                <span className="text-[11px] text-slate-500">{kpis.winCount} ganadoras</span>
              </div>
              <span className="text-sm font-bold text-emerald-400 tabular-nums">{formatUsd(kpis.gains,true)}</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.06)"}}>
              <div className="h-full rounded-full" style={{width:`${kpis.winCount+kpis.lossCount>0?(kpis.winCount/(kpis.winCount+kpis.lossCount))*100:0}%`,background:"rgba(52,211,153,0.5)"}}/>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ArrowDownRight className="w-3.5 h-3.5 text-rose-400 shrink-0"/>
                <span className="text-[11px] text-slate-500">{kpis.lossCount} perdedoras</span>
              </div>
              <span className="text-sm font-bold text-rose-400 tabular-nums">{formatUsd(kpis.losses,true)}</span>
            </div>
          </div>
        </div>

        {/* Activos */}
        <KpiCard
          label="Activos"
          value={<span className="text-3xl">{kpis.count}</span>}
          sub="posiciones abiertas"
          icon={Hash} iconColor="#94a3b8" iconBg="rgba(148,163,184,0.07)" iconBorder="rgba(148,163,184,0.14)"
          accent="rgba(148,163,184,0.4)"
        />

        {/* Liquidez */}
        <div className={`rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden xl:col-span-1 col-span-2`}
          style={{
            background:totalLiquidity>=0?"rgba(34,211,238,0.05)":"rgba(248,113,113,0.05)",
            border:`1px solid ${totalLiquidity>=0?"rgba(34,211,238,0.2)":"rgba(248,113,113,0.2)"}`,
          }}>
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl pointer-events-none"
            style={{background:totalLiquidity>=0?"rgba(34,211,238,0.5)":"rgba(248,113,113,0.5)",opacity:0.15}}/>
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Liquidez</span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{background:totalLiquidity>=0?"rgba(34,211,238,0.1)":"rgba(248,113,113,0.1)",border:`1px solid ${totalLiquidity>=0?"rgba(34,211,238,0.2)":"rgba(248,113,113,0.2)"}`}}>
              <DollarSign className="w-3.5 h-3.5" style={{color:totalLiquidity>=0?"#22d3ee":"#f87171"}}/>
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-xl font-bold tabular-nums leading-none"
              style={{color:totalLiquidity>=0?"#22d3ee":"#f87171"}}>
              {liquidityLoading?"…":formatUsd(totalLiquidity,true)}
            </div>
            <div className="text-[11px] text-slate-600 mt-1">
              {brokerLiquidity.length>0?`${brokerLiquidity.length} broker${brokerLiquidity.length>1?"s":""} · cash disponible`:"Sin brokers vinculados"}
            </div>
          </div>
          {brokerLiquidity.length>0&&(
            <div className="relative z-10 h-0.5 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.06)"}}>
              <div className="h-full rounded-full" style={{width:"100%",background:totalLiquidity>=0?"rgba(34,211,238,0.5)":"rgba(248,113,113,0.5)"}}/>
            </div>
          )}
        </div>
      </div>

      {/* CUSTOM RANGE */}
      {range==="CUSTOM"&&(
        <div className="flex flex-wrap items-end gap-3 rounded-2xl px-4 py-3"
          style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.18)"}}>
          <Calendar className="w-4 h-4 text-indigo-400 shrink-0 self-center"/>
          <div>
            <div className="text-[10px] text-slate-600 mb-1 uppercase tracking-wider">Desde</div>
            <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} className="rounded-xl px-3 py-1.5 text-xs text-white outline-none" style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)"}}/>
          </div>
          <div>
            <div className="text-[10px] text-slate-600 mb-1 uppercase tracking-wider">Hasta</div>
            <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)} className="rounded-xl px-3 py-1.5 text-xs text-white outline-none" style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)"}}/>
          </div>
          <div className="text-[11px] text-indigo-400 self-end pb-1.5">{filteredHistory.length} punto{filteredHistory.length!==1?"s":""} en rango</div>
        </div>
      )}

      {/* ── GRÁFICOS ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Área chart — rediseñado */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)"}}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 px-5 pt-4 pb-3" style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
            <div>
              <div className="text-sm font-semibold text-white">Evolución del portfolio</div>
              {/* Stat inline del período visible */}
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {(chartMode==="VALOR"||chartMode==="AMBOS")&&(
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{background:"#60A5FA"}}/>
                    <span className="text-[11px] text-slate-500">Valor</span>
                    {chartData.length>0&&<span className="text-[11px] font-semibold text-white tabular-nums">{formatUsd(toNum(chartData[chartData.length-1]?.value),true)}</span>}
                  </div>
                )}
                {(chartMode==="RENDIMIENTO"||chartMode==="AMBOS")&&(
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{background:"#34D399"}}/>
                    <span className="text-[11px] text-slate-500">Rend.</span>
                    {chartData.length>0&&<span className={`text-[11px] font-semibold tabular-nums ${toNum(chartData[chartData.length-1]?.performance)>=0?"text-emerald-400":"text-rose-400"}`}>{formatUsd(toNum(chartData[chartData.length-1]?.performance),true)}</span>}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {/* Toggle modo */}
              <div className="flex rounded-xl p-0.5 gap-0.5" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>
                {([["VALOR","Valor"],["RENDIMIENTO","Rend."],["AMBOS","Ambos"]] as [ChartMode,string][]).map(([m,label])=>(
                  <button key={m} onClick={()=>setChartMode(m)} className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                    style={{background:m===chartMode?"rgba(255,255,255,0.1)":"transparent",color:m===chartMode?"white":"rgba(148,163,184,0.55)",border:m===chartMode?"1px solid rgba(255,255,255,0.12)":"1px solid transparent"}}>
                    {label}
                  </button>
                ))}
              </div>
              <RangePills value={range} onChange={setRange} showCustom/>
            </div>
          </div>
          <div className="px-2 py-4 h-[240px] sm:h-[280px]">
            {chartData.length===0?(
              <div className="h-full flex items-center justify-center text-slate-700 text-xs">Sin datos de historial.</div>
            ):(
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{top:8,right:8,left:0,bottom:0}}>
                  <defs>
                    <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60A5FA" stopOpacity={0.22}/>
                      <stop offset="60%" stopColor="#60A5FA" stopOpacity={0.06}/>
                      <stop offset="100%" stopColor="#60A5FA" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34D399" stopOpacity={0.18}/>
                      <stop offset="60%" stopColor="#34D399" stopOpacity={0.04}/>
                      <stop offset="100%" stopColor="#34D399" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.035)" vertical={false} strokeDasharray="3 6"/>
                  <XAxis dataKey="month" tick={{fill:"#475569",fontSize:10}} axisLine={false} tickLine={false} dy={6}/>
                  <YAxis tick={{fill:"#475569",fontSize:10}} axisLine={false} tickLine={false} width={58}
                    tickFormatter={v=>`$${Math.abs(v)>=1_000_000?(v/1_000_000).toFixed(1)+"M":Math.abs(v)>=1000?(v/1000).toFixed(0)+"k":v.toFixed(0)}`}/>
                  <RechartsTooltip wrapperStyle={{zIndex:80}} isAnimationActive={false}
                    cursor={{stroke:"rgba(255,255,255,0.08)",strokeWidth:1,strokeDasharray:"4 4"}}
                    content={(p:any)=><ChartTooltip {...p} chartMode={chartMode}/>}/>
                  {(chartMode==="VALOR"||chartMode==="AMBOS")&&(
                    <Area type="monotone" dataKey="value" stroke="#60A5FA" strokeWidth={2}
                      fill="url(#gV)" dot={false} activeDot={{r:4,fill:"#60A5FA",strokeWidth:0}} isAnimationActive={false}/>
                  )}
                  {(chartMode==="RENDIMIENTO"||chartMode==="AMBOS")&&(
                    <Area type="monotone" dataKey="performance" stroke="#34D399" strokeWidth={2}
                      fill="url(#gP)" dot={false} activeDot={{r:4,fill:"#34D399",strokeWidth:0}} isAnimationActive={false}/>
                  )}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <DistributionChart positions={positions} pieMode={pieMode} setPieMode={setPieMode}/>
      </div>

      {/* ── POSICIONES ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{border:"1px solid rgba(255,255,255,0.07)"}}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4" style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(255,255,255,0.02)"}}>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white">Posiciones</div>
            <div className="text-[11px] text-slate-600 mt-0.5">{filteredPositions.length} activo{filteredPositions.length!==1?"s":""} · precios live</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={()=>setImportAIOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.25)",color:"#818cf8"}}>
              <Sparkles className="w-3 h-3"/> Importar
            </button>
            <button onClick={()=>openTrade("BUY")} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold" style={{background:"rgba(16,185,129,0.09)",border:"1px solid rgba(16,185,129,0.2)",color:"#34d399"}}><Plus className="w-3 h-3"/> Compra</button>
            <button onClick={()=>openTrade("SELL")} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold" style={{background:"rgba(249,115,22,0.09)",border:"1px solid rgba(249,115,22,0.2)",color:"#fb923c"}}><Minus className="w-3 h-3"/> Venta</button>
          </div>
        </div>

        {/* Tabs por tipo */}
        <div className="flex flex-wrap gap-1.5 px-5 py-3" style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          {(["Todas","Acción","ETFs","Cripto","Metales","Bonos","Cash"] as (AssetType|"Todas")[]).map(t=>{
            const cfg=TYPE_COLOR[t]??TYPE_COLOR["Todas"];
            const count=t==="Todas"?positions.length:positions.filter(p=>p.type===t).length;
            if(t!=="Todas"&&count===0) return null;
            return (
              <button key={t} onClick={()=>setActiveTab(t)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                style={{background:activeTab===t?cfg.bg:"rgba(255,255,255,0.02)",border:activeTab===t?`1px solid ${cfg.border}`:"1px solid rgba(255,255,255,0.05)",color:activeTab===t?cfg.color:"#4b5563"}}>
                {t==="Acción"?"Acciones":t}
                <span className="text-[9px] px-1 rounded-full" style={{background:activeTab===t?cfg.border:"rgba(255,255,255,0.05)",color:activeTab===t?cfg.color:"#4b5563"}}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Móvil */}
        <div className="block lg:hidden p-3 space-y-2">
          {loading&&<div className="py-8 text-center text-slate-700 text-xs">Cargando…</div>}
          {!loading&&filteredPositions.length===0&&(
            <div className="py-10 text-center space-y-3">
              <div className="text-slate-700 text-xs">No hay posiciones.</div>
              <button onClick={()=>setImportAIOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white"
                style={{background:"linear-gradient(135deg,rgba(13,148,136,0.8),rgba(99,102,241,0.8))"}}>
                <Sparkles className="w-3.5 h-3.5"/> Importar con IA
              </button>
            </div>
          )}
          {!loading&&filteredPositions.map(p=>(
            <PositionCard key={p.symbol} p={p} hasOverride={!!overrides[p.symbol]} isDeleting={deletingSymbol===p.symbol} onEdit={()=>openEdit(p)} onDelete={()=>handleDeleteSymbol(p.symbol)}/>
          ))}
        </div>

        {/* Desktop — tabla mejorada */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-xs" style={{minWidth:1020}}>
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-slate-700" style={{background:"rgba(255,255,255,0.015)",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                <th className="px-4 py-2.5 text-left">Símbolo</th>
                <th className="px-4 py-2.5 text-left">Clase</th>
                <th className="px-4 py-2.5 text-right">Cantidad</th>
                <th className="px-4 py-2.5 text-right">P. compra</th>
                <th className="px-4 py-2.5 text-right">P. actual</th>
                <th className="px-4 py-2.5 text-right">Invertido</th>
                <th className="px-4 py-2.5 text-right">Valor actual</th>
                <th className="px-4 py-2.5 text-right">G/P</th>
                <th className="px-4 py-2.5 text-right">% Rent.</th>
                <th className="px-4 py-2.5 text-right" style={{minWidth:100}}>Allocación</th>
                <th className="px-4 py-2.5"/>
              </tr>
            </thead>
            <tbody className="divide-y" style={{borderColor:"rgba(255,255,255,0.04)"}}>
              {loading&&<tr><td colSpan={11} className="px-4 py-8 text-center text-slate-700">Cargando…</td></tr>}
              {!loading&&filteredPositions.length===0&&(
                <tr><td colSpan={11} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-slate-700 text-xs">No hay posiciones para mostrar.</div>
                    <button onClick={()=>setImportAIOpen(true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white"
                      style={{background:"linear-gradient(135deg,rgba(13,148,136,0.8),rgba(99,102,241,0.8))"}}>
                      <Sparkles className="w-3.5 h-3.5"/> Importar con IA
                    </button>
                  </div>
                </td></tr>
              )}
              {!loading&&filteredPositions.map(p=>{
                const isDeleting=deletingSymbol===p.symbol;
                const hasOverride=!!overrides[p.symbol];
                const pct=allocationPct[p.symbol]??0;
                const cfg=TYPE_COLOR[p.type]??TYPE_COLOR["Todas"];
                const isCash=p.isCash;
                return (
                  <tr key={p.symbol} className="group hover:bg-white/[0.014] transition-colors"
                    style={isCash?{background:"rgba(34,211,238,0.018)"}:{}}>
                    {/* Símbolo */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {/* Accent dot */}
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:cfg.color,boxShadow:`0 0 4px ${cfg.color}`}}/>
                        {isCash?(
                          <span className="font-semibold text-cyan-300">{p.brokerName??p.symbol}</span>
                        ):(
                          <Link href={`/inversiones/${encodeURIComponent(p.symbol)}`} className="font-bold text-sky-400 hover:text-sky-300 transition-colors">{p.symbol}</Link>
                        )}
                        {hasOverride&&<span className="text-[9px] px-1 py-0.5 rounded-full" style={{background:"rgba(251,191,36,0.1)",border:"1px solid rgba(251,191,36,0.2)",color:"#fbbf24"}}>edit</span>}
                      </div>
                    </td>
                    {/* Clase */}
                    <td className="px-4 py-2.5"><TypeBadge type={p.type}/></td>
                    {/* Cantidad */}
                    <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">
                      {isCash?"—":formatQty(p.quantity)}
                    </td>
                    {/* P. compra */}
                    <td className="px-4 py-2.5 text-right text-slate-400 tabular-nums">
                      {isCash?"—":formatUsd(p.buyPrice)}
                    </td>
                    {/* P. actual */}
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {isCash?<span className="text-cyan-400 text-xs">efectivo</span>:p.currentPrice==null?<span className="text-slate-700">—</span>:<span className="text-white">{formatUsd(p.currentPrice)}</span>}
                    </td>
                    {/* Invertido */}
                    <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">
                      {isCash?"—":formatUsd(p.invested,true)}
                    </td>
                    {/* Valor actual */}
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {isCash?(
                        <span className="font-semibold tabular-nums" style={{color:"#22d3ee"}}>{formatUsd(p.valueNow,true)}</span>
                      ):p.currentPrice==null?<span className="text-slate-700">—</span>:(
                        <span className="text-white font-medium">{formatUsd(p.valueNow,true)}</span>
                      )}
                    </td>
                    {/* G/P */}
                    <td className="px-4 py-2.5 text-right">
                      {isCash?<span className="text-slate-700 text-[11px]">n/a</span>:p.currentPrice==null?<span className="text-slate-700">—</span>:<PnlBadge value={p.pnl} compact/>}
                    </td>
                    {/* % Rent */}
                    <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${!isCash&&p.pnlPct>=0?"text-emerald-400":"text-rose-400"}`}>
                      {isCash?<span className="text-slate-700 text-[11px]">—</span>:p.currentPrice==null?<span className="text-slate-700">—</span>:formatPct(p.pnlPct)}
                    </td>
                    {/* Allocación — mini barra */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-[10px] text-slate-600 tabular-nums w-8 text-right">{pct.toFixed(1)}%</span>
                        <div className="w-16 h-1 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.06)"}}>
                          <div className="h-full rounded-full transition-all"
                            style={{width:`${Math.min(100,pct)}%`,background:cfg.color,opacity:0.7}}/>
                        </div>
                      </div>
                    </td>
                    {/* Acciones */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isCash&&<Link href={`/inversiones/${encodeURIComponent(p.symbol)}`} className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 hover:text-sky-400 hover:bg-sky-400/10 transition-all"><ChevronRight className="w-3 h-3"/></Link>}
                        {!isCash&&<button onClick={()=>openEdit(p)} className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all"><Pencil className="w-3 h-3"/></button>}
                        {!isCash&&<button onClick={()=>handleDeleteSymbol(p.symbol)} disabled={isDeleting} className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 hover:text-rose-400 hover:bg-rose-400/10 transition-all disabled:opacity-40"><Trash2 className="w-3 h-3"/></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer totales de tabla */}
          {!loading&&filteredPositions.length>0&&(
            <div className="flex items-center justify-between px-5 py-3 text-xs"
              style={{borderTop:"1px solid rgba(255,255,255,0.05)",background:"rgba(255,255,255,0.01)"}}>
              <span className="text-slate-600">{filteredPositions.length} posiciones</span>
              <div className="flex items-center gap-6 text-slate-600">
                <span>Invertido: <span className="text-slate-400 font-medium tabular-nums">{formatUsd(filteredPositions.filter(p=>!p.isCash).reduce((a,p)=>a+p.invested,0),true)}</span></span>
                <span>Valor: <span className="text-white font-bold tabular-nums">{formatUsd(filteredPositions.reduce((a,p)=>a+p.valueNow,0),true)}</span></span>
                <span className={filteredPositions.filter(p=>!p.isCash).reduce((a,p)=>a+p.pnl,0)>=0?"text-emerald-400":"text-rose-400"}>
                  G/P: <span className="font-bold tabular-nums">{formatUsd(filteredPositions.filter(p=>!p.isCash).reduce((a,p)=>a+p.pnl,0),true)}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM GRID ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <TypeSummaryPanel positions={positions}/>
        <BrokerLiquidityPanel liquidity={brokerLiquidity} loading={liquidityLoading}/>
        <RecentTrades trades={recentTrades} loading={tradesLoading}/>
      </div>

      {/* ── MODAL EDITAR ─────────────────────────────────────────────────────── */}
      <Modal open={editOpen} title="Editar posición" sub="Corrección local — se guarda en este navegador" onClose={()=>setEditOpen(false)}>
        <div className="space-y-4">
          <MField label="Símbolo"><div className="px-3 py-2 rounded-xl text-sm text-slate-300" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}>{editSymbol}</div></MField>
          <div className="grid grid-cols-2 gap-3">
            <MField label="Precio compra promedio (US$)" hint="Ej: 238,82"><input value={editBuyPrice} onChange={e=>setEditBuyPrice(e.target.value)} placeholder="238.82" style={iStyle}/></MField>
            <MField label="Cantidad" hint="Ej: 1,02736"><input value={editQty} onChange={e=>setEditQty(e.target.value)} placeholder="1.02736" style={iStyle}/></MField>
          </div>
          {editErr&&<div className="text-xs text-rose-400 rounded-xl px-3 py-2" style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)"}}>{editErr}</div>}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button onClick={()=>clearOverride(editSymbol)} className="px-3 py-2 rounded-xl text-xs text-slate-600 hover:text-white transition-colors" style={{border:"1px solid rgba(255,255,255,0.07)"}}>Restaurar import</button>
            <div className="flex gap-2">
              <button onClick={()=>setEditOpen(false)} className="px-3 py-2 rounded-xl text-xs text-slate-500" style={{border:"1px solid rgba(255,255,255,0.08)"}}>Cancelar</button>
              <button onClick={saveEdit} className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{background:"linear-gradient(135deg,#0d9488,#2563eb)"}}>Guardar</button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── MODAL TRADE ──────────────────────────────────────────────────────── */}
      <Modal open={tradeOpen} title={tradeSide==="BUY"?"Registrar compra":"Registrar venta"} sub="Nueva operación manual" onClose={()=>setTradeOpen(false)}>
        <div className="space-y-4">
          <div className="flex rounded-xl p-0.5 gap-0.5 w-fit" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>
            {(["BUY","SELL"] as const).map(s=>(
              <button key={s} onClick={()=>setTradeSide(s)} className="px-5 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{background:s===tradeSide?(s==="BUY"?"rgba(16,185,129,0.15)":"rgba(249,115,22,0.15)"):"transparent",color:s===tradeSide?(s==="BUY"?"#34d399":"#fb923c"):"#64748b",border:s===tradeSide?`1px solid ${s==="BUY"?"rgba(16,185,129,0.3)":"rgba(249,115,22,0.3)"}`:"1px solid transparent"}}>
                {s==="BUY"?"Compra":"Venta"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MField label="Fecha"><input type="date" value={tradeDate} onChange={e=>setTradeDate(e.target.value)} style={iStyle}/></MField>
            <MField label="Símbolo"><input value={tradeSymbol} onChange={e=>setTradeSymbol(e.target.value.toUpperCase())} placeholder="VOO, BTC…" style={iStyle}/></MField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MField label="Cantidad" hint="Acepta coma o punto"><input value={tradeQty} onChange={e=>setTradeQty(e.target.value)} placeholder="0,25" style={iStyle}/></MField>
            <MField label="Precio (US$)"><input value={tradePrice} onChange={e=>setTradePrice(e.target.value)} placeholder="244,41" style={iStyle}/></MField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MField label="Total USD" hint="Vacío = qty × precio"><input value={tradeTotal} onChange={e=>setTradeTotal(e.target.value)} placeholder="Auto" style={iStyle}/></MField>
            <MField label="Comisión (US$)"><input value={tradeFee} onChange={e=>setTradeFee(e.target.value)} placeholder="0" style={iStyle}/></MField>
          </div>
          {tradeSide==="SELL"&&(
            <MField label="Ganancia realizada (opcional)" hint="Vacío = se calcula."><input value={tradeRealized} onChange={e=>setTradeRealized(e.target.value)} placeholder="37,70" style={iStyle}/></MField>
          )}
          <MField label="Nota (opcional)"><input value={tradeNote} onChange={e=>setTradeNote(e.target.value)} placeholder="Compra agosto / Venta parcial" style={iStyle}/></MField>
          {tradeErr&&<div className="text-xs text-rose-400 rounded-xl px-3 py-2" style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)"}}>{tradeErr}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={()=>setTradeOpen(false)} disabled={tradeSaving} className="px-3 py-2 rounded-xl text-xs text-slate-500" style={{border:"1px solid rgba(255,255,255,0.08)"}}>Cancelar</button>
            <button onClick={saveTrade} disabled={tradeSaving} className="px-5 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-60"
              style={{background:tradeSide==="BUY"?"linear-gradient(135deg,#0d9488,#2563eb)":"linear-gradient(135deg,#f97316,#ef4444)"}}>
              {tradeSaving?"Guardando…":tradeSide==="BUY"?"Registrar compra":"Registrar venta"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL IMPORT IA ──────────────────────────────────────────────────── */}
      <ImportInvestmentsAI
        open={importAIOpen}
        onClose={()=>setImportAIOpen(false)}
        onImported={async()=>{ setImportAIOpen(false); await reloadAll(); }}
      />
    </div>
  );
}
