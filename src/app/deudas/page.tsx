// src/app/deudas/page.tsx
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSettings, Currency } from "@/context/SettingsContext";

type DebtStatus = "activa" | "pagada" | "vencida" | "próxima";

type Debt = {
  id: string;
  name: string;
  account: string;
  total: number;
  currency: Currency;
  monthlyPayment: number;
  nextDueDate: string; // ISO string
  status: DebtStatus;
};

// Por ahora usamos un arreglo vacío. Más adelante esto vendrá de un DebtsContext o de la API.
const MOCK_DEBTS: Debt[] = [];

export default function DeudasPage() {
  const { currency, convert, format } = useSettings();

  const { debts, totalBase, thisMonthInstallmentsBase, paidBase } = useMemo(() => {
    const debts: Debt[] = MOCK_DEBTS;

    let totalBase = 0;
    let thisMonthInstallmentsBase = 0;
    let paidBase = 0;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11

    for (const d of debts) {
      const totalInBase = convert(d.total, { from: d.currency, to: currency });
      totalBase += totalInBase;

      const installmentInBase = convert(d.monthlyPayment, {
        from: d.currency,
        to: currency,
      });

      if (d.status === "pagada") {
        paidBase += totalInBase;
      }

      // Cuotas de este mes: aproximación simple por ahora
      const due = new Date(d.nextDueDate);
      if (
        due.getFullYear() === currentYear &&
        due.getMonth() === currentMonth &&
        d.status !== "pagada"
      ) {
        thisMonthInstallmentsBase += installmentInBase;
      }
    }

    return { debts, totalBase, thisMonthInstallmentsBase, paidBase };
  }, [currency, convert]);

  return (
    <div className="p-6 space-y-6">
      {/* Título y descripción */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Deudas</h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Aquí podrá ver sus deudas, cuotas pendientes y cuánto queda por pagar en total.
            Más adelante conectaremos esta sección con sus movimientos y un plan de pagos
            más detallado.
          </p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <span className="text-xs px-2 py-1 rounded-full bg-slate-800/60 text-slate-300">
            Mostrando en: <span className="font-semibold">{currency}</span>
          </span>

          <Link
            href="/deudas/nueva-deuda"
            className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
          >
            Registrar deuda
          </Link>
        </div>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total de deuda */}
        <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
          <div className="text-xs text-slate-400 mb-2">Total de deuda</div>
          <div className="text-2xl font-semibold">{format(totalBase)}</div>
          <div className="mt-2 text-xs text-slate-500">
            Suma de todas las deudas activas, convertidas a {currency}.
          </div>
        </div>

        {/* Cuotas este mes */}
        <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
          <div className="text-xs text-slate-400 mb-2">Cuotas este mes</div>
          <div className="text-2xl font-semibold">
            {format(thisMonthInstallmentsBase)}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Monto estimado a pagar en el mes actual, según las cuotas registradas.
          </div>
        </div>

        {/* Deudas pagadas (histórico) */}
        <div className="rounded-xl border border-slate-800 bg-[#0f1830] p-4">
          <div className="text-xs text-slate-400 mb-2">Deudas pagadas</div>
          <div className="text-2xl font-semibold">{format(paidBase)}</div>
          <div className="mt-2 text-xs text-slate-500">
            Monto histórico de deudas marcadas como pagadas. Más adelante podrá verse el
            detalle y el historial.
          </div>
        </div>
      </div>

      {/* Tabla principal */}
      <div className="rounded-xl border border-slate-800 bg-[#0f1830] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Listado de deudas</div>
            <div className="text-xs text-slate-500">
              Aquí verá cada deuda con su cuenta, monto total, cuota mensual y vencimiento.
            </div>
          </div>
        </div>

        {/* Encabezados tabla */}
        <div className="grid grid-cols-12 px-4 py-3 text-xs uppercase tracking-wide text-slate-400 border-b border-slate-800">
          <div className="col-span-3">Deuda</div>
          <div className="col-span-2">Cuenta</div>
          <div className="col-span-2 text-right">Monto total</div>
          <div className="col-span-2 text-right">Cuota</div>
          <div className="col-span-2">Vencimiento</div>
          <div className="col-span-1 text-right">Estado</div>
        </div>

        {debts.length === 0 ? (
          <div className="p-6 text-sm text-slate-400">
            Todavía no registró deudas. Más adelante vamos a conectar esta sección con el
            registro de movimientos y un formulario específico para crear deudas
            (préstamos, tarjetas, créditos, etc.).
          </div>
        ) : (
          debts.map((d) => (
            <div
              key={d.id}
              className="grid grid-cols-12 px-4 py-3 border-b border-slate-900/40 text-sm"
            >
              <div className="col-span-3 text-slate-200">{d.name}</div>
              <div className="col-span-2 text-slate-300">{d.account}</div>
              <div className="col-span-2 text-right text-slate-200">
                {format(convert(d.total, { from: d.currency, to: currency }))}
                <span className="ml-1 text-xs text-slate-500">({d.currency})</span>
              </div>
              <div className="col-span-2 text-right text-slate-300">
                {format(convert(d.monthlyPayment, { from: d.currency, to: currency }))}
              </div>
              <div className="col-span-2 text-slate-300">
                {formatDate(d.nextDueDate)}
              </div>
              <div className="col-span-1 text-right">
                <StatusPill status={d.status} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bloque futuro: plan de pagos / próximos vencimientos */}
      <div className="rounded-xl border border-dashed border-slate-800 bg-[#050816] p-4">
        <div className="text-sm font-medium mb-1">
          Plan de pagos y próximos vencimientos (próximamente)
        </div>
        <p className="text-xs text-slate-400 max-w-2xl">
          En esta sección podrá ver un calendario de próximos vencimientos, simulaciones de
          pago anticipado y un resumen de cómo impactan las cuotas en su flujo de caja
          mensual. Más adelante la conectaremos con sus movimientos reales.
        </p>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";

  const day = String(d.getDate()).padStart(2, "0");
  const months = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function StatusPill({ status }: { status: DebtStatus }) {
  const base =
    "inline-flex items-center justify-end px-2 py-0.5 rounded-full text-[11px] font-medium";

  switch (status) {
    case "activa":
      return (
        <span className={`${base} bg-emerald-500/15 text-emerald-300`}>
          Activa
        </span>
      );
    case "pagada":
      return (
        <span className={`${base} bg-slate-500/20 text-slate-200`}>
          Pagada
        </span>
      );
    case "vencida":
      return (
        <span className={`${base} bg-red-500/20 text-red-300`}>
          Vencida
        </span>
      );
    case "próxima":
    default:
      return (
        <span className={`${base} bg-amber-500/20 text-amber-300`}>
          Próximo vencimiento
        </span>
      );
  }
}
