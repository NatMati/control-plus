// src/app/api/investments/import-csv/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type InvestmentCsvRow = {
  date?: string;
  symbol?: string;
  side?: string;
  quantity?: number | string;
  price?: number | string;
  totalUsd?: number | string;
  feeUsd?: number | string;
  realizedPnlUsd?: number | string;
  note?: string;
  externalId?: string | null;

  // Compat con tu CSV de Google Sheets
  Fecha?: string;
  Activo?: string;
  "Tipo (Compra/Venta)"?: string;
  "Monto USD"?: number | string;
  "Precio unidad"?: number | string;
  Cantidad?: number | string;
  "Comisión USD"?: number | string;
  Comentario?: string;
  "Ganancia Realizada"?: number | string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function normalizeDate(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!s) return null;

  // YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return s;

  // dd/mm/yy o dd/mm/yyyy
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year = 2000 + year;

    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;

    const dt = new Date(Date.UTC(year, month - 1, day));
    if (
      dt.getUTCFullYear() !== year ||
      dt.getUTCMonth() !== month - 1 ||
      dt.getUTCDate() !== day
    ) {
      return null;
    }

    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  return null;
}

function toNumber(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input !== "string") return null;

  let s = input.trim();
  if (!s) return null;

  s = s.replace(/\s/g, "");
  s = s.replace(/\$/g, "");
  s = s.replace(/US\$/gi, "");

  // 1.234,56 -> 1234.56
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeSide(side: unknown): "BUY" | "SELL" | null {
  const s = String(side ?? "").trim().toUpperCase();
  if (!s) return null;
  if (s === "BUY" || s === "COMPRA") return "BUY";
  if (s === "SELL" || s === "VENTA") return "SELL";
  return null;
}

function detectDelimiter(headerLine: string): "," | ";" | "\t" {
  const comma = (headerLine.match(/,/g) ?? []).length;
  const semi = (headerLine.match(/;/g) ?? []).length;
  const tab = (headerLine.match(/\t/g) ?? []).length;
  if (semi >= comma && semi >= tab) return ";";
  if (tab >= comma && tab >= semi) return "\t";
  return ",";
}

/** Parser CSV simple con soporte de comillas y delimitador autodetectado */
function parseCsvText(csvText: string): Record<string, string>[] {
  const text = csvText.replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);

  const splitLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (ch === delimiter && !inQuotes) {
        out.push(cur);
        cur = "";
        continue;
      }

      cur += ch;
    }
    out.push(cur);

    return out.map((v) => v.trim());
  };

  const headers = splitLine(lines[0]).map((h) => h.replace(/^"|"$/g, "").trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]).map((c) => c.replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? "";
    });
    rows.push(obj);
  }

  return rows;
}

function mapRowToTrade(raw: InvestmentCsvRow, userId: string, idx: number) {
  const dateRaw = raw.date ?? raw.Fecha;
  const symbolRaw = raw.symbol ?? raw.Activo;
  const sideRaw = raw.side ?? raw["Tipo (Compra/Venta)"];

  const date = normalizeDate(dateRaw);
  const side = normalizeSide(sideRaw);
  const quantity = toNumber(raw.quantity ?? raw.Cantidad);
  const price = toNumber(raw.price ?? raw["Precio unidad"]);
  const totalUsd = toNumber(raw.totalUsd ?? raw["Monto USD"]);
  const feeUsd = toNumber(raw.feeUsd ?? raw["Comisión USD"] ?? 0) ?? 0;
  const realizedPnlUsd =
    toNumber(raw.realizedPnlUsd ?? raw["Ganancia Realizada"] ?? 0) ?? 0;

  const note = (raw.note ?? raw.Comentario ?? "").toString().trim() || null;

  if (!date || !side || quantity === null || price === null || totalUsd === null) {
    console.warn("[investments/import-csv] invalid row", {
      idx,
      parsed: { date, side, quantity, price, totalUsd, feeUsd, realizedPnlUsd },
      raw,
    });
    return null;
  }

  const symbol = String(symbolRaw ?? "")
    .trim()
    .toUpperCase()
    .split(":")
    .pop()!;

  if (!symbol) return null;

  return {
    user_id: userId,
    date,
    symbol,
    side,
    quantity,
    price,
    total_usd: totalUsd,
    fee_usd: feeUsd,
    realized_pnl_usd: realizedPnlUsd,
    note,
    external_id: raw.externalId?.toString() || null,
    source: "CSV",
  };
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") ?? "";

    let rows: InvestmentCsvRow[] = [];

    // 1) multipart/form-data (file)
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");

      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: 'Falta el archivo. Enviá FormData con key "file".' },
          { status: 400 }
        );
      }

      const csvText = await file.text();
      rows = parseCsvText(csvText) as any;
    } else {
      // 2) JSON
      let body: any;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          { error: "Body inválido. Enviá JSON { rows } o { csvText }." },
          { status: 400 }
        );
      }

      if (Array.isArray(body?.rows)) {
        rows = body.rows;
      } else if (typeof body?.csvText === "string") {
        rows = parseCsvText(body.csvText) as any;
      } else {
        return NextResponse.json(
          { error: "No se recibieron filas. Enviá { rows } o { csvText }." },
          { status: 400 }
        );
      }
    }

    if (!rows.length) {
      return NextResponse.json({ error: "No hay filas para importar." }, { status: 400 });
    }

    const mapped = rows
      .map((r, idx) => mapRowToTrade(r, user.id, idx))
      .filter(Boolean) as any[];

    if (!mapped.length) {
      return NextResponse.json(
        { error: "Ninguna fila era válida (revisá Fecha/Tipo/Cantidad/Precio/Monto USD)." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.from("investment_trades").insert(mapped).select("id");

    if (error) {
      console.error("[investments/import-csv] DB error:", error);
      return NextResponse.json(
        {
          error: "Error al guardar operaciones de inversión.",
          db: {
            code: (error as any).code ?? null,
            message: (error as any).message ?? null,
            details: (error as any).details ?? null,
            hint: (error as any).hint ?? null,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      inserted: data?.length ?? 0,
      received: rows.length,
      valid: mapped.length,
    });
  } catch (e) {
    console.error("[investments/import-csv] Unexpected error:", e);
    return NextResponse.json({ error: "Error inesperado al importar inversiones." }, { status: 500 });
  }
}
