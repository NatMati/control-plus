// src/app/deudas/nueva-deuda/page.tsx
"use client";

import Link from "next/link";
import { FormEvent } from "react";
import { useSettings } from "@/context/SettingsContext";

export default function NuevaDeudaPage() {
  const { currency } = useSettings();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    const payload = {
      name: (formData.get("name") || "").toString().trim(),
      account: (formData.get("account") || "").toString().trim(),
      total: Number(formData.get("total") || 0),
      monthlyPayment: Number(formData.get("monthlyPayment") || 0),
      currency: (formData.get("currency") || "").toString(),
      firstDueDate: (formData.get("firstDueDate") || "").toString(),
      note: (formData.get("note") || "").toString().trim(),
    };

    // Por ahora solo mostramos en consola. En el paso 2 lo guardaremos en un contexto o API.
    console.log("Nueva deuda (demo):", payload);
    alert(
      "Todavía estamos preparando el guardado real de deudas.\n" +
        "Por ahora el formulario solo es demostrativo."
    );
  };

  // Fecha por defecto: hoy
  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Volver */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Nueva deuda</h1>
          <Link
            href="/deudas"
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← Volver a Deudas
          </Link>
        </div>

        <p className="text-sm text-slate-400 max-w-2xl">
          Defina el nombre de la deuda, la cuenta, el monto total, la cuota mensual y la
          fecha del primer vencimiento. Más adelante podrá ver y seguir esta deuda desde
          la sección de Deudas.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-2 rounded-xl border border-slate-800 bg-[#050816] shadow-sm p-6 space-y-6"
        >
          {/* Línea 1: nombre + cuenta */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nombre de la deuda <span className="text-red-400">*</span>
              </label>
              <input
                name="name"
                required
                placeholder="Ej.: Préstamo auto, Tarjeta VISA, Multa tránsito..."
                className="w-full rounded-lg border border-slate-700 bg-[#020617] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Cuenta / entidad <span className="text-red-400">*</span>
              </label>
              <input
                name="account"
                required
                placeholder="Ej.: Banco Itaú, Tarjeta Midinero, Santander..."
                className="w-full rounded-lg border border-slate-700 bg-[#020617] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Línea 2: monto total + cuota + moneda */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Monto total <span className="text-red-400">*</span>
              </label>
              <input
                name="total"
                type="number"
                min="0"
                step="0.01"
                required
                className="w-full rounded-lg border border-slate-700 bg-[#020617] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0,00"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Cuota mensual <span className="text-red-400">*</span>
              </label>
              <input
                name="monthlyPayment"
                type="number"
                min="0"
                step="0.01"
                required
                className="w-full rounded-lg border border-slate-700 bg-[#020617] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0,00"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Moneda <span className="text-red-400">*</span>
              </label>
              <select
                name="currency"
                defaultValue={currency}
                className="w-full rounded-lg border border-slate-700 bg-[#020617] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="USD">USD</option>
                <option value="UYU">UYU</option>
                <option value="EUR">EUR</option>
                <option value="ARS">ARS</option>
                <option value="BRL">BRL</option>
              </select>
            </div>
          </div>

          {/* Línea 3: primer vencimiento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Fecha del primer vencimiento <span className="text-red-400">*</span>
              </label>
              <input
                name="firstDueDate"
                type="date"
                required
                defaultValue={todayISO}
                className="w-full rounded-lg border border-slate-700 bg-[#020617] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Más adelante utilizaremos esta fecha para calcular las cuotas del mes y los
                próximos vencimientos.
              </p>
            </div>
          </div>

          {/* Nota */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Nota (opcional)
            </label>
            <textarea
              name="note"
              rows={3}
              placeholder="Detalle breve: condiciones del préstamo, tasa, comentarios, etc."
              className="w-full rounded-lg border border-slate-700 bg-[#020617] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-2">
            <Link
              href="/deudas"
              className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-medium border border-slate-700 text-slate-200 bg-transparent hover:bg-slate-800/60 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
            >
              Guardar deuda
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
