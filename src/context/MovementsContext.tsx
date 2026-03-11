// src/context/MovementsContext.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

export type MovementTypeFront = "INGRESO" | "GASTO";

export type Movement = {
  id: string;
  date: string;
  type: MovementTypeFront;
  category: string | null;
  amount: number;
  currency: string;
  accountId: string | null;
  description: string | null;
  createdAt: string;
};

export type NewMovementInput = {
  date: string;
  type: MovementTypeFront;
  category?: string;
  amount: number;
  currency: string;
  accountId?: string | null;
  description?: string;
};

type MovementsContextValue = {
  movements: Movement[];
  loading: boolean;
  error: string | null;
  refreshMovements: () => Promise<void>;
  addMovement: (input: NewMovementInput) => Promise<Movement | null>;
};

const MovementsContext = createContext<MovementsContextValue | undefined>(undefined);

function mapDbTypeToFront(dbType: string): MovementTypeFront {
  if (dbType === "INCOME")  return "INGRESO";
  if (dbType === "EXPENSE") return "GASTO";
  return dbType as MovementTypeFront;
}

function normalizeFromApi(row: any): Movement {
  return {
    id:          row.id,
    date:        row.date,
    type:        mapDbTypeToFront(row.type),
    category:    row.category    ?? null,
    amount:      Number(row.amount),
    currency:    row.currency,
    accountId:   row.account_id  ?? null,
    description: row.description ?? null,
    createdAt:   row.created_at  ?? "",
  };
}

export function MovementsProvider({ children }: { children: ReactNode }) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading]     = useState<boolean>(true);
  const [error, setError]         = useState<string | null>(null);

  const refreshMovements = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/movements");

      // ✅ Guard: sin sesión es normal en rutas públicas — no tirar error
      if (res.status === 401 || res.status === 307 || res.redirected) {
        setMovements([]);
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }

      const json = await res.json();
      const list = Array.isArray(json.movements) ? json.movements : [];
      setMovements(list.map(normalizeFromApi));

    } catch (e: any) {
      console.error("Error cargando movements:", e);
      setError(e?.message || "Error cargando movimientos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMovements();
  }, [refreshMovements]);

  const addMovement = useCallback(async (input: NewMovementInput): Promise<Movement | null> => {
    try {
      setError(null);

      const res = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date:        input.date,
          type:        input.type,
          category:    input.category    ?? null,
          amount:      input.amount,
          currency:    input.currency,
          accountId:   input.accountId   ?? null,
          description: input.description ?? null,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("Error POST /api/movements:", json);
        throw new Error(json.error || `Error ${res.status}`);
      }

      const movement = normalizeFromApi(json.movement);
      setMovements(prev => [movement, ...prev]);
      return movement;

    } catch (e: any) {
      console.error("Error agregando movimiento:", e);
      setError(e?.message || "Error agregando movimiento");
      return null;
    }
  }, []);

  return (
    <MovementsContext.Provider value={{ movements, loading, error, refreshMovements, addMovement }}>
      {children}
    </MovementsContext.Provider>
  );
}

export function useMovements() {
  const ctx = useContext(MovementsContext);
  if (!ctx) throw new Error("useMovements debe usarse dentro de <MovementsProvider>");
  return ctx;
}
