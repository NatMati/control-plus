// src/app/movimientos/detalles/MovimientosDetallesClient.tsx
"use client";

import Link from "next/link";
import ImportCsv from "../ImportCsv";
import MovimientosClient from "../MovimientosClient";
import type { UIMovement } from "../MovimientosDashboardClient";

export default function MovimientosDetallesClient({
  initialMovements,
}: {
  initialMovements: UIMovement[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Movimientos - Detalles</h1>
          <p className="text-sm text-white/60">Tabla completa, filtros y acciones.</p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/movimientos"
            className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm"
          >
            Volver
          </Link>
          <Link
            href="/movimientos/nuevo"
            className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm"
          >
            Registrar
          </Link>
        </div>
      </div>

      <ImportCsv />
      <MovimientosClient initialMovements={initialMovements} />
    </div>
  );
}
