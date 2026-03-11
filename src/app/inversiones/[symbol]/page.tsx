"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, TrendingUp, TrendingDown,
  Wallet, Hash, BarChart3, Pencil, Trash2, X,
  ChevronRight, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

// ─── TIPOS ───────────────────────────────────────────────────────────────────

type QuoteResponse = { price: number | null; error?: string };
type TradeRow = {
  id: string; date: string; symbol: string; side: "BUY" | "SELL";
  quantity: number; price: number; total_usd: number; fee_usd: number | null;
  realized_pnl_usd?: number | null; note?: string | null;
  source?: string | null; external_id?: string | null; created_at?: string;
};
type HistoryPointApi = { date: string; price: number | null };
type RangeKey     = "1S" | "1M" | "3M" | "6M" | "1A" | "MAX";
type ChartMode    = "PRECIO" | "RENDIMIENTO" | "AMBOS";
type BaselineMode = "DESDE_ENTRADA" | "PROMEDIO";
type ChartPoint   = {
  date: string; price: number | null;
  rend_entry: number | null; rend_avg: number | null;
  buyQty: number | null; buyAmount: number | null; hasBuy: boolean;
  sellQty: number | null; sellAmount: number | null; hasSell: boolean;
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function toNum(v: any): number { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function round6(n: number) { return Math.round(n * 1_000_000) / 1_000_000; }
function formatUsd(n: number, compact = false) {
  const sign = n < 0 ? "-" : ""; const abs = Math.abs(n);
  if (compact && abs >= 1_000_000) return `${sign}US$ ${(abs/1_000_000).toFixed(2)}M`;
  if (compact && abs >= 1_000)     return `${sign}US$ ${(abs/1_000).toFixed(1)}k`;
  return `${sign}US$ ${abs.toLocaleString("es-UY",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}
function formatPct(n: number) {
  return `${n>=0?"+":"-"}${Math.abs(n).toLocaleString("es-UY",{minimumFractionDigits:2,maximumFractionDigits:2})}%`;
}
function formatDate(iso: string) {
  const s = String(iso||"").slice(0,10);
  if (!s.includes("-")) return s;
  const [y,m,d] = s.split("-"); return `${d}/${m}/${y}`;
}
function normalizeSymbol(raw: string) {
  const s = String(raw||"").trim().toUpperCase();
  return s.includes(":") ? s.split(":").pop()! : s;
}
function toMonthLabel(iso: string) {
  const d = new Date(iso+"T00:00:00Z");
  return `${d.toLocaleString("es-UY",{month:"short"}).replace(".","").toLowerCase()}-${String(d.getUTCFullYear()).slice(-2)}`;
}
function toDayLabel(iso: string) {
  const d = new Date(iso+"T00:00:00Z");
  return `${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}`;
}
function labelForRange(iso: string, range: RangeKey) { return range==="1S"?toDayLabel(iso):toMonthLabel(iso); }

function computePosition(trades: TradeRow[]) {
  let qty=0, invested=0, avgCost=0;
  const sorted=[...trades].sort((a,b)=>{ if(a.date!==b.date) return a.date<b.date?-1:1; return (a.created_at??"")<(b.created_at??"")? -1:1; });
  for (const t of sorted) {
    const side=String(t.side||"").toUpperCase() as "BUY"|"SELL";
    const q=toNum(t.quantity),total=toNum(t.total_usd),fee=toNum(t.fee_usd);
    if (!q||q<=0) continue;
    if (side==="BUY") { qty+=q; invested+=total+fee; avgCost=qty>0?invested/qty:0; }
    else { if(qty<=0)continue; const sq=Math.min(q,qty); qty-=sq; invested-=avgCost*sq; if(qty<=1e-12){qty=0;invested=0;avgCost=0;}else{avgCost=invested/qty;} }
  }
  return { qty, invested, avgCost };
}
function pickFirstBuy(trades: TradeRow[]) {
  const buys=trades.filter(t=>t.side==="BUY"&&toNum(t.quantity)>0).sort((a,b)=>a.date<b.date?-1:1);
  if (!buys.length) return null;
  const fd=buys[0].date, sd=buys.filter(b=>b.date===fd);
  const qty=sd.reduce((a,b)=>a+toNum(b.quantity),0);
  const cost=sd.reduce((a,b)=>a+toNum(b.total_usd)+toNum(b.fee_usd),0);
  return { date:fd, baseline:qty>0?cost/qty:toNum(sd[0].price) };
}
function aggregateByDay(trades: TradeRow[]) {
  const buys=new Map<string,{qty:number;amount:number}>();
  const sells=new Map<string,{qty:number;amount:number}>();
  for (const t of trades) {
    const q=toNum(t.quantity); if(q<=0) continue;
    const day=String(t.date).slice(0,10);
    const map=t.side==="BUY"?buys:sells;
    const prev=map.get(day)??{qty:0,amount:0};
    map.set(day,{qty:prev.qty+q,amount:prev.amount+toNum(t.total_usd)+toNum(t.fee_usd)});
  }
  return { buys, sells };
}

// ─── SVG CHART ───────────────────────────────────────────────────────────────

const MARGIN = { top:14, right:58, bottom:30, left:74 };

function linScale(domain:[number,number], range:[number,number]) {
  const [d0,d1]=domain, [r0,r1]=range;
  if (d1===d0) return (_:number)=>(r0+r1)/2;
  return (v:number) => r0+((v-d0)/(d1-d0))*(r1-r0);
}
function niceTicks(min:number,max:number,count=5): number[] {
  if (min===max) return [min];
  const raw=(max-min)/(count-1);
  const mag=Math.pow(10,Math.floor(Math.log10(raw)));
  const step=[1,2,2.5,5,10].map(f=>f*mag).find(s=>s>=raw)??raw;
  const lo=Math.floor(min/step)*step;
  const ticks:number[]=[];
  for(let t=lo; t<=max+step*0.01; t=Math.round((t+step)*1e10)/1e10) ticks.push(t);
  return ticks;
}
function fmtYPrice(v:number){
  if(Math.abs(v)>=1000) return `$${(v/1000).toFixed(1)}k`;
  if(Math.abs(v)>=1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(4)}`;
}

type SvgChartProps = {
  data: ChartPoint[]; chartMode: ChartMode;
  perfKey: "rend_entry"|"rend_avg"; baseline: number|null;
  avgCost: number; range: RangeKey;
};

function SvgChart({ data, chartMode, perfKey, baseline, avgCost, range }: SvgChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({w:800,h:300});
  const [tooltip, setTooltip] = useState<{idx:number;x:number;y:number}|null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => setSize({w:e.contentRect.width,h:e.contentRect.height}));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const {w, h} = size;
  const iW = w - MARGIN.left - MARGIN.right;
  const iH = h - MARGIN.top  - MARGIN.bottom;

  const priceVals = data.map(d=>d.price).filter((v):v is number => v!=null);
  const rendVals  = data.map(d=>d[perfKey]).filter((v):v is number => v!=null);
  const [pMin,pMax] = priceVals.length ? [Math.min(...priceVals),Math.max(...priceVals)] : [0,1];
  const [rMin,rMax] = rendVals.length  ? [Math.min(...rendVals),Math.max(...rendVals)]   : [-1,1];
  const pPad=(pMax-pMin)*0.08||pMax*0.1||1;
  const rPad=(rMax-rMin)*0.12||1;

  const xS  = useMemo(()=>linScale([0,Math.max(data.length-1,1)],[0,iW]),  [data.length,iW]);
  const yPS  = useMemo(()=>linScale([pMin-pPad,pMax+pPad],[iH,0]),          [pMin,pMax,pPad,iH]);
  const yRS  = useMemo(()=>linScale([rMin-rPad,rMax+rPad],[iH,0]),          [rMin,rMax,rPad,iH]);

  const pTicks = useMemo(()=>niceTicks(pMin-pPad,pMax+pPad,5),[pMin,pMax,pPad]);
  const rTicks = useMemo(()=>niceTicks(rMin-rPad,rMax+rPad,5),[rMin,rMax,rPad]);

  const xTicks = useMemo(()=>{
    const out:{i:number;label:string}[]=[];
    if(!data.length) return out;
    const maxT=Math.max(3,Math.floor(iW/72));
    const step=Math.ceil(data.length/maxT);
    for(let i=0;i<data.length;i+=step) out.push({i,label:labelForRange(data[i].date,range)});
    return out;
  },[data,iW,range]);

  // Segmentos precio — siempre azul (es una métrica distinta al rendimiento)
  const priceSegs = useMemo(()=>{
    const segs:{x1:number;y1:number;x2:number;y2:number;color:string}[]=[];
    const valid=data.map((d,i)=>({d,i})).filter(({d})=>d.price!=null);
    for(let k=0;k<valid.length-1;k++){
      const {d:a,i:ai}=valid[k],{d:b,i:bi}=valid[k+1];
      const x1=xS(ai),y1=yPS(a.price!),x2=xS(bi),y2=yPS(b.price!);
      segs.push({x1,y1,x2,y2,color:"#3b82f6"});
    }
    return segs;
  },[data,xS,yPS]);

  // Segmentos bicolor rendimiento
  const rendSegs = useMemo(()=>{
    const segs:{x1:number;y1:number;x2:number;y2:number;color:string}[]=[];
    const valid=data.map((d,i)=>({d,i})).filter(({d})=>d[perfKey]!=null);
    for(let k=0;k<valid.length-1;k++){
      const {d:a,i:ai}=valid[k],{d:b,i:bi}=valid[k+1];
      const av=a[perfKey]!,bv=b[perfKey]!;
      const x1=xS(ai),y1=yRS(av),x2=xS(bi),y2=yRS(bv);
      const aA=av>=0,bA=bv>=0;
      if(aA===bA){segs.push({x1,y1,x2,y2,color:aA?"#34d399":"#f87171"});}
      else{
        const y0=yRS(0),t=(y1-y0)/(y1-y2||0.0001),xM=x1+t*(x2-x1);
        segs.push({x1,y1,x2:xM,y2:y0,color:aA?"#34d399":"#f87171"});
        segs.push({x1:xM,y1:y0,x2,y2,color:bA?"#34d399":"#f87171"});
      }
    }
    return segs;
  },[data,perfKey,xS,yRS]);

  function handleMouseMove(e: React.MouseEvent<SVGRectElement>) {
    if(!data.length) return;
    const rect=e.currentTarget.getBoundingClientRect();
    const mx=e.clientX-rect.left;
    const rawIdx=(mx/iW)*(data.length-1);
    const idx=Math.max(0,Math.min(data.length-1,Math.round(rawIdx)));
    const d=data[idx];
    const yVal=chartMode==="RENDIMIENTO"?d[perfKey]:d.price;
    const yCoord=yVal!=null?(chartMode==="RENDIMIENTO"?yRS(yVal):yPS(yVal)):iH/2;
    setTooltip({idx,x:xS(idx),y:yCoord});
  }

  const ttData = tooltip!=null ? data[tooltip.idx] : null;

  return (
    <div ref={containerRef} className="relative w-full h-full select-none">
      <svg width={w} height={h}>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* Clip */}
          <clipPath id="chart-clip"><rect x={0} y={0} width={iW} height={iH}/></clipPath>

          {/* Grid horizontal */}
          {(chartMode!=="RENDIMIENTO"?pTicks:rTicks).map((t,i)=>{
            const y=chartMode!=="RENDIMIENTO"?yPS(t):yRS(t);
            return <line key={i} x1={0} y1={y} x2={iW} y2={y} stroke="rgba(255,255,255,0.04)" strokeDasharray="4 6"/>;
          })}

          {/* Eje Y izquierda */}
          {chartMode!=="RENDIMIENTO" && pTicks.map((t,i)=>(
            <text key={i} x={-8} y={yPS(t)} textAnchor="end" dominantBaseline="middle" fill="#475569" fontSize={10}>{fmtYPrice(t)}</text>
          ))}

          {/* Eje Y derecha */}
          {chartMode!=="PRECIO" && rTicks.map((t,i)=>(
            <text key={i} x={iW+8} y={yRS(t)} textAnchor="start" dominantBaseline="middle" fill="#475569" fontSize={10}>{t>=0?"+":""}{t.toFixed(1)}%</text>
          ))}

          {/* Eje X */}
          {xTicks.map(({i,label})=>(
            <text key={i} x={xS(i)} y={iH+18} textAnchor="middle" fill="#475569" fontSize={10}>{label}</text>
          ))}

          {/* Referencia precio promedio */}
          {avgCost>0 && chartMode!=="RENDIMIENTO" && (()=>{
            const y=yPS(avgCost);
            return y>=0&&y<=iH?<line x1={0} y1={y} x2={iW} y2={y} stroke="rgba(148,163,184,0.28)" strokeDasharray="6 6"/>:null;
          })()}

          {/* Referencia 0% rendimiento */}
          {chartMode!=="PRECIO" && (()=>{
            const y=yRS(0);
            return y>=0&&y<=iH?<line x1={0} y1={y} x2={iW} y2={y} stroke="rgba(148,163,184,0.18)" strokeDasharray="4 6"/>:null;
          })()}

          {/* Líneas bicolor precio */}
          <g clipPath="url(#chart-clip)">
            {(chartMode==="PRECIO"||chartMode==="AMBOS") && priceSegs.map((s,i)=>(
              <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.color} strokeWidth={2} strokeLinecap="round"/>
            ))}
            {/* Líneas bicolor rendimiento */}
            {(chartMode==="RENDIMIENTO"||chartMode==="AMBOS") && rendSegs.map((s,i)=>(
              <line key={`r${i}`} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.color} strokeWidth={2} strokeLinecap="round"/>
            ))}
          </g>

          {/* Marcadores compras/ventas */}
          {data.map((d,i)=>{
            if(!d.hasBuy&&!d.hasSell) return null;
            const x=xS(i);
            const yVal=chartMode==="RENDIMIENTO"?d[perfKey]:d.price;
            if(yVal==null) return null;
            const y=chartMode==="RENDIMIENTO"?yRS(yVal):yPS(yVal);
            if(y<0||y>iH) return null;
            return (
              <g key={i}>
                {d.hasBuy&&<><circle cx={x} cy={y} r={7} fill="rgba(34,197,94,0.12)"/><circle cx={x} cy={y} r={4.5} fill="#22c55e" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5}/></>}
                {d.hasSell&&<><circle cx={x} cy={y} r={7} fill="rgba(251,146,60,0.12)"/><circle cx={x} cy={y} r={4.5} fill="#fb923c" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5}/></>}
              </g>
            );
          })}

          {/* Cursor */}
          {tooltip!=null&&(
            <>
              <line x1={tooltip.x} y1={0} x2={tooltip.x} y2={iH} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 4" strokeWidth={1}/>
              <circle cx={tooltip.x} cy={tooltip.y} r={3.5} fill="white" fillOpacity={0.9}/>
            </>
          )}

          {/* Área interactiva */}
          <rect x={0} y={0} width={iW} height={iH} fill="transparent"
            onMouseMove={handleMouseMove} onMouseLeave={()=>setTooltip(null)}/>
        </g>
      </svg>

      {/* Tooltip flotante */}
      {tooltip!=null&&ttData&&(()=>{
        const screenX=tooltip.x+MARGIN.left;
        const isRight=screenX>w*0.62;
        const left=isRight?screenX-168:screenX+14;
        const top=Math.max(4,tooltip.y+MARGIN.top-64);
        const rend=ttData[perfKey];
        return (
          <div className="absolute pointer-events-none rounded-xl px-3 py-2.5 text-xs shadow-2xl min-w-[155px] z-10"
            style={{left,top,background:"rgba(2,6,23,0.97)",border:"1px solid rgba(255,255,255,0.1)"}}>
            <div className="text-slate-500 mb-1.5 text-[10px] uppercase tracking-widest">{formatDate(ttData.date)}</div>
            {chartMode!=="RENDIMIENTO"&&ttData.price!=null&&(
              <div className="flex justify-between gap-5 mb-0.5">
                <span className="text-slate-500">Precio</span>
                <span className="font-bold text-white tabular-nums">{formatUsd(ttData.price)}</span>
              </div>
            )}
            {chartMode!=="PRECIO"&&(
              <div className="flex justify-between gap-5 mb-0.5">
                <span className="text-slate-500">Rend.</span>
                <span className={`font-bold tabular-nums ${toNum(rend)>=0?"text-emerald-400":"text-rose-400"}`}>
                  {rend==null?"—":formatPct(toNum(rend))}
                </span>
              </div>
            )}
            {(ttData.hasBuy||ttData.hasSell)&&(
              <div className="mt-1.5 pt-1.5 space-y-1" style={{borderTop:"1px solid rgba(255,255,255,0.07)"}}>
                {ttData.hasBuy&&(
                  <div>
                    <div className="text-[10px] font-bold text-green-400 mb-0.5">▲ Compra</div>
                    <div className="flex justify-between gap-4 text-[10px]"><span className="text-slate-500">Qty</span><span className="text-white">{ttData.buyQty}</span></div>
                    <div className="flex justify-between gap-4 text-[10px]"><span className="text-slate-500">Monto</span><span className="text-white">{ttData.buyAmount!=null?formatUsd(ttData.buyAmount):"—"}</span></div>
                  </div>
                )}
                {ttData.hasSell&&(
                  <div>
                    <div className="text-[10px] font-bold text-orange-400 mb-0.5">▼ Venta</div>
                    <div className="flex justify-between gap-4 text-[10px]"><span className="text-slate-500">Qty</span><span className="text-white">{ttData.sellQty}</span></div>
                    <div className="flex justify-between gap-4 text-[10px]"><span className="text-slate-500">Monto</span><span className="text-white">{ttData.sellAmount!=null?formatUsd(ttData.sellAmount):"—"}</span></div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─── ATOMS ───────────────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",
  borderRadius:10,padding:"8px 12px",color:"white",fontSize:13,outline:"none",width:"100%",
};
function Pill({active,onClick,children}:{active:boolean;onClick:()=>void;children:React.ReactNode}){
  return <button onClick={onClick} className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
    style={{background:active?"rgba(255,255,255,0.1)":"transparent",color:active?"white":"rgba(148,163,184,0.6)",border:active?"1px solid rgba(255,255,255,0.12)":"1px solid transparent"}}>{children}</button>;
}
function PillGroup({children}:{children:React.ReactNode}){
  return <div className="flex rounded-xl p-0.5 gap-0.5" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>{children}</div>;
}
function SideBadge({side}:{side:"BUY"|"SELL"}){
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
    style={{background:side==="BUY"?"rgba(34,197,94,0.12)":"rgba(251,146,60,0.12)",color:side==="BUY"?"#4ade80":"#fb923c",border:`1px solid ${side==="BUY"?"rgba(34,197,94,0.25)":"rgba(251,146,60,0.25)"}`}}>
    {side==="BUY"?"▲ BUY":"▼ SELL"}
  </span>;
}
function KpiCard({icon,iconBg,iconBorder,glow,label,sub,children}:{icon:React.ReactNode;iconBg:string;iconBorder:string;glow:string;label:string;sub:string;children:React.ReactNode}){
  return <div className="relative rounded-2xl p-4 flex flex-col gap-2 overflow-hidden" style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)"}}>
    <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full blur-2xl pointer-events-none" style={{background:glow,opacity:0.18}}/>
    <div className="relative z-10 flex items-center justify-between">
      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">{label}</span>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:iconBg,border:`1px solid ${iconBorder}`}}>{icon}</div>
    </div>
    <div className="relative z-10"><div className="text-xl font-bold text-white leading-none">{children}</div><div className="text-[11px] text-slate-600 mt-1">{sub}</div></div>
  </div>;
}
function Modal({open,title,sub,onClose,children}:{open:boolean;title:string;sub?:string;onClose:()=>void;children:React.ReactNode}){
  if(!open) return null;
  return <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    style={{background:"rgba(0,0,0,0.75)",backdropFilter:"blur(8px)"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
      style={{background:"linear-gradient(160deg,#07101f,#040c1a)",border:"1px solid rgba(255,255,255,0.1)",maxHeight:"92dvh",overflowY:"auto"}}>
      <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
        style={{borderBottom:"1px solid rgba(255,255,255,0.07)",background:"rgba(7,16,31,0.96)",backdropFilter:"blur(12px)"}}>
        <div><div className="font-bold text-white text-sm">{title}</div>{sub&&<div className="text-[11px] text-slate-600 mt-0.5">{sub}</div>}</div>
        <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 hover:text-white hover:bg-white/5 transition-all"><X className="w-4 h-4"/></button>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  </div>;
}
function MField({label,hint,children}:{label:string;hint?:string;children:React.ReactNode}){
  return <div><label className="text-[10px] text-slate-600 mb-1.5 block uppercase tracking-wider">{label}</label>{children}{hint&&<p className="text-[10px] text-slate-700 mt-1">{hint}</p>}</div>;
}

// ─── PÁGINA ───────────────────────────────────────────────────────────────────

export default function AssetDetailPage() {
  const params = useParams<{symbol:string}>();
  const router = useRouter();
  const raw = Array.isArray(params.symbol)?params.symbol[0]:params.symbol;
  const symbol = normalizeSymbol(decodeURIComponent(raw||""));

  const [price,setPrice]                   = useState<number|null>(null);
  const [loadingPrice,setLoadingPrice]     = useState(true);
  const [trades,setTrades]                 = useState<TradeRow[]>([]);
  const [loadingTrades,setLoadingTrades]   = useState(true);
  const [tradesErr,setTradesErr]           = useState<string|null>(null);
  const [history,setHistory]               = useState<{date:string;price:number|null}[]>([]);
  const [loadingHistory,setLoadingHistory] = useState(true);
  const [historyErr,setHistoryErr]         = useState<string|null>(null);
  const [range,setRange]                   = useState<RangeKey>("6M");
  const [chartMode,setChartMode]           = useState<ChartMode>("AMBOS");
  const [baselineMode,setBaselineMode]     = useState<BaselineMode>("DESDE_ENTRADA");
  const [editing,setEditing]               = useState<TradeRow|null>(null);
  const [savingTrade,setSavingTrade]       = useState(false);
  const [saveErr,setSaveErr]               = useState<string|null>(null);
  const [deletingId,setDeletingId]         = useState<string|null>(null);
  const [deleteErr,setDeleteErr]           = useState<string|null>(null);

  async function loadTrades(){
    if(!symbol) return;
    try{ setLoadingTrades(true); setTradesErr(null);
      const res=await fetch(`/api/investments/trades/${encodeURIComponent(symbol)}`,{cache:"no-store"});
      const json=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(json?.error??`Error ${res.status}`);
      setTrades((json?.trades??[]) as TradeRow[]);
    }catch(e:any){setTradesErr(e?.message??"Error");setTrades([]);}
    finally{setLoadingTrades(false);}
  }
  async function loadPrice(){
    if(!symbol) return;
    try{ setLoadingPrice(true);
      const res=await fetch(`/api/quotes/${encodeURIComponent(symbol)}`,{cache:"no-store"});
      const data=await res.json() as QuoteResponse;
      setPrice(typeof data?.price==="number"?data.price:null);
    }catch{setPrice(null);}finally{setLoadingPrice(false);}
  }
  async function loadHistory(r:RangeKey){
    if(!symbol) return;
    try{ setLoadingHistory(true); setHistoryErr(null);
      const res=await fetch(`/api/quotes/history/${encodeURIComponent(symbol)}?range=${r}`,{cache:"no-store"});
      const json=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(json?.error??`Error ${res.status}`);
      const pts=((json?.points??[]) as HistoryPointApi[])
        .filter(p=>p?.date&&(typeof p?.price==="number"||p?.price===null))
        .map(p=>({date:String(p.date).slice(0,10),price:p.price==null?null:Number(p.price)}))
        .sort((a,b)=>a.date<b.date?-1:1);
      setHistory(pts);
    }catch(e:any){setHistoryErr(e?.message??"Error histórico.");setHistory([]);}
    finally{setLoadingHistory(false);}
  }
  async function refresh(){ await Promise.all([loadTrades(),loadPrice(),loadHistory(range)]); }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{ void loadTrades(); void loadPrice(); void loadHistory(range); },[symbol]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{ void loadHistory(range); },[range]);

  const position    = useMemo(()=>trades.length?computePosition(trades):null,[trades]);
  const avgCost     = toNum(position?.avgCost);
  const qtyOpen     = toNum(position?.qty);
  const entry       = useMemo(()=>pickFirstBuy(trades),[trades]);
  const {buys:buysByDay,sells:sellsByDay} = useMemo(()=>aggregateByDay(trades),[trades]);
  const entryBL     = entry?.baseline&&entry.baseline>0?entry.baseline:null;
  const avgBL       = avgCost>0?avgCost:null;
  const firstBuyDay = entry?.date??null;
  const activeBaseline = baselineMode==="PROMEDIO"?avgBL:entryBL;

  const chartData: ChartPoint[] = useMemo(()=>history.map(h=>{
    const buyAgg=buysByDay.get(h.date), sellAgg=sellsByDay.get(h.date), p=h.price;
    let rend_entry:number|null=null;
    if(p!=null&&entryBL!=null&&firstBuyDay) rend_entry=h.date<firstBuyDay?null:round6(((p/entryBL)-1)*100);
    let rend_avg:number|null=null;
    if(p!=null&&avgBL!=null) rend_avg=round6(((p/avgBL)-1)*100);
    return {date:h.date,price:p,rend_entry,rend_avg,
      buyQty:buyAgg?round6(buyAgg.qty):null,buyAmount:buyAgg?round6(buyAgg.amount):null,hasBuy:Boolean(buyAgg?.qty),
      sellQty:sellAgg?round6(sellAgg.qty):null,sellAmount:sellAgg?round6(sellAgg.amount):null,hasSell:Boolean(sellAgg?.qty)};
  }),[history,buysByDay,sellsByDay,entryBL,avgBL,firstBuyDay]);

  const stats = useMemo(()=>{
    const mkt=toNum(price), invested=avgCost*qtyOpen, current=mkt*qtyOpen, pnl=current-invested;
    const base=activeBaseline, pctFromBaseline=base&&mkt>0?((mkt-base)/base)*100:0;
    return {mktPrice:mkt,qty:qtyOpen,avgCost,invested,current,pnl,pctFromBaseline};
  },[price,qtyOpen,avgCost,activeBaseline]);

  const perfKey   = (baselineMode==="PROMEDIO"?"rend_avg":"rend_entry") as "rend_entry"|"rend_avg";
  const hasPos    = qtyOpen>0;
  const tableTotals = useMemo(()=>({
    buyTotal:  trades.filter(t=>t.side==="BUY").reduce((a,t)=>a+toNum(t.total_usd),0),
    sellTotal: trades.filter(t=>t.side==="SELL").reduce((a,t)=>a+toNum(t.total_usd),0),
    totalFees: trades.reduce((a,t)=>a+toNum(t.fee_usd),0),
    buyCount:  trades.filter(t=>t.side==="BUY").length,
    sellCount: trades.filter(t=>t.side==="SELL").length,
  }),[trades]);

  async function handleDelete(id:string){
    if(!window.confirm("¿Eliminar esta operación?")) return;
    try{ setDeletingId(id); setDeleteErr(null);
      const res=await fetch(`/api/investments/trades/by-id/${encodeURIComponent(id)}`,{method:"DELETE"});
      const body=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(body?.error??`Error ${res.status}`);
      await refresh();
    }catch(e:any){setDeleteErr(e?.message??"Error");}finally{setDeletingId(null);}
  }
  async function handleSave(next:TradeRow){
    try{ setSavingTrade(true); setSaveErr(null);
      const res=await fetch(`/api/investments/trades/by-id/${encodeURIComponent(next.id)}`,{
        method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({date:String(next.date).slice(0,10),side:next.side,quantity:toNum(next.quantity),price:toNum(next.price),total_usd:toNum(next.total_usd),fee_usd:next.fee_usd==null?0:toNum(next.fee_usd),note:next.note??null}),
      });
      const body=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(body?.error??`Error ${res.status}`);
      setEditing(null); await refresh();
    }catch(e:any){setSaveErr(e?.message??"Error");}finally{setSavingTrade(false);}
  }

  return (
    <div className="px-4 md:px-6 py-5 md:py-6 space-y-5 max-w-screen-xl mx-auto">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 mb-2">
            <button onClick={()=>router.back()} className="flex items-center gap-1 hover:text-slate-400 transition-colors">
              <ArrowLeft className="w-3 h-3"/> Volver
            </button>
            <span>·</span>
            <Link href="/inversiones" className="hover:text-slate-400 transition-colors">Inversiones</Link>
            <ChevronRight className="w-3 h-3"/>
            <span className="text-slate-500">{symbol}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white tracking-tight">{symbol}</h1>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-slate-600"
              style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>
              <RefreshCw className="w-2.5 h-2.5"/> Live
            </div>
            {hasPos&&<span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{background:"rgba(52,211,153,0.08)",border:"1px solid rgba(52,211,153,0.2)",color:"#34d399"}}>Posición abierta</span>}
          </div>
          <p className="text-xs text-slate-600 mt-1">Detalle del activo · editá operaciones para corregir imports</p>
        </div>
        <div className="shrink-0 rounded-2xl px-5 py-3.5 text-right"
          style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)"}}>
          <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-1">Precio actual</div>
          <div className="text-2xl font-bold text-white tabular-nums leading-none">
            {loadingPrice?<span className="text-slate-700 text-base">…</span>:formatUsd(stats.mktPrice)}
          </div>
          {hasPos&&!loadingPrice&&(
            <div className={`text-xs font-semibold mt-1 tabular-nums ${stats.pctFromBaseline>=0?"text-emerald-400":"text-rose-400"}`}>
              {stats.pctFromBaseline>=0?"+":""}{stats.pctFromBaseline.toFixed(2)}%{" "}
              <span className="text-slate-600 font-normal">desde {baselineMode==="PROMEDIO"?"promedio":"entrada"}</span>
            </div>
          )}
        </div>
      </div>

      {/* ERRORES */}
      {[tradesErr,historyErr,deleteErr].filter(Boolean).map((e,i)=>(
        <div key={i} className="rounded-xl px-4 py-3 text-xs text-rose-300"
          style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)"}}>{e}</div>
      ))}

      {/* KPIs */}
      {hasPos?(
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard icon={<Hash className="w-3.5 h-3.5 text-slate-400"/>} iconBg="rgba(148,163,184,0.07)" iconBorder="rgba(148,163,184,0.14)" glow="rgba(148,163,184,0.3)" label="Cantidad" sub="posición abierta">
            <span className="tabular-nums">{stats.qty.toLocaleString("es-UY",{maximumFractionDigits:8})}</span>
          </KpiCard>
          <KpiCard icon={<BarChart3 className="w-3.5 h-3.5 text-sky-400"/>} iconBg="rgba(96,165,250,0.1)" iconBorder="rgba(96,165,250,0.2)" glow="rgba(96,165,250,0.3)" label="P. promedio" sub="línea de referencia en gráfico">
            <span className="tabular-nums">{formatUsd(stats.avgCost)}</span>
          </KpiCard>
          <KpiCard icon={<Wallet className="w-3.5 h-3.5 text-indigo-400"/>} iconBg="rgba(99,102,241,0.1)" iconBorder="rgba(99,102,241,0.2)" glow="rgba(99,102,241,0.3)" label="Valor actual" sub={`invertido: ${formatUsd(stats.invested,true)}`}>
            <span className="tabular-nums">{formatUsd(stats.current,true)}</span>
          </KpiCard>
          <div className="relative rounded-2xl p-4 flex flex-col gap-2 overflow-hidden"
            style={{background:stats.pnl>=0?"rgba(52,211,153,0.05)":"rgba(248,113,113,0.05)",border:`1px solid ${stats.pnl>=0?"rgba(52,211,153,0.2)":"rgba(248,113,113,0.2)"}`}}>
            <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full blur-2xl pointer-events-none"
              style={{background:stats.pnl>=0?"rgba(52,211,153,0.5)":"rgba(248,113,113,0.5)",opacity:0.22}}/>
            <div className="relative z-10 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">G/P</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{background:stats.pnl>=0?"rgba(52,211,153,0.1)":"rgba(248,113,113,0.1)",border:`1px solid ${stats.pnl>=0?"rgba(52,211,153,0.2)":"rgba(248,113,113,0.2)"}`}}>
                {stats.pnl>=0?<TrendingUp className="w-3.5 h-3.5 text-emerald-400"/>:<TrendingDown className="w-3.5 h-3.5 text-rose-400"/>}
              </div>
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-1">
                {stats.pnl>=0?<ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0"/>:<ArrowDownRight className="w-4 h-4 text-rose-400 shrink-0"/>}
                <span className="text-xl font-bold tabular-nums leading-none" style={{color:stats.pnl>=0?"#34d399":"#f87171"}}>{formatUsd(stats.pnl,true)}</span>
              </div>
              <div className="text-[11px] mt-1 tabular-nums" style={{color:stats.pnl>=0?"#34d399":"#f87171"}}>
                {formatPct(stats.pctFromBaseline)}{" "}<span className="text-slate-600 font-normal">desde {baselineMode==="DESDE_ENTRADA"?"entrada":"promedio"}</span>
              </div>
            </div>
          </div>
        </div>
      ):(
        <div className="rounded-2xl px-5 py-4" style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)"}}>
          <div className="text-xs text-slate-500">{loadingTrades?"Cargando…":`Sin posición abierta en ${symbol}.`}</div>
          <div className="text-[11px] text-slate-700 mt-0.5">Podés analizar el precio histórico y las operaciones igualmente.</div>
        </div>
      )}

      {/* GRÁFICO */}
      <div className="rounded-2xl overflow-hidden" style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)"}}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 px-5 pt-4 pb-3"
          style={{borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
          <div>
            <div className="text-sm font-semibold text-white">Precio histórico</div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[11px] text-slate-600">
              <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0.5 rounded bg-sky-500"/><span>Precio</span></span>
              <span className="flex items-center gap-1.5">
                <span className="inline-flex w-6 h-0.5 rounded overflow-hidden"><span className="flex-1 bg-emerald-400"/><span className="flex-1 bg-rose-400"/></span>
                <span>Rendimiento</span>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"/> Compra</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block"/> Venta</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <PillGroup>
              {(["1S","1M","3M","6M","1A","MAX"] as RangeKey[]).map(r=>(
                <Pill key={r} active={range===r} onClick={()=>setRange(r)}>{r}</Pill>
              ))}
            </PillGroup>
            <PillGroup>
              {([["PRECIO","Precio"],["RENDIMIENTO","Rend."],["AMBOS","Ambos"]] as [ChartMode,string][]).map(([m,l])=>(
                <Pill key={m} active={chartMode===m} onClick={()=>setChartMode(m)}>{l}</Pill>
              ))}
            </PillGroup>
            <PillGroup>
              <Pill active={baselineMode==="DESDE_ENTRADA"} onClick={()=>setBaselineMode("DESDE_ENTRADA")}>Entrada</Pill>
              <Pill active={baselineMode==="PROMEDIO"}      onClick={()=>setBaselineMode("PROMEDIO")}>Promedio</Pill>
            </PillGroup>
          </div>
        </div>

        <div className="h-[280px] sm:h-[320px]">
          {loadingHistory?(
            <div className="h-full flex items-center justify-center text-slate-700 text-xs">Cargando histórico…</div>
          ):chartData.length===0?(
            <div className="h-full flex items-center justify-center text-slate-700 text-xs">Sin datos para este rango.</div>
          ):(
            <SvgChart data={chartData} chartMode={chartMode} perfKey={perfKey}
              baseline={activeBaseline} avgCost={avgCost} range={range}/>
          )}
        </div>

        <div className="px-5 py-2.5 flex items-center justify-between text-[10px] text-slate-700"
          style={{borderTop:"1px solid rgba(255,255,255,0.04)"}}>
          <span>
            {loadingHistory?"Cargando…":chartData.length
              ?`${labelForRange(chartData[0].date,range)} → ${labelForRange(chartData[chartData.length-1].date,range)}${baselineMode==="DESDE_ENTRADA"&&firstBuyDay?` · Rend. desde: ${formatDate(firstBuyDay)}`:""}`
              :"Sin datos"}
          </span>
          <button onClick={refresh} className="flex items-center gap-1 hover:text-slate-400 transition-colors">
            <RefreshCw className="w-3 h-3"/> Actualizar
          </button>
        </div>
      </div>

      {/* TABLA TRADES */}
      <div className="rounded-2xl overflow-hidden" style={{border:"1px solid rgba(255,255,255,0.07)"}}>
        <div className="flex items-center gap-3 px-5 py-4"
          style={{borderBottom:"1px solid rgba(255,255,255,0.05)",background:"rgba(255,255,255,0.02)"}}>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white">Operaciones</div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              {loadingTrades?"Cargando…":`${trades.length} operaciones · ${tableTotals.buyCount} compras · ${tableTotals.sellCount} ventas`}
            </div>
          </div>
          <button onClick={refresh} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all"
            style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",color:"#64748b"}}>
            <RefreshCw className="w-3 h-3"/> Actualizar
          </button>
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-xs" style={{minWidth:760}}>
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-slate-700"
                style={{background:"rgba(255,255,255,0.012)",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                <th className="px-4 py-2.5 text-left">Fecha</th>
                <th className="px-4 py-2.5 text-left">Side</th>
                <th className="px-4 py-2.5 text-right">Cantidad</th>
                <th className="px-4 py-2.5 text-right">Precio</th>
                <th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5 text-right">Fee</th>
                <th className="px-4 py-2.5 text-left">Nota</th>
                <th className="px-4 py-2.5"/>
              </tr>
            </thead>
            <tbody className="divide-y" style={{borderColor:"rgba(255,255,255,0.04)"}}>
              {loadingTrades&&<tr><td colSpan={8} className="px-4 py-8 text-center text-slate-700">Cargando…</td></tr>}
              {!loadingTrades&&trades.length===0&&<tr><td colSpan={8} className="px-4 py-8 text-center text-slate-700">No hay operaciones.</td></tr>}
              {!loadingTrades&&trades.map(t=>(
                <tr key={t.id} className="group transition-colors" style={{background:"transparent"}}
                  onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.014)")}
                  onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                  <td className="px-4 py-2.5 text-slate-400 tabular-nums">{formatDate(t.date)}</td>
                  <td className="px-4 py-2.5"><SideBadge side={t.side}/></td>
                  <td className="px-4 py-2.5 text-right text-slate-300 tabular-nums">{toNum(t.quantity).toLocaleString("es-UY",{maximumFractionDigits:8})}</td>
                  <td className="px-4 py-2.5 text-right text-slate-300 tabular-nums">{formatUsd(toNum(t.price))}</td>
                  <td className="px-4 py-2.5 text-right text-white font-medium tabular-nums">{formatUsd(toNum(t.total_usd))}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600 tabular-nums">{formatUsd(toNum(t.fee_usd))}</td>
                  <td className="px-4 py-2.5 text-slate-500 max-w-[200px] truncate">{t.note??"—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={()=>{setSaveErr(null);setEditing(t);}}
                        className="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                        style={{color:"#64748b"}}
                        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color="#cbd5e1";(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.05)"}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color="#64748b";(e.currentTarget as HTMLElement).style.background="transparent"}}>
                        <Pencil className="w-3 h-3"/>
                      </button>
                      <button onClick={()=>void handleDelete(t.id)} disabled={deletingId===t.id}
                        className="w-6 h-6 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
                        style={{color:"#64748b"}}
                        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color="#f87171";(e.currentTarget as HTMLElement).style.background="rgba(248,113,113,0.1)"}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color="#64748b";(e.currentTarget as HTMLElement).style.background="transparent"}}>
                        <Trash2 className="w-3 h-3"/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loadingTrades&&trades.length>0&&(
            <div className="flex items-center justify-between px-5 py-3 text-xs"
              style={{borderTop:"1px solid rgba(255,255,255,0.05)",background:"rgba(255,255,255,0.01)"}}>
              <span className="text-slate-700">{trades.length} operaciones</span>
              <div className="flex items-center gap-5 text-slate-600">
                <span>Comprado: <span className="text-white font-medium tabular-nums">{formatUsd(tableTotals.buyTotal,true)}</span></span>
                <span>Vendido: <span className="text-white font-medium tabular-nums">{formatUsd(tableTotals.sellTotal,true)}</span></span>
                <span>Fees: <span className="text-slate-500 tabular-nums">{formatUsd(tableTotals.totalFees,true)}</span></span>
              </div>
            </div>
          )}
        </div>

        <div className="block sm:hidden divide-y" style={{borderColor:"rgba(255,255,255,0.04)"}}>
          {loadingTrades&&<div className="px-5 py-6 text-center text-slate-700 text-xs">Cargando…</div>}
          {!loadingTrades&&trades.length===0&&<div className="px-5 py-6 text-center text-slate-700 text-xs">Sin operaciones.</div>}
          {!loadingTrades&&trades.map(t=>(
            <div key={t.id} className="px-5 py-3 flex items-center gap-3">
              <SideBadge side={t.side}/>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white tabular-nums">{formatUsd(toNum(t.total_usd),true)}</div>
                <div className="text-[10px] text-slate-600">{formatDate(t.date)} · {toNum(t.quantity).toLocaleString("es-UY",{maximumFractionDigits:6})} × {formatUsd(toNum(t.price))}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={()=>{setSaveErr(null);setEditing(t);}} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all"><Pencil className="w-3.5 h-3.5"/></button>
                <button onClick={()=>void handleDelete(t.id)} disabled={deletingId===t.id} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-rose-400 hover:bg-rose-400/10 transition-all disabled:opacity-40"><Trash2 className="w-3.5 h-3.5"/></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL */}
      <Modal open={!!editing} title="Editar operación" sub="Corrige el import en Supabase · KPIs se recalculan automáticamente" onClose={()=>setEditing(null)}>
        {editing&&(
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MField label="Fecha (YYYY-MM-DD)"><input value={editing.date} onChange={e=>setEditing({...editing,date:e.target.value})} placeholder="2025-12-20" style={INPUT_STYLE}/></MField>
              <MField label="Side"><select value={editing.side} onChange={e=>setEditing({...editing,side:e.target.value as "BUY"|"SELL"})} style={INPUT_STYLE}><option value="BUY">BUY</option><option value="SELL">SELL</option></select></MField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MField label="Cantidad"><input value={String(editing.quantity)} onChange={e=>setEditing({...editing,quantity:toNum(e.target.value)})} style={INPUT_STYLE}/></MField>
              <MField label="Precio (US$)"><input value={String(editing.price)} onChange={e=>setEditing({...editing,price:toNum(e.target.value)})} style={INPUT_STYLE}/></MField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MField label="Total (US$)" hint="Ideal: qty × precio"><input value={String(editing.total_usd)} onChange={e=>setEditing({...editing,total_usd:toNum(e.target.value)})} style={INPUT_STYLE}/></MField>
              <MField label="Fee (US$)"><input value={String(editing.fee_usd??0)} onChange={e=>setEditing({...editing,fee_usd:toNum(e.target.value)})} style={INPUT_STYLE}/></MField>
            </div>
            <MField label="Nota (opcional)"><input value={editing.note??""} onChange={e=>setEditing({...editing,note:e.target.value})} placeholder="Ej: compra fraccionada…" style={INPUT_STYLE}/></MField>
            {saveErr&&<div className="text-xs text-rose-400 rounded-xl px-3 py-2" style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)"}}>{saveErr}</div>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={()=>setEditing(null)} disabled={savingTrade} className="px-3 py-2 rounded-xl text-xs text-slate-500 transition-all" style={{border:"1px solid rgba(255,255,255,0.08)"}}>Cancelar</button>
              <button onClick={()=>void handleSave(editing)} disabled={savingTrade} className="px-5 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-60" style={{background:"linear-gradient(135deg,#0d9488,#2563eb)"}}>
                {savingTrade?"Guardando…":"Guardar cambios"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
