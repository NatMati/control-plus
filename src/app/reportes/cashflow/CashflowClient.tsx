"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank,
  RefreshCw, ChevronLeft, ChevronRight, Calendar,
} from "lucide-react";
import { useAchievements } from "@/context/AchievementsContext";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

// ─── TIPOS ────────────────────────────────────────────────────────────────────
type Props = { from: string; to: string };
type Movement = {
  date: string; type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number; category: string | null;
};
type SankeyData = {
  labels: string[]; source: number[]; target: number[]; value: number[];
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function pad2(n: number) { return n.toString().padStart(2, "0"); }
function parseYM(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return { y: y || new Date().getFullYear(), m: m || new Date().getMonth() + 1 };
}
function toYM(y: number, m: number) { return `${y}-${pad2(m)}`; }
function addMonths(ym: string, delta: number): string {
  let { y, m } = parseYM(ym);
  m += delta;
  while (m > 12) { m -= 12; y++; }
  while (m < 1)  { m += 12; y--; }
  return toYM(y, m);
}
function ymCompare(a: string, b: string) { return a < b ? -1 : a > b ? 1 : 0; }
function fmtMoney(n: number) {
  const abs = Math.abs(n), sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs/1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs/1_000).toFixed(1)}k`;
  return `${sign}$${abs.toLocaleString("es-UY",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}
function ymLabel(ym: string) {
  const { y, m } = parseYM(ym);
  return `${MONTHS_ES[m-1]} ${y}`;
}
function ymRange(from: string, to: string): string[] {
  const result: string[] = [];
  let cur = from;
  while (ymCompare(cur, to) <= 0) {
    result.push(cur); cur = addMonths(cur, 1);
    if (result.length > 60) break;
  }
  return result;
}
function getPresets(): { label: string; from: string; to: string }[] {
  const now = new Date();
  const cur = toYM(now.getFullYear(), now.getMonth() + 1);
  return [
    { label: "Este mes",     from: cur,                to: cur },
    { label: "Últ. 3 meses", from: addMonths(cur, -2), to: cur },
    { label: "Últ. 6 meses", from: addMonths(cur, -5), to: cur },
    { label: "Este año",     from: toYM(now.getFullYear(), 1), to: cur },
    { label: "Últ. 12 m",   from: addMonths(cur, -11), to: cur },
  ];
}

// ─── DATE-RANGE PICKER ────────────────────────────────────────────────────────
function MonthPicker({ from, to, onChange }: {
  from: string; to: string;
  onChange: (from: string, to: string) => void;
}) {
  const now = new Date();
  const curYM = toYM(now.getFullYear(), now.getMonth() + 1);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [selecting, setSelecting] = useState<"from"|"to">("from");
  const [hover, setHover] = useState<string|null>(null);

  function handleCell(ym: string) {
    if (selecting === "from") {
      onChange(ym, ymCompare(ym, to) > 0 ? ym : to);
      setSelecting("to");
    } else {
      onChange(ymCompare(ym, from) < 0 ? ym : from, ymCompare(ym, from) < 0 ? from : ym);
      setSelecting("from");
    }
  }

  function cellState(ym: string) {
    if (ym === from && ym === to) return "single";
    if (ym === from) return "start";
    if (ym === to)   return "end";
    if (hover && selecting === "to") {
      const rangeEnd = ymCompare(hover, from) >= 0 ? hover : from;
      if (ymCompare(ym, from) > 0 && ymCompare(ym, rangeEnd) < 0) return "hover";
    }
    if (ymCompare(ym, from) > 0 && ymCompare(ym, to) < 0) return "range";
    return "none";
  }

  return (
    <div className="select-none" style={{minWidth:268}}>
      <div className="flex items-center justify-between mb-3">
        <button onClick={()=>setViewYear(y=>y-1)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-all">
          <ChevronLeft className="w-3.5 h-3.5"/>
        </button>
        <span className="text-xs font-bold text-white">{viewYear}</span>
        <button onClick={()=>setViewYear(y=>y+1)} disabled={viewYear >= now.getFullYear()}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-all disabled:opacity-25">
          <ChevronRight className="w-3.5 h-3.5"/>
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {MONTHS_ES.map((label, i) => {
          const ym = toYM(viewYear, i+1);
          const isFuture = ymCompare(ym, curYM) > 0;
          const s = cellState(ym);
          const isEndpoint = s === "start" || s === "end" || s === "single";
          const isMid = s === "range" || s === "hover";
          return (
            <button key={ym} disabled={isFuture}
              onClick={()=>!isFuture&&handleCell(ym)}
              onMouseEnter={()=>setHover(ym)} onMouseLeave={()=>setHover(null)}
              className="h-8 rounded-lg text-[11px] font-medium transition-all"
              style={{
                opacity: isFuture ? 0.2 : 1,
                cursor: isFuture ? "default" : "pointer",
                background: isEndpoint ? "linear-gradient(135deg,#0d9488,#2563eb)" : isMid ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
                color: isEndpoint ? "white" : isMid ? "#a5b4fc" : "rgba(148,163,184,0.8)",
                border: isEndpoint ? "1px solid transparent" : isMid ? "1px solid rgba(99,102,241,0.25)" : "1px solid rgba(255,255,255,0.06)",
                fontWeight: isEndpoint ? 700 : 500,
              }}>
              {label}
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 text-[10px] text-slate-600 text-center">
        {selecting==="from" ? "Elegí el mes de inicio" : "Ahora el mes de fin"}
      </div>
    </div>
  );
}

// ─── ATOMS ────────────────────────────────────────────────────────────────────
function Pill({ active, onClick, children }: { active: boolean; onClick: ()=>void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
      style={{
        background: active ? "rgba(255,255,255,0.1)" : "transparent",
        color: active ? "white" : "rgba(148,163,184,0.6)",
        border: active ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent",
      }}>
      {children}
    </button>
  );
}
function PillGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex rounded-xl p-0.5 gap-0.5"
      style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>
      {children}
    </div>
  );
}
function KpiCard({ label, value, sub, icon, color, glow }: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; color: string; glow: string;
}) {
  return (
    <div className="relative rounded-2xl p-4 overflow-hidden flex flex-col gap-2"
      style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)"}}>
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl pointer-events-none"
        style={{background:glow,opacity:0.2}}/>
      <div className="relative z-10 flex items-center justify-between">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{background:`${color}15`,border:`1px solid ${color}30`}}>
          {icon}
        </div>
      </div>
      <div className="relative z-10">
        <div className="text-xl font-bold text-white tabular-nums leading-none">{value}</div>
        {sub&&<div className="text-[11px] text-slate-600 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

// ─── BAR CHART SVG ────────────────────────────────────────────────────────────
function BarChart({ months, incomeByMonth, expenseByMonth }: {
  months: string[]; incomeByMonth: Record<string,number>; expenseByMonth: Record<string,number>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [tooltip, setTooltip] = useState<{x:number;ym:string}|null>(null);
  useEffect(()=>{
    if(!containerRef.current) return;
    const ro = new ResizeObserver(([e])=>setWidth(e.contentRect.width));
    ro.observe(containerRef.current);
    return ()=>ro.disconnect();
  },[]);
  const H=200,PL=52,PR=16,PT=12,PB=28,iW=width-PL-PR,iH=H-PT-PB;
  const maxVal=Math.max(...months.map(m=>Math.max(incomeByMonth[m]??0,expenseByMonth[m]??0)),1);
  const barW=Math.max(4,Math.min(28,(iW/Math.max(months.length,1))*0.35));
  const step=iW/Math.max(months.length,1);
  const ticks=[0,0.25,0.5,0.75,1].map(f=>f*maxVal);
  return (
    <div ref={containerRef} className="relative w-full" style={{height:H}}>
      <svg width={width} height={H}>
        {ticks.map((t,i)=>{
          const y=PT+iH-(t/maxVal)*iH;
          return <g key={i}>
            <line x1={PL} y1={y} x2={width-PR} y2={y} stroke="rgba(255,255,255,0.04)" strokeDasharray="4 6"/>
            <text x={PL-6} y={y} textAnchor="end" dominantBaseline="middle" fill="#475569" fontSize={9}>{fmtMoney(t)}</text>
          </g>;
        })}
        {months.map((ym,i)=>{
          const cx=PL+i*step+step/2;
          const inc=incomeByMonth[ym]??0, exp=expenseByMonth[ym]??0;
          const hInc=(inc/maxVal)*iH, hExp=(exp/maxVal)*iH;
          const hov=tooltip?.ym===ym;
          return <g key={ym}>
            <rect x={cx-barW-1} y={PT+iH-hInc} width={barW} height={hInc} rx={3} fill="#22c55e" fillOpacity={hov?1:0.7}/>
            <rect x={cx+1}      y={PT+iH-hExp}  width={barW} height={hExp}  rx={3} fill="#ef4444" fillOpacity={hov?1:0.65}/>
            <text x={cx} y={H-6} textAnchor="middle" fill="#475569" fontSize={9}>{MONTHS_ES[(parseYM(ym).m)-1]}</text>
            <rect x={cx-step/2} y={PT} width={step} height={iH} fill="transparent"
              onMouseEnter={()=>setTooltip({x:cx,ym})} onMouseLeave={()=>setTooltip(null)}/>
          </g>;
        })}
      </svg>
      {tooltip&&(()=>{
        const {ym}=tooltip, inc=incomeByMonth[ym]??0, exp=expenseByMonth[ym]??0, net=inc-exp;
        const left=tooltip.x+PL>width*0.7?tooltip.x-140:tooltip.x+12;
        return <div className="absolute pointer-events-none rounded-xl px-3 py-2.5 text-xs z-10 min-w-[140px]"
          style={{left,top:8,background:"rgba(2,6,23,0.97)",border:"1px solid rgba(255,255,255,0.1)"}}>
          <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1.5">{ymLabel(ym)}</div>
          <div className="flex justify-between gap-4 mb-0.5"><span className="text-slate-500">Ingresos</span><span className="text-emerald-400 font-bold tabular-nums">{fmtMoney(inc)}</span></div>
          <div className="flex justify-between gap-4 mb-0.5"><span className="text-slate-500">Gastos</span><span className="text-rose-400 font-bold tabular-nums">{fmtMoney(exp)}</span></div>
          <div className="flex justify-between gap-4 pt-1 mt-1" style={{borderTop:"1px solid rgba(255,255,255,0.07)"}}>
            <span className="text-slate-500">Neto</span>
            <span className={`font-bold tabular-nums ${net>=0?"text-emerald-400":"text-rose-400"}`}>{fmtMoney(net)}</span>
          </div>
        </div>;
      })()}
      <div className="absolute top-2 right-4 flex items-center gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block opacity-80"/>Ingresos</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block opacity-80"/>Gastos</span>
      </div>
    </div>
  );
}

// ─── CATEGORY TABLE ───────────────────────────────────────────────────────────
function CategoryTable({ movements }: { movements: Movement[] }) {
  const [tab,setTab]=useState<"EXPENSE"|"INCOME"|"TRANSFER">("EXPENSE");
  const [sortBy,setSortBy]=useState<"amount"|"count">("amount");
  const rows=useMemo(()=>{
    const filtered=movements.filter(m=>m.type===tab);
    const map=new Map<string,{amount:number;count:number}>();
    for(const m of filtered){const cat=m.category?.trim()||"Sin categoría";const prev=map.get(cat)??{amount:0,count:0};map.set(cat,{amount:prev.amount+Math.abs(Number(m.amount)||0),count:prev.count+1});}
    const total=Array.from(map.values()).reduce((a,b)=>a+b.amount,0);
    return Array.from(map.entries()).map(([cat,d])=>({cat,...d,pct:total>0?(d.amount/total)*100:0})).sort((a,b)=>sortBy==="amount"?b.amount-a.amount:b.count-a.count);
  },[movements,tab,sortBy]);
  const total=useMemo(()=>rows.reduce((a,r)=>a+r.amount,0),[rows]);
  const tabColor=tab==="EXPENSE"?"#f87171":tab==="INCOME"?"#34d399":"#60a5fa";
  return (
    <div className="rounded-2xl overflow-hidden" style={{border:"1px solid rgba(255,255,255,0.07)"}}>
      <div className="flex items-center justify-between px-5 py-3.5"
        style={{borderBottom:"1px solid rgba(255,255,255,0.05)",background:"rgba(255,255,255,0.02)"}}>
        <div>
          <div className="text-sm font-semibold text-white">Por categoría</div>
          <div className="text-[11px] text-slate-600 mt-0.5">{rows.length} categorías · total {fmtMoney(total)}</div>
        </div>
        <div className="flex items-center gap-2">
          <PillGroup>
            <Pill active={tab==="EXPENSE"}  onClick={()=>setTab("EXPENSE")}>Gastos</Pill>
            <Pill active={tab==="INCOME"}   onClick={()=>setTab("INCOME")}>Ingresos</Pill>
            <Pill active={tab==="TRANSFER"} onClick={()=>setTab("TRANSFER")}>Transf.</Pill>
          </PillGroup>
          <PillGroup>
            <Pill active={sortBy==="amount"} onClick={()=>setSortBy("amount")}>Monto</Pill>
            <Pill active={sortBy==="count"}  onClick={()=>setSortBy("count")}>Cant.</Pill>
          </PillGroup>
        </div>
      </div>
      {rows.length===0
        ?<div className="px-5 py-8 text-center text-slate-700 text-xs">Sin movimientos en este período.</div>
        :<div className="divide-y" style={{borderColor:"rgba(255,255,255,0.04)"}}>
          {rows.map((r,i)=>(
            <div key={r.cat} className="flex items-center gap-3 px-5 py-2.5 transition-colors"
              style={{background:"transparent"}}
              onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.014)")}
              onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
              <div className="w-5 text-[10px] text-slate-700 tabular-nums shrink-0">{i+1}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-300 truncate">{r.cat}</div>
                <div className="mt-1 h-1 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.05)"}}>
                  <div className="h-full rounded-full" style={{width:`${r.pct}%`,background:tabColor,opacity:0.7}}/>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 tabular-nums shrink-0">{r.count} mov.</div>
              <div className="text-xs font-semibold tabular-nums shrink-0" style={{color:tabColor}}>{fmtMoney(r.amount)}</div>
              <div className="text-[10px] text-slate-700 tabular-nums w-8 text-right shrink-0">{r.pct.toFixed(0)}%</div>
            </div>
          ))}
        </div>
      }
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function CashflowClient({ from, to }: Props) {
  const router = useRouter();
  const { completeStep } = useAchievements();
  const [draftFrom,setDraftFrom]=useState(from);
  const [draftTo,setDraftTo]=useState(to);
  const [pickerOpen,setPickerOpen]=useState(false);
  const pickerRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{setDraftFrom(from);setDraftTo(to);},[from,to]);
  useEffect(()=>{
    if(!pickerOpen) return;
    function onDown(e: MouseEvent){if(pickerRef.current&&!pickerRef.current.contains(e.target as Node))setPickerOpen(false);}
    document.addEventListener("mousedown",onDown);
    return ()=>document.removeEventListener("mousedown",onDown);
  },[pickerOpen]);

  // Sin useSearchParams — construimos la URL directo con los params que necesitamos
  function applyRange(f: string, t: string){
    router.push(`/reportes/cashflow?from=${f}&to=${t}`);
    router.refresh();
    setPickerOpen(false);
  }

  const [movements,setMovements]=useState<Movement[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{
    const ctrl=new AbortController();
    (async()=>{
      try{
        setLoading(true);setError(null);
        const res=await fetch(`/api/reports/cashflow?from=${from}&to=${to}`,{signal:ctrl.signal});
        if(!res.ok){setError(`Error ${res.status}`);setMovements([]);return;}
        const json=await res.json();
        setMovements(json.movements??[]);
        completeStep("first_cashflow");
      }catch(e:any){if(e?.name!=="AbortError"){setError("Error de red");setMovements([]);}}
      finally{setLoading(false);}
    })();
    return ()=>ctrl.abort();
  },[from,to]);

  const {totalIncome,totalExpense,totalTransfer,netFlow,savingsRate}=useMemo(()=>{
    const totalIncome=movements.filter(m=>m.type==="INCOME").reduce((a,m)=>a+Math.max(0,Number(m.amount)||0),0);
    const totalExpense=movements.filter(m=>m.type==="EXPENSE").reduce((a,m)=>a+Math.abs(Number(m.amount)||0),0);
    const totalTransfer=movements.filter(m=>m.type==="TRANSFER").reduce((a,m)=>a+Math.abs(Number(m.amount)||0),0);
    return {totalIncome,totalExpense,totalTransfer,netFlow:totalIncome-totalExpense,savingsRate:totalIncome>0?((totalIncome-totalExpense)/totalIncome)*100:0};
  },[movements]);

  const months=useMemo(()=>ymRange(from,to),[from,to]);
  const {incomeByMonth,expenseByMonth}=useMemo(()=>{
    const inc:Record<string,number>={},exp:Record<string,number>={};
    for(const m of movements){const ym=m.date.slice(0,7);if(m.type==="INCOME")inc[ym]=(inc[ym]??0)+Math.max(0,Number(m.amount)||0);if(m.type==="EXPENSE")exp[ym]=(exp[ym]??0)+Math.abs(Number(m.amount)||0);}
    return {incomeByMonth:inc,expenseByMonth:exp};
  },[movements]);

  const sankeyData:SankeyData|null=useMemo(()=>{
    if(!movements.length) return null;
    const expenses=movements.filter(m=>m.type==="EXPENSE"),transfers=movements.filter(m=>m.type==="TRANSFER");
    if(totalIncome<=0&&totalExpense<=0) return null;
    const labels:string[]=[],idx=new Map<string,number>(),source:number[]=[],target:number[]=[],value:number[]=[];
    const node=(l:string)=>{if(!idx.has(l)){idx.set(l,labels.length);labels.push(l);}return idx.get(l)!;};
    const nInc=node("Ingresos"),nFlujo=node("Flujo"),nGastos=node("Gastos");
    if(totalIncome>0){source.push(nInc);target.push(nFlujo);value.push(totalIncome);}
    if(totalExpense>0){source.push(nFlujo);target.push(nGastos);value.push(totalExpense);}
    if(totalTransfer>0){const nT=node("Transferencias");source.push(nFlujo);target.push(nT);value.push(totalTransfer);}
    const rem=Math.max(0,totalIncome-totalExpense-totalTransfer);
    if(rem>0){source.push(node("Flujo"));target.push(node("Ahorro neto"));value.push(rem);}
    const expByCat=new Map<string,number>();
    for(const m of expenses){const c=m.category?.trim()||"Otros";expByCat.set(c,(expByCat.get(c)??0)+Math.abs(Number(m.amount)||0));}
    for(const [c,a] of expByCat){if(a>0){source.push(nGastos);target.push(node(c));value.push(a);}}
    const trfByCat=new Map<string,number>();
    for(const m of transfers){const c=m.category?.trim()||"Transferencias";trfByCat.set(c,(trfByCat.get(c)??0)+Math.abs(Number(m.amount)||0));}
    for(const [c,a] of trfByCat){if(a>0&&c!=="Transferencias"){source.push(node("Transferencias"));target.push(node(c));value.push(a);}}
    return {labels,source,target,value};
  },[movements,totalIncome,totalExpense,totalTransfer]);

  const presets=useMemo(()=>getPresets(),[]);
  const activePreset=presets.find(p=>p.from===from&&p.to===to)?.label??null;
  const rangeLabel=from===to?ymLabel(from):`${ymLabel(from)} — ${ymLabel(to)}`;

  return (
    <div className="px-4 md:px-6 py-5 md:py-6 space-y-5 max-w-screen-xl mx-auto">

      {/* HEADER + SELECTOR */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white tracking-tight">Cashflow</h1>
          <p className="text-xs text-slate-600 mt-1">Flujo de dinero · {rangeLabel}</p>
        </div>

        <div className="relative shrink-0" ref={pickerRef}>
          <div className="rounded-2xl overflow-hidden"
            style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)"}}>
            <div className="flex items-center gap-1 px-3 pt-3 pb-2"
              style={{borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
              {presets.map(p=>(
                <button key={p.label} onClick={()=>applyRange(p.from,p.to)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap"
                  style={{
                    background:activePreset===p.label?"linear-gradient(135deg,#0d9488,#2563eb)":"rgba(255,255,255,0.04)",
                    color:activePreset===p.label?"white":"rgba(148,163,184,0.7)",
                    border:activePreset===p.label?"1px solid transparent":"1px solid rgba(255,255,255,0.07)",
                    fontWeight:activePreset===p.label?700:500,
                  }}>
                  {p.label}
                </button>
              ))}
            </div>
            <button onClick={()=>setPickerOpen(o=>!o)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors"
              style={{color:"rgba(148,163,184,0.7)"}}
              onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.03)")}
              onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
              <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-600"/>
              <span className="text-[11px] flex-1 text-slate-500">
                {activePreset ? "Rango personalizado…" : <span className="text-white font-medium">{rangeLabel}</span>}
              </span>
              <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${pickerOpen?"rotate-90":""}`}/>
            </button>
          </div>

          {pickerOpen&&(
            <div className="absolute right-0 top-full mt-2 z-50 rounded-2xl p-4 shadow-2xl"
              style={{background:"rgba(2,6,23,0.98)",border:"1px solid rgba(255,255,255,0.12)",minWidth:304}}>
              <MonthPicker from={draftFrom} to={draftTo} onChange={(f,t)=>{setDraftFrom(f);setDraftTo(t);}}/>
              <div className="mt-3 flex items-center justify-between gap-2 pt-3"
                style={{borderTop:"1px solid rgba(255,255,255,0.07)"}}>
                <span className="text-[11px] text-slate-500">
                  {draftFrom===draftTo?ymLabel(draftFrom):`${ymLabel(draftFrom)} → ${ymLabel(draftTo)}`}
                </span>
                <button onClick={()=>applyRange(draftFrom,draftTo)}
                  className="px-4 py-1.5 rounded-xl text-[11px] font-bold text-white"
                  style={{background:"linear-gradient(135deg,#0d9488,#2563eb)"}}>
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {error&&<div className="rounded-xl px-4 py-3 text-xs text-rose-300" style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)"}}>{error}</div>}
      {loading&&<div className="flex items-center gap-2 text-xs text-slate-600 py-2"><RefreshCw className="w-3.5 h-3.5 animate-spin"/>Cargando…</div>}

      {!loading&&movements.length>0&&(
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard label="Ingresos"    value={fmtMoney(totalIncome)}  sub={`${movements.filter(m=>m.type==="INCOME").length} movimientos`}  icon={<TrendingUp   className="w-3.5 h-3.5" style={{color:"#34d399"}}/>} color="#34d399" glow="rgba(52,211,153,0.6)"/>
          <KpiCard label="Gastos"      value={fmtMoney(totalExpense)} sub={`${movements.filter(m=>m.type==="EXPENSE").length} movimientos`} icon={<TrendingDown className="w-3.5 h-3.5" style={{color:"#f87171"}}/>} color="#f87171" glow="rgba(248,113,113,0.6)"/>
          <KpiCard label="Neto"        value={fmtMoney(netFlow)}      sub={netFlow>=0?"Superávit":"Déficit"}                                icon={<Wallet       className="w-3.5 h-3.5" style={{color:netFlow>=0?"#34d399":"#f87171"}}/>} color={netFlow>=0?"#34d399":"#f87171"} glow={netFlow>=0?"rgba(52,211,153,0.5)":"rgba(248,113,113,0.5)"}/>
          <KpiCard label="Tasa ahorro" value={`${savingsRate.toFixed(1)}%`} sub={`${fmtMoney(totalTransfer)} en transferencias`}           icon={<PiggyBank    className="w-3.5 h-3.5" style={{color:"#60a5fa"}}/>} color="#60a5fa" glow="rgba(96,165,250,0.5)"/>
        </div>
      )}

      {!loading&&movements.length>0&&months.length>1&&(
        <div className="rounded-2xl overflow-hidden" style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)"}}>
          <div className="px-5 py-3.5" style={{borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
            <div className="text-sm font-semibold text-white">Evolución mensual</div>
            <div className="text-[11px] text-slate-600 mt-0.5">Ingresos vs gastos por mes</div>
          </div>
          <div className="px-4 py-4"><BarChart months={months} incomeByMonth={incomeByMonth} expenseByMonth={expenseByMonth}/></div>
        </div>
      )}

      {!loading&&!error&&sankeyData&&(
        <div className="rounded-2xl overflow-hidden" style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)"}}>
          <div className="px-5 py-3.5" style={{borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
            <div className="text-sm font-semibold text-white">Flujo de dinero</div>
            <div className="text-[11px] text-slate-600 mt-0.5">Distribución de ingresos → gastos por categoría</div>
          </div>
          <Plot
            data={[{type:"sankey",orientation:"h",
              node:{label:sankeyData.labels,pad:20,thickness:18,line:{color:"rgba(148,163,184,0.2)",width:0.5},
                color:sankeyData.labels.map((l,i)=>{
                  if(l==="Ingresos")       return "rgba(52,211,153,0.7)";
                  if(l==="Flujo")          return "rgba(96,165,250,0.6)";
                  if(l==="Gastos")         return "rgba(248,113,113,0.7)";
                  if(l==="Transferencias") return "rgba(251,191,36,0.65)";
                  if(l==="Ahorro neto")    return "rgba(167,139,250,0.65)";
                  return `hsla(${(i*47)%360},55%,58%,0.55)`;
                }),
              },
              link:{source:sankeyData.source,target:sankeyData.target,value:sankeyData.value,color:"rgba(148,163,184,0.07)"},
            } as any]}
            layout={{autosize:true,font:{color:"#94a3b8",size:11,family:"inherit"},paper_bgcolor:"transparent",plot_bgcolor:"transparent",margin:{l:16,r:16,t:12,b:12}}}
            style={{width:"100%",height:420}}
            config={{displayModeBar:false,responsive:true}}
          />
        </div>
      )}

      {!loading&&movements.length>0&&<CategoryTable movements={movements}/>}

      {!loading&&!error&&movements.length===0&&(
        <div className="rounded-2xl flex flex-col items-center justify-center py-16 gap-3"
          style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)"}}>
          <Wallet className="w-8 h-8 text-slate-700"/>
          <div className="text-sm text-slate-600">Sin movimientos en este período</div>
          <div className="text-xs text-slate-700">Seleccioná otro rango de fechas</div>
        </div>
      )}
    </div>
  );
}
