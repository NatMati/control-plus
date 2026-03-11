"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, X, BarChart2 } from "lucide-react";
import { type CalendarDaySummary } from "@/lib/reports/getMonthlyCalendarSummary";

// ─── TIPOS ────────────────────────────────────────────────────────────────────
type InvestmentDay = {
  date: string;           // "YYYY-MM-DD"
  portfolioValue: number; // valor total de cartera ese día
  dailyReturn: number;    // % de cambio vs día anterior
  dailyPnl: number;       // cambio en $ vs día anterior
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmtMoney(n: number, compact = false) {
  const abs = Math.abs(n), sign = n < 0 ? "-" : "";
  if (compact && abs >= 1_000_000) return `${sign}$${(abs/1_000_000).toFixed(1)}M`;
  if (compact && abs >= 1_000)     return `${sign}$${(abs/1_000).toFixed(1)}k`;
  return `${sign}$${abs.toLocaleString("es-UY",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}
function fmtPct(n: number) { return `${n>=0?"+":""}${n.toFixed(2)}%`; }
function parseDay(iso: string) {
  const [y,m,d] = iso.split("-").map(Number);
  return new Date(y, m-1, d);
}
function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ─── HOOK: carga rendimiento de inversiones por día ───────────────────────────
function useInvestmentData(year: number, month: number, enabled: boolean) {
  const [data, setData]       = useState<InvestmentDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string|null>(null);

  useEffect(() => {
    if (!enabled) { setData([]); return; }
    const ctrl = new AbortController();
    (async () => {
      try {
        setLoading(true); setError(null);
        // Rango: primer y último día del mes
        const firstDay = `${year}-${String(month).padStart(2,"0")}-01`;
        const lastDate = new Date(year, month, 0);
        const lastDay  = toIso(lastDate);

        // Usamos la misma API de history que ya existe
        // Pedimos snapshot de cartera — endpoint más probable en tu app:
        const res = await fetch(
          `/api/investments/portfolio-history?from=${firstDay}&to=${lastDay}`,
          { signal: ctrl.signal }
        );
        if (!res.ok) { setError(`Error ${res.status}`); return; }
        const json = await res.json();
        // Esperamos { days: [{ date, portfolio_value, daily_return_pct, daily_pnl }] }
        const raw: any[] = json.days ?? json.points ?? [];
        const parsed: InvestmentDay[] = raw.map(p => ({
          date: String(p.date ?? "").slice(0, 10),
          portfolioValue: Number(p.portfolio_value ?? p.value ?? 0),
          dailyReturn:    Number(p.daily_return_pct ?? p.daily_return ?? p.change_pct ?? 0),
          dailyPnl:       Number(p.daily_pnl ?? p.pnl ?? 0),
        })).filter(p => p.date.length === 10);
        setData(parsed);
      } catch(e:any) {
        if (e?.name !== "AbortError") setError("No se pudo cargar rendimiento de inversiones.");
      } finally {
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [enabled, year, month]);

  return { data, loading, error };
}

// ─── MODAL DETALLE DÍA ────────────────────────────────────────────────────────
function DayModal({ day, income, expense, net, inv, onClose }: {
  day: string; income: number; expense: number; net: number;
  inv: InvestmentDay | null; onClose: () => void;
}) {
  const d = parseDay(day);
  const label = d.toLocaleDateString("es-UY", { weekday:"long", day:"numeric", month:"long" });
  const hasFinancial = income > 0 || expense > 0;
  const hasInv = inv != null && (inv.portfolioValue > 0 || inv.dailyPnl !== 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{background:"rgba(0,0,0,0.65)",backdropFilter:"blur(6px)"}}
      onClick={onClose}>
      <div className="rounded-2xl w-full max-w-[320px] shadow-2xl overflow-hidden"
        style={{background:"rgba(2,6,23,0.98)",border:"1px solid rgba(255,255,255,0.12)"}}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
          <div>
            <div className="text-sm font-bold text-white capitalize">{label}</div>
            <div className="text-[11px] text-slate-600 mt-0.5">Resumen del día</div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-600 hover:text-white hover:bg-white/5 transition-all">
            <X className="w-3.5 h-3.5"/>
          </button>
        </div>

        {/* Cuerpo */}
        <div className="px-5 py-4 space-y-4">
          {/* Flujo financiero */}
          {hasFinancial ? (
            <div>
              <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-2">Flujo del día</div>
              <div className="space-y-1.5">
                {income > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>
                      <span className="text-xs text-slate-400">Ingresos</span>
                    </div>
                    <span className="text-sm font-bold text-emerald-400 tabular-nums">{fmtMoney(income)}</span>
                  </div>
                )}
                {expense > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-400"/>
                      <span className="text-xs text-slate-400">Gastos</span>
                    </div>
                    <span className="text-sm font-bold text-rose-400 tabular-nums">{fmtMoney(expense)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 mt-1"
                  style={{borderTop:"1px solid rgba(255,255,255,0.06)"}}>
                  <span className="text-xs font-medium text-slate-400">Resultado neto</span>
                  <span className={`text-sm font-bold tabular-nums ${net>=0?"text-emerald-400":"text-rose-400"}`}>{fmtMoney(net)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-700 italic">Sin movimientos financieros este día.</div>
          )}

          {/* Inversiones */}
          {hasInv && (
            <div style={{borderTop:"1px solid rgba(255,255,255,0.06)"}} className="pt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <BarChart2 className="w-3 h-3 text-sky-400"/>
                <div className="text-[10px] text-slate-600 uppercase tracking-widest">Cartera de inversiones</div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Valor cartera</span>
                  <span className="text-sm font-bold text-white tabular-nums">{fmtMoney(inv!.portfolioValue, true)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Variación del día</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-semibold tabular-nums ${inv!.dailyReturn>=0?"text-emerald-400":"text-rose-400"}`}>
                      {fmtPct(inv!.dailyReturn)}
                    </span>
                    <span className={`text-[11px] tabular-nums ${inv!.dailyPnl>=0?"text-emerald-400/70":"text-rose-400/70"}`}>
                      ({fmtMoney(inv!.dailyPnl, true)})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PILL TOGGLE ──────────────────────────────────────────────────────────────
function Toggle({ on, onClick, children }: { on: boolean; onClick: ()=>void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all"
      style={{
        background: on ? "rgba(96,165,250,0.1)" : "rgba(255,255,255,0.04)",
        border: on ? "1px solid rgba(96,165,250,0.3)" : "1px solid rgba(255,255,255,0.07)",
        color: on ? "#60a5fa" : "rgba(148,163,184,0.6)",
      }}>
      {children}
    </button>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function MonthlyCalendarGrid({
  days, year, month, isPremium = true,
}: {
  days: CalendarDaySummary[];
  year: number; month: number;
  isPremium?: boolean;
}) {
  const [selectedDay, setSelectedDay] = useState<CalendarDaySummary|null>(null);
  const [showInv, setShowInv] = useState(false);
  const { data: invData, loading: invLoading, error: invError } = useInvestmentData(year, month, showInv && isPremium);

  const invByDate = useMemo(() => {
    const map = new Map<string, InvestmentDay>();
    for (const d of invData) map.set(d.date, d);
    return map;
  }, [invData]);

  if (!days || days.length === 0) {
    return (
      <div className="rounded-2xl flex items-center justify-center py-16 text-sm text-slate-600"
        style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)"}}>
        No hay movimientos este mes.
      </div>
    );
  }

  const firstDate = parseDay(days[0].day);
  const firstWeekDay = (firstDate.getDay() + 6) % 7; // Lun=0
  const placeholders = Array.from({ length: firstWeekDay });

  // Máximos para escalar intensidad
  const maxInc = Math.max(...days.map(d=>Number(d.total_income)||0), 1);
  const maxExp = Math.max(...days.map(d=>Number(d.total_expense)||0), 1);
  const todayIso = toIso(new Date());

  const selectedInv = selectedDay ? invByDate.get(selectedDay.day) ?? null : null;

  return (
    <>
      {/* Modal detalle */}
      {selectedDay && (
        <DayModal
          day={selectedDay.day}
          income={Number(selectedDay.total_income)||0}
          expense={Number(selectedDay.total_expense)||0}
          net={Number(selectedDay.net_result)||0}
          inv={selectedInv}
          onClose={()=>setSelectedDay(null)}
        />
      )}

      <div className="rounded-2xl overflow-hidden"
        style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)"}}>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3"
          style={{borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
          <div className="flex items-center gap-4 text-[11px] text-slate-600">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 opacity-70"/>Día positivo</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400 opacity-70"/>Día negativo</span>
            {showInv && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-400 opacity-70"/>Inversiones</span>}
          </div>
          {isPremium && (
            <Toggle on={showInv} onClick={()=>setShowInv(v=>!v)}>
              <BarChart2 className="w-3 h-3"/>
              {showInv ? "Ocultar inversiones" : "Ver inversiones"}
              {invLoading && <span className="ml-1 text-sky-400/50">…</span>}
            </Toggle>
          )}
        </div>

        {/* Error inversiones */}
        {invError && (
          <div className="px-4 py-2 text-[11px] text-rose-400"
            style={{background:"rgba(239,68,68,0.06)",borderBottom:"1px solid rgba(239,68,68,0.15)"}}>
            {invError}
          </div>
        )}

        {/* Encabezados días */}
        <div className="grid grid-cols-7 text-[10px] uppercase tracking-widest text-slate-600 px-3 pt-3 pb-1.5">
          {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(d=>(
            <div key={d} className="text-center font-medium">{d}</div>
          ))}
        </div>

        {/* Grilla */}
        <div className="grid grid-cols-7 gap-1 p-2">
          {placeholders.map((_,i)=>(
            <div key={`ph-${i}`} className="rounded-xl" style={{background:"transparent",minHeight:88}}/>
          ))}

          {days.map(day => {
            const d = parseDay(day.day).getDate();
            const income  = Number(day.total_income)  || 0;
            const expense = Number(day.total_expense) || 0;
            const net     = Number(day.net_result)    || 0;
            const hasActivity = income > 0 || expense > 0;
            const isToday = day.day === todayIso;
            const inv = invByDate.get(day.day);
            const hasInv = showInv && inv != null && (inv.portfolioValue > 0 || inv.dailyPnl !== 0);

            // Intensidad proporcional
            const incI = hasActivity ? Math.min(income/maxInc, 1) : 0;
            const expI = hasActivity ? Math.min(expense/maxExp, 1) : 0;

            let bg = "rgba(255,255,255,0.015)";
            let border = "rgba(255,255,255,0.04)";
            if (hasActivity) {
              if (net >= 0) {
                bg = `rgba(52,211,153,${(0.03+incI*0.1).toFixed(3)})`;
                border = `rgba(52,211,153,${(0.08+incI*0.22).toFixed(3)})`;
              } else {
                bg = `rgba(248,113,113,${(0.03+expI*0.1).toFixed(3)})`;
                border = `rgba(248,113,113,${(0.08+expI*0.22).toFixed(3)})`;
              }
            }
            if (isToday) border = "rgba(96,165,250,0.5)";

            return (
              <button key={day.day}
                onClick={()=>(hasActivity||hasInv)?setSelectedDay(day):undefined}
                className="relative rounded-xl p-2 text-left flex flex-col transition-all"
                style={{
                  background: bg,
                  border: `1px solid ${border}`,
                  cursor: (hasActivity||hasInv) ? "pointer" : "default",
                  minHeight: 88,
                }}
                onMouseEnter={e=>{if(hasActivity||hasInv)e.currentTarget.style.filter="brightness(1.2)";}}
                onMouseLeave={e=>e.currentTarget.style.filter="none"}>

                {/* Día + indicador hoy */}
                <div className="flex items-start justify-between mb-1.5">
                  <span className={`text-xs font-bold tabular-nums leading-none ${
                    isToday ? "text-sky-400" :
                    hasActivity ? (net>=0?"text-emerald-300":"text-rose-300") :
                    "text-slate-700"
                  }`}>{d}</span>
                  {isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-0.5"/>
                  )}
                </div>

                {/* Contenido financiero */}
                {hasActivity && (
                  <div className="flex flex-col gap-1 flex-1">
                    {income > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="h-0.5 flex-1 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.07)"}}>
                          <div className="h-full rounded-full bg-emerald-400" style={{width:`${(income/maxInc)*100}%`,opacity:0.75}}/>
                        </div>
                        <span className="text-[9px] text-emerald-400 tabular-nums shrink-0 leading-none font-medium">{fmtMoney(income, true)}</span>
                      </div>
                    )}
                    {expense > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="h-0.5 flex-1 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.07)"}}>
                          <div className="h-full rounded-full bg-rose-400" style={{width:`${(expense/maxExp)*100}%`,opacity:0.75}}/>
                        </div>
                        <span className="text-[9px] text-rose-400 tabular-nums shrink-0 leading-none font-medium">{fmtMoney(expense, true)}</span>
                      </div>
                    )}
                    <div className={`text-[9px] font-bold tabular-nums leading-none mt-auto ${net>=0?"text-emerald-400":"text-rose-400"}`}>
                      {net>=0?"+":""}{fmtMoney(net, true)}
                    </div>
                  </div>
                )}

                {/* Capa inversiones */}
                {hasInv && (
                  <div className="mt-1 pt-1 flex items-center gap-1"
                    style={{borderTop:"1px solid rgba(96,165,250,0.15)"}}>
                    {inv!.dailyReturn >= 0
                      ? <TrendingUp className="w-2.5 h-2.5 text-sky-400 shrink-0"/>
                      : <TrendingDown className="w-2.5 h-2.5 text-rose-400 shrink-0"/>
                    }
                    <span className={`text-[9px] font-bold tabular-nums leading-none ${inv!.dailyReturn>=0?"text-sky-400":"text-rose-400"}`}>
                      {fmtPct(inv!.dailyReturn)}
                    </span>
                  </div>
                )}

                {/* Sin actividad */}
                {!hasActivity && !hasInv && (
                  <div className="flex-1"/>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 flex items-center justify-between text-[10px] text-slate-700"
          style={{borderTop:"1px solid rgba(255,255,255,0.04)"}}>
          <span>Tocá un día con actividad para ver detalle</span>
          {isPremium && !showInv && (
            <span className="text-slate-700">Activá "Ver inversiones" para superponer rendimiento diario</span>
          )}
        </div>
      </div>
    </>
  );
}
