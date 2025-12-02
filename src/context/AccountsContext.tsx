"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSettings, type Currency } from "@/context/SettingsContext";

// ---------- Tipos ----------

export type Account = {
  id: string;
  name: string;       // Ej.: "Itaú", "Santander"
  currency: Currency; // Moneda nativa de la cuenta
  balance: number;    // En moneda nativa (solo local)
};

/**
 * Un solo tipo Movement con campos opcionales según el tipo:
 * - INGRESO / GASTO usan accountId (+ category opcional)
 * - TRANSFER usa fromId y toId
 */
export type Movement = {
  id: string;
  date: string; // yyyy-mm-dd
  type: "INGRESO" | "GASTO" | "TRANSFER";
  amount: number;
  currency: Currency;
  note?: string;

  category?: string; // Ej: "Sueldo", "Comida", "Entre cuentas"

  // INGRESO / GASTO
  accountId?: string;

  // TRANSFER
  fromId?: string;
  toId?: string;
};

export type MovementInput = Omit<Movement, "id">;

type AccountsCtx = {
  accounts: Account[];
  movements: Movement[];
  addAccount: (a: { name: string; currency: Currency }) => Promise<void>;
  addMovement: (m: MovementInput) => void;
  deleteMovement: (id: string) => void;
  getAccount: (id: string) => Account | undefined;
};

const Ctx = createContext<AccountsCtx | null>(null);

// ---------- Provider ----------

export function AccountsProvider({ children }: { children: React.ReactNode }) {
  const { convert } = useSettings();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

  // 1) Cargar de localStorage (por si el user entra offline)
  useEffect(() => {
    try {
      const a = localStorage.getItem("ctrl_accounts");
      const m = localStorage.getItem("ctrl_movs");
      if (a) setAccounts(JSON.parse(a));
      if (m) setMovements(JSON.parse(m));
    } catch {
      // ignorar errores de parseo
    }
  }, []);

  // 2) Cargar cuentas reales desde Supabase (si hay sesión)
  useEffect(() => {
    const loadFromServer = async () => {
      try {
        const res = await fetch("/api/accounts");

        if (!res.ok) {
          // 401 = usuario no autenticado → es normal en login / IP nueva
          if (res.status === 401) {
            // Si querés ver que pasa, podés descomentar:
            // console.warn("No hay sesión, no se cargan cuentas todavía");
            return;
          }

          // Otros códigos sí son errores reales
          console.error(
            "No se pudieron cargar cuentas desde el servidor:",
            await res.text()
          );
          return;
        }

        const json = await res.json();
        if (!json.accounts) return;

        const serverAccounts: Account[] = json.accounts.map((acc: any) => ({
          id: acc.id,
          name: acc.name,
          currency: acc.currency as Currency,
          balance: 0, // el balance sigue siendo un cálculo local
        }));

        setAccounts(serverAccounts);
      } catch (e) {
        console.error("Error al llamar /api/accounts:", e);
      }
    };

    loadFromServer();
  }, []);

  // Persistir en localStorage (cache / offline)
  useEffect(() => {
    try {
      localStorage.setItem("ctrl_accounts", JSON.stringify(accounts));
    } catch {
      // ignorar
    }
  }, [accounts]);

  useEffect(() => {
    try {
      localStorage.setItem("ctrl_movs", JSON.stringify(movements));
    } catch {
      // ignorar
    }
  }, [movements]);

  const getAccount = (id: string) => accounts.find((a) => a.id === id);

  // ---------- Cuentas ----------

  const addAccount: AccountsCtx["addAccount"] = async ({ name, currency }) => {
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, currency }),
      });

      if (!res.ok) {
        console.error("Error creando cuenta en Supabase:", await res.text());
        alert("No se pudo crear la cuenta en el servidor.");
        return;
      }

      const { account } = await res.json();

      setAccounts((prev) => [
        ...prev,
        {
          id: account.id,
          name: account.name,
          currency: account.currency as Currency,
          balance: 0,
        },
      ]);
    } catch (e) {
      console.error("Error en addAccount:", e);
      alert("Ocurrió un error al crear la cuenta.");
    }
  };

  // Helper para aplicar delta a una cuenta (conversión de moneda incluida)
  const applyDelta = (
    list: Account[],
    accountId: string | undefined,
    deltaInMovCurrency: number,
    movCurrency: Currency
  ) => {
    if (!accountId || !deltaInMovCurrency) return;
    const acc = list.find((a) => a.id === accountId);
    if (!acc) return;

    const deltaInAccCurrency = convert(deltaInMovCurrency, {
      from: movCurrency,
      to: acc.currency,
    });
    acc.balance = +(acc.balance + deltaInAccCurrency).toFixed(2);
  };

  // ---------- Movimientos (solo local) ----------

  const addMovement: AccountsCtx["addMovement"] = (m) => {
    const full: Movement = { id: crypto.randomUUID(), ...m };

    // 1) Guardar movimiento
    setMovements((prev) => [full, ...prev]);

    // 2) Impactar saldos
    setAccounts((prev) => {
      const next = [...prev];

      if (full.type === "INGRESO") {
        applyDelta(next, full.accountId, +full.amount, full.currency);
      } else if (full.type === "GASTO") {
        applyDelta(next, full.accountId, -Math.abs(full.amount), full.currency);
      } else if (full.type === "TRANSFER") {
        // Resta origen / suma destino
        applyDelta(next, full.fromId, -Math.abs(full.amount), full.currency);
        applyDelta(next, full.toId, +Math.abs(full.amount), full.currency);
      }

      return next;
    });
  };

  const deleteMovement: AccountsCtx["deleteMovement"] = (id) => {
    const mov = movements.find((m) => m.id === id);
    if (!mov) return;

    // Revertir impacto en cuentas
    setAccounts((prev) => {
      const next = [...prev];

      if (mov.type === "INGRESO") {
        applyDelta(next, mov.accountId, -mov.amount, mov.currency);
      } else if (mov.type === "GASTO") {
        applyDelta(next, mov.accountId, +Math.abs(mov.amount), mov.currency);
      } else if (mov.type === "TRANSFER") {
        // Invertimos la lógica: sumamos en origen y restamos en destino
        applyDelta(next, mov.fromId, +Math.abs(mov.amount), mov.currency);
        applyDelta(next, mov.toId, -Math.abs(mov.amount), mov.currency);
      }

      return next;
    });

    // Eliminar movimiento de la lista
    setMovements((prev) => prev.filter((m) => m.id !== id));
  };

  const value = useMemo(
    () => ({
      accounts,
      movements,
      addAccount,
      addMovement,
      deleteMovement,
      getAccount,
    }),
    [accounts, movements]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ---------- Hook ----------

export function useAccounts() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useAccounts must be used within AccountsProvider");
  }
  return ctx;
}
