"use client";

import { useMemo, useState } from "react";
import { useGoals } from "@/context/GoalsContext";
import { useSettings } from "@/context/SettingsContext";

type Props = {
  accountId: string;
};

export default function AccountGoals({ accountId }: Props) {
  const { goals, getGoalsByAccount, createGoal, addToGoalAmount, deleteGoal } =
    useGoals();
  const { format } = useSettings();
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");

  const accountGoals = useMemo(
    () => getGoalsByAccount(accountId),
    [goals, accountId, getGoalsByAccount]
  );

  const handleCreate = () => {
    const t = Number(target.replace(",", "."));
    if (!label.trim() || !(t > 0)) return;
    createGoal({ accountId, label: label.trim(), targetAmount: t, deadline });
    setLabel("");
    setTarget("");
    setDeadline("");
  };

  const handleAdd = (id: string) => {
    const amountStr = prompt("¿Cuánto vas a aportar a este objetivo?");
    if (!amountStr) return;
    const a = Number(amountStr.replace(",", "."));
    if (!(a !== 0)) return;
    addToGoalAmount(id, a);
  };

  return (
    <div className="mt-4 bg-[#020617] border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-100">
          Objetivos de ahorro de esta cuenta
        </h3>
      </div>

      {/* Lista de objetivos */}
      {accountGoals.length === 0 ? (
        <p className="text-xs text-slate-500 mb-3">
          Todavía no tienes objetivos asociados a esta cuenta.
        </p>
      ) : (
        <ul className="space-y-2 mb-3 text-xs">
          {accountGoals.map((g) => {
            const progress =
              g.targetAmount > 0
                ? Math.min(100, (g.currentAmount / g.targetAmount) * 100)
                : 0;

            return (
              <li
                key={g.id}
                className="bg-[#020617] border border-slate-800 rounded-lg p-2 flex flex-col gap-1"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-slate-100">
                      {g.label}
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      Meta: {format(g.targetAmount)} · Actual:{" "}
                      {format(g.currentAmount)} (
                      {progress.toFixed(1)}
                      %)
                      {g.deadline && (
                        <> · Límite: {new Date(g.deadline).toLocaleDateString()}</>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleAdd(g.id)}
                      className="px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-[11px] text-white"
                    >
                      + Aportar
                    </button>
                    <button
                      onClick={() => deleteGoal(g.id)}
                      className="px-2 py-1 rounded border border-slate-700 text-[11px] text-slate-300 hover:bg-slate-800/60"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                {/* Barra de progreso simple */}
                <div className="mt-1 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Formulario mini para crear objetivo */}
      <div className="border-t border-slate-800 pt-3 mt-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ej: Auto, PC nueva, Vacaciones"
            className="bg-[#020617] border border-slate-700 rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-sky-600"
          />
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Meta (monto)"
            inputMode="decimal"
            className="bg-[#020617] border border-slate-700 rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-sky-600"
          />
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="bg-[#020617] border border-slate-700 rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-sky-600"
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleCreate}
            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-[12px] text-white"
          >
            Añadir objetivo
          </button>
        </div>
      </div>
    </div>
  );
}
