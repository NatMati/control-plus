import Link from "next/link";
import {
  createTermDeposit,
  getTermDeposits,
  completeTermDeposit,
  TermDeposit,
} from "./actions";

// ------------------------------
//   Helpers locales al componente
// ------------------------------
function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-UY");
}

// Cálculo del monto estimado final (YA NO ES SERVER ACTION)
function estimateFinalAmount(
  principal: number,
  rate_annual: number,
  start_date: string,
  end_date: string
) {
  const MS_DAY = 1000 * 60 * 60 * 24;

  const start = new Date(start_date);
  const end = new Date(end_date);

  const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / MS_DAY));
  const years = days / 365;

  const final = principal * Math.pow(1 + rate_annual / 100, years);
  return Number(final.toFixed(2));
}

// ------------------------------
//         PAGE COMPONENT
// ------------------------------
export default async function TermDepositsPage() {
  const deposits = await getTermDeposits();

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plazo fijo</h1>
          <p className="text-sm text-slate-400">
            Registrá tus plazos fijos para ver su evolución. No es una recomendación de inversión.
          </p>
        </div>

        <Link href="/inversiones" className="text-xs text-sky-400 hover:underline">
          ← Volver a inversiones
        </Link>
      </div>

      {/* Formulario */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <h2 className="text-sm font-semibold mb-3">Nuevo plazo fijo</h2>

        <form
          action={createTermDeposit}
          className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs"
        >
          <div>
            <label className="block mb-1 text-slate-400">Capital</label>
            <input
              name="principal"
              type="number"
              step="0.01"
              required
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1"
            />
          </div>

          <div>
            <label className="block mb-1 text-slate-400">Tasa anual (%)</label>
            <input
              name="rate_annual"
              type="number"
              step="0.01"
              required
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1"
            />
          </div>

          <div>
            <label className="block mb-1 text-slate-400">Meses</label>
            <input
              name="months"
              type="number"
              min={1}
              required
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1"
            />
          </div>

          <div>
            <label className="block mb-1 text-slate-400">Moneda</label>
            <select
              name="currency"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="UYU">UYU</option>
              <option value="ARS">ARS</option>
              <option value="BRL">BRL</option>
            </select>
          </div>

          <div>
            <label className="block mb-1 text-slate-400">Fecha de inicio</label>
            <input
              name="start_date"
              type="date"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1"
            />
          </div>

          <div>
            <label className="block mb-1 text-slate-400">Cuenta (account_id)</label>
            <input
              name="account_id"
              type="text"
              required
              placeholder="uuid de la cuenta"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1"
            />
          </div>

          <div className="md:col-span-3 flex justify-end pt-1">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#3b82f6] hover:bg-blue-500 text-white text-sm"
            >
              Guardar plazo fijo
            </button>
          </div>
        </form>
      </div>

      {/* Listado */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Plazos fijos registrados</h2>
          <span className="text-[11px] text-slate-500">
            {deposits.length === 0
              ? "Todavía no registraste plazos fijos."
              : `${deposits.length} plazo(s) fijo(s)`}
          </span>
        </div>

        {deposits.length === 0 ? (
          <p className="text-xs text-slate-500">
            Cuando registres tus plazos fijos aparecerán aquí.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-2 pr-2 text-left">Inicio</th>
                  <th className="py-2 pr-2 text-left">Fin</th>
                  <th className="py-2 pr-2 text-right">Capital</th>
                  <th className="py-2 pr-2 text-right">Tasa</th>
                  <th className="py-2 pr-2 text-right">Final estimado</th>
                  <th className="py-2 pr-2 text-center">Estado</th>
                  <th className="py-2 pr-2 text-right">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {deposits.map((d) => {
                  const finalAmount = estimateFinalAmount(
                    Number(d.principal),
                    Number(d.rate_annual),
                    d.start_date,
                    d.end_date
                  );

                  const matured = d.end_date <= today && d.status === "active";

                  return (
                    <tr key={d.id} className="border-b border-slate-900/60">
                      <td className="py-1.5">{formatDate(d.start_date)}</td>
                      <td className="py-1.5">{formatDate(d.end_date)}</td>

                      <td className="py-1.5 text-right">
                        {formatCurrency(Number(d.principal), d.currency)}
                      </td>

                      <td className="py-1.5 text-right">{d.rate_annual}%</td>

                      <td className="py-1.5 text-right">
                        {formatCurrency(finalAmount, d.currency)}
                      </td>

                      <td className="py-1.5 text-center">
                        <span
                          className={
                            "px-2 py-0.5 rounded-full text-[11px] " +
                            (d.status === "completed"
                              ? "bg-emerald-900/40 text-emerald-300"
                              : d.status === "active"
                              ? "bg-sky-900/40 text-sky-300"
                              : "bg-slate-800 text-slate-300")
                          }
                        >
                          {d.status.toUpperCase()}
                        </span>
                      </td>

                      <td className="py-1.5 text-right">
                        {matured ? (
                          <form
                            action={async () => {
                              "use server";
                              await completeTermDeposit(d.id);
                            }}
                          >
                            <button className="text-emerald-400 hover:underline text-[11px]">
                              Marcar como completado
                            </button>
                          </form>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
