// src/app/api/investments/import-ai/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createApiClient } from "@/lib/supabase/server";

const anthropic = new Anthropic();

// ─── Límites de importación según plan ───────────────────────────────────────
const PDF_IMPORT_LIMITS: Record<string, number> = {
  FREE:   0,
  PRO:    20,
  DELUXE: 50,
};

const IMAGE_IMPORT_LIMITS: Record<string, number> = {
  FREE:   0,
  PRO:    3,
  DELUXE: 10,
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

type RawTrade = {
  date: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  total_usd: number;
  fee_usd: number;
  note?: string;
};

type RawCashMovement = {
  date: string;
  type: "deposit" | "withdrawal" | "dividend" | "fee" | "other";
  amount_usd: number;
  note?: string;
};

type ParseResult = {
  broker: string;
  currency: string;
  trades: RawTrade[];
  cashMovements: RawCashMovement[];
  warnings: string[];
};

type ParsedJson = {
  broker?: unknown;
  currency?: unknown;
  trades?: unknown[];
  cash_movements?: unknown[];
  warnings?: unknown[];
};

type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sos un extractor de datos financieros de alta precisión especializado en estados de cuenta de brokers de inversión.

Tu tarea es analizar el documento/imagen y extraer DOS cosas:
1. TODAS las operaciones de compra/venta de activos financieros
2. TODOS los movimientos de cash (depósitos, retiros, dividendos, comisiones)

═══ TRADES (compras/ventas) ═══
ACTIVOS A DETECTAR: Acciones (AAPL, MSFT...), ETFs (VOO, QQQ...), Cripto (BTC, ETH...), Metales (IAU, GLD...), Bonos.
REGLAS:
- Extraer SOLO operaciones de compra/venta reales.
- El símbolo debe ser el ticker limpio en MAYÚSCULAS. Ej: "Apple Inc" → "AAPL".
- La fecha debe ser YYYY-MM-DD.
- Si quantity es negativa → SELL.
- fee_usd puede ser 0 si no está especificado.
- Si el precio no es USD, convertir con el tipo de cambio del documento si está disponible.

═══ CASH MOVEMENTS (movimientos de efectivo) ═══
TIPOS A DETECTAR:
- deposit: transferencia de dinero hacia adentro del broker
- withdrawal: retiro de dinero del broker
- dividend: pago de dividendo en efectivo
- fee: comisión o cargo del broker
- other: cualquier otro movimiento de cash no clasificable
REGLAS:
- amount_usd siempre positivo — el type indica la dirección.
- Ignorar movimientos de cash que sean consecuencia directa de una compra/venta (ya están en trades).

RESPONDER SOLO con JSON válido, sin texto adicional, sin markdown, sin backticks:
{
  "broker": "nombre exacto del broker detectado o 'Genérico'",
  "currency": "USD o moneda principal del documento",
  "trades": [
    {
      "date": "YYYY-MM-DD",
      "symbol": "TICKER",
      "side": "BUY",
      "quantity": 1.5,
      "price": 244.41,
      "total_usd": 366.62,
      "fee_usd": 0,
      "note": "info adicional opcional"
    }
  ],
  "cash_movements": [
    {
      "date": "YYYY-MM-DD",
      "type": "deposit",
      "amount_usd": 1000.00,
      "note": "Transferencia bancaria"
    }
  ],
  "warnings": ["lista de advertencias o campos ambiguos"]
}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeSymbol(s: unknown): string {
  return String(s ?? "").trim().toUpperCase().replace(/[^A-Z0-9\-\.]/g, "");
}

function toPositiveNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
}

function cleanTrades(raw: unknown[]): { trades: RawTrade[]; skipped: number } {
  const trades: RawTrade[] = [];
  let skipped = 0;

  for (const item of raw) {
    const t = item as Record<string, unknown>;
    const symbol = normalizeSymbol(t.symbol);
    if (!symbol) { skipped++; continue; }

    const side: "BUY" | "SELL" =
      String(t.side ?? "").toUpperCase() === "SELL" ? "SELL" : "BUY";

    const quantity = toPositiveNum(t.quantity);
    const price    = toPositiveNum(t.price);
    const totalRaw = toPositiveNum(t.total_usd);
    const total    = totalRaw > 0 ? totalRaw : quantity * price;
    const fee      = toPositiveNum(t.fee_usd);

    if (quantity <= 0 || price <= 0) { skipped++; continue; }

    const rawDate = String(t.date ?? "");
    const date    = isValidDate(rawDate) ? rawDate : todayIso();
    const note    = t.note ? String(t.note) : undefined;

    trades.push({ date, symbol, side, quantity, price, total_usd: total, fee_usd: fee, note });
  }

  return { trades, skipped };
}

const VALID_CASH_TYPES = ["deposit", "withdrawal", "dividend", "fee", "other"] as const;

function cleanCashMovements(raw: unknown[]): RawCashMovement[] {
  const movements: RawCashMovement[] = [];

  for (const item of raw) {
    const m = item as Record<string, unknown>;
    const amount = toPositiveNum(m.amount_usd);
    if (amount <= 0) continue;

    const rawType = String(m.type ?? "other").toLowerCase();
    const type = VALID_CASH_TYPES.includes(rawType as typeof VALID_CASH_TYPES[number])
      ? (rawType as RawCashMovement["type"])
      : "other";

    const rawDate = String(m.date ?? "");
    const date    = isValidDate(rawDate) ? rawDate : todayIso();
    const note    = m.note ? String(m.note) : undefined;

    movements.push({ date, type, amount_usd: amount, note });
  }

  return movements;
}

// ─── Deduplicación de trades contra la DB ────────────────────────────────────

type ExistingTrade = {
  date: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
};

function isSameTrade(incoming: RawTrade, existing: ExistingTrade): boolean {
  if (incoming.date   !== existing.date)   return false;
  if (incoming.symbol !== existing.symbol) return false;
  if (incoming.side   !== existing.side)   return false;

  const qtyDiff = Math.abs(incoming.quantity - existing.quantity) / Math.max(existing.quantity, 0.000001);
  if (qtyDiff > 0.0001) return false;

  const priceDiff = Math.abs(incoming.price - existing.price) / Math.max(existing.price, 0.000001);
  if (priceDiff > 0.005) return false;

  return true;
}

async function filterDuplicates(
  supabase: Awaited<ReturnType<typeof createApiClient>>,
  userId: string,
  incoming: RawTrade[],
): Promise<{ unique: RawTrade[]; duplicates: number }> {
  if (!incoming.length) return { unique: [], duplicates: 0 };

  const dates    = incoming.map((t) => t.date).sort();
  const fromDate = dates[0];
  const toDate   = dates[dates.length - 1];

  const { data: existing, error } = await supabase
    .from("investment_trades")
    .select("date, symbol, side, quantity, price")
    .eq("user_id", userId)
    .gte("date", fromDate)
    .lte("date", toDate);

  if (error || !existing) {
    console.warn("[import-ai] No se pudo consultar duplicados:", error?.message);
    return { unique: incoming, duplicates: 0 };
  }

  const existingList = existing as ExistingTrade[];
  const unique: RawTrade[] = [];
  let duplicates = 0;

  for (const trade of incoming) {
    const isDup = existingList.some((ex) => isSameTrade(trade, ex));
    if (isDup) duplicates++;
    else unique.push(trade);
  }

  return { unique, duplicates };
}

// ─── Lookup de broker en la DB ────────────────────────────────────────────────
//
// Busca si ya existe un broker con ese nombre para el usuario.
// Si no existe, devuelve brokerIsNew: true para que el cliente confirme crearlo.
//

async function findOrCheckBroker(
  supabase: Awaited<ReturnType<typeof createApiClient>>,
  userId: string,
  brokerName: string,
): Promise<{ brokerAccountId: string | null; brokerIsNew: boolean }> {
  const { data, error } = await supabase
    .from("broker_accounts")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", brokerName.trim())
    .maybeSingle();

  if (error) {
    console.warn("[import-ai] Error buscando broker:", error.message);
    return { brokerAccountId: null, brokerIsNew: true };
  }

  if (data) {
    return { brokerAccountId: data.id, brokerIsNew: false };
  }

  return { brokerAccountId: null, brokerIsNew: true };
}

// ─── Extracción de texto de PDF con pdfjs-dist ────────────────────────────────

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs" as any);

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const pageTexts: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();

    type TextItem = { str: string; transform: number[] };
    const items = content.items as TextItem[];

    let lastY: number | null = null;
    let line = "";
    const lines: string[] = [];

    for (const item of items) {
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        if (line.trim()) lines.push(line.trim());
        line = "";
      }
      line += item.str + " ";
      lastY = y;
    }
    if (line.trim()) lines.push(line.trim());

    pageTexts.push(lines.join("\n"));
  }

  return pageTexts.join("\n\n--- Página ---\n\n");
}

// ─── Contadores de uso mensual ────────────────────────────────────────────────

async function getImportCount(
  supabase: Awaited<ReturnType<typeof createApiClient>>,
  userId: string,
  type: "image" | "pdf" | "csv",
): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("import_ai_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", type)
    .gte("created_at", startOfMonth.toISOString());

  if (error) {
    console.warn("[import-ai] No se pudo consultar el contador:", error.message);
    return 0;
  }

  return count ?? 0;
}

async function logImport(
  supabase: Awaited<ReturnType<typeof createApiClient>>,
  userId: string,
  type: "image" | "pdf" | "csv",
): Promise<void> {
  await supabase.from("import_ai_log").insert({ user_id: userId, type });
}

// ─── Claude Vision (solo imágenes) ───────────────────────────────────────────

async function parseImageWithClaude(
  mediaType: ImageMediaType,
  base64Data: string,
): Promise<ParseResult> {
  type MessageContent = Parameters<typeof anthropic.messages.create>[0]["messages"][0]["content"];

  const contentBlock: MessageContent[0] = {
    type: "image",
    source: { type: "base64", media_type: mediaType, data: base64Data },
  };

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          contentBlock,
          {
            type: "text",
            text: "Extraé todos los trades y movimientos de cash de esta imagen. Respondé SOLO con el JSON especificado.",
          },
        ],
      },
    ],
  });

  const rawText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return parseJsonResponse(rawText);
}

// ─── Claude texto (PDF extraído + CSV) ───────────────────────────────────────

async function parseTextWithClaude(text: string, source: "pdf" | "csv"): Promise<ParseResult> {
  const truncated = text.slice(0, 60_000);
  const label = source === "pdf"
    ? "estado de cuenta (texto extraído de PDF)"
    : "CSV de broker";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Extraé todos los trades y movimientos de cash de este ${label}:\n\n${truncated}\n\nRespondé SOLO con el JSON especificado.`,
      },
    ],
  });

  const rawText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return parseJsonResponse(rawText);
}

// ─── Parse + validar JSON ─────────────────────────────────────────────────────

function parseJsonResponse(raw: string): ParseResult {
  const clean = raw.replace(/```json|```/gi, "").trim();

  let parsed: ParsedJson;
  try {
    parsed = JSON.parse(clean) as ParsedJson;
  } catch {
    throw new Error(`La IA no devolvió JSON válido. Respuesta: ${clean.slice(0, 200)}`);
  }

  const rawTrades = Array.isArray(parsed.trades) ? parsed.trades : [];
  const { trades, skipped } = cleanTrades(rawTrades);

  const rawCash = Array.isArray(parsed.cash_movements) ? parsed.cash_movements : [];
  const cashMovements = cleanCashMovements(rawCash);

  const warnings: string[] = Array.isArray(parsed.warnings)
    ? parsed.warnings.map(String)
    : [];

  if (skipped > 0) warnings.push(`${skipped} fila(s) ignoradas por datos incompletos`);

  return {
    broker:   String(parsed.broker ?? "Genérico"),
    currency: String(parsed.currency ?? "USD"),
    trades,
    cashMovements,
    warnings,
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createApiClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Obtener plan del usuario
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .single();
    const plan = (sub?.plan ?? "FREE") as string;

    const formData   = await req.formData();
    const file       = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });

    const fileName   = file.name.toLowerCase();
    const fileSizeMB = file.size / (1024 * 1024);

    if (fileSizeMB > 20) {
      return NextResponse.json(
        { error: `Archivo demasiado grande (${fileSizeMB.toFixed(1)}MB). Máximo: 20MB.` },
        { status: 400 },
      );
    }

    // ── Detectar tipo de archivo ──────────────────────────────────────────────

    const isCsv  = fileName.endsWith(".csv")  || file.type === "text/csv" || file.type === "application/csv";
    const isPdf  = fileName.endsWith(".pdf")  || file.type === "application/pdf";
    const isJpg  = !!fileName.match(/\.(jpg|jpeg)$/) || file.type === "image/jpeg";
    const isPng  = fileName.endsWith(".png")  || file.type === "image/png";
    const isWebp = fileName.endsWith(".webp") || file.type === "image/webp";
    const isGif  = fileName.endsWith(".gif")  || file.type === "image/gif";
    const isImage = isJpg || isPng || isWebp || isGif;

    // ── Validar límites por plan ──────────────────────────────────────────────

    if (isPdf) {
      const limit = PDF_IMPORT_LIMITS[plan] ?? 0;
      if (limit === 0) {
        return NextResponse.json(
          { error: "Tu plan FREE no incluye el importador IA. Upgradéate a PRO o DELUXE.", limitReached: true },
          { status: 403 },
        );
      }
      const used = await getImportCount(supabase, user.id, "pdf");
      if (used >= limit) {
        return NextResponse.json(
          { error: `Límite de ${limit} importaciones PDF alcanzado este mes (plan ${plan}). Upgradéate para más.`, limitReached: true, used, limit },
          { status: 429 },
        );
      }
    }

    if (isImage) {
      const limit = IMAGE_IMPORT_LIMITS[plan] ?? 0;
      if (limit === 0) {
        return NextResponse.json(
          { error: `Tu plan ${plan} no permite importar imágenes. Usá PDF o CSV — son más precisos.`, limitReached: true, used: 0, limit: 0 },
          { status: 403 },
        );
      }
      const used = await getImportCount(supabase, user.id, "image");
      if (used >= limit) {
        return NextResponse.json(
          { error: `Límite de ${limit} importaciones por imagen alcanzado este mes (plan ${plan}). Usá PDF o CSV, o upgradéate.`, limitReached: true, used, limit },
          { status: 429 },
        );
      }
    }

    // ── 1. Extraer operaciones con IA ─────────────────────────────────────────

    let result: ParseResult;

    if (isCsv) {
      const text = await file.text();
      if (!text.trim()) return NextResponse.json({ error: "El CSV está vacío." }, { status: 400 });
      result = await parseTextWithClaude(text, "csv");
      await logImport(supabase, user.id, "csv");

    } else if (isPdf) {
      const buffer = await file.arrayBuffer();
      const text   = await extractPdfText(Buffer.from(buffer));
      if (!text.trim()) {
        return NextResponse.json(
          { error: "No se pudo extraer texto del PDF. Si es un PDF escaneado, subilo como imagen JPG o PNG." },
          { status: 400 },
        );
      }
      result = await parseTextWithClaude(text, "pdf");
      await logImport(supabase, user.id, "pdf");

    } else if (isImage) {
      const buffer    = await file.arrayBuffer();
      const base64    = Buffer.from(buffer).toString("base64");
      const mediaType: ImageMediaType = isJpg  ? "image/jpeg"
                                      : isPng  ? "image/png"
                                      : isWebp ? "image/webp"
                                      : "image/gif";
      result = await parseImageWithClaude(mediaType, base64);
      await logImport(supabase, user.id, "image");

    } else {
      return NextResponse.json(
        { error: `Formato no soportado: ${file.type || fileName}. Usá PDF, JPG, PNG, WEBP o CSV.` },
        { status: 400 },
      );
    }

    // ── 2. Filtrar duplicados de trades ───────────────────────────────────────

    const { unique, duplicates } = await filterDuplicates(supabase, user.id, result.trades);

    if (duplicates > 0) {
      result.warnings.push(
        `${duplicates} operación${duplicates > 1 ? "es" : ""} ya existía${duplicates > 1 ? "n" : ""} en tu portfolio y ${duplicates > 1 ? "fueron excluidas" : "fue excluida"} automáticamente.`,
      );
    }

    // ── 3. Verificar si el broker ya existe en la DB ──────────────────────────

    const { brokerAccountId, brokerIsNew } = await findOrCheckBroker(
      supabase,
      user.id,
      result.broker,
    );

    // ── 4. Devolver preview completo — el cliente confirma antes de insertar ──

    return NextResponse.json({
      // Trades
      trades:     unique,
      count:      unique.length,
      duplicates,
      total:      result.trades.length,

      // Cash movements
      cashMovements:      result.cashMovements,
      cashMovementsCount: result.cashMovements.length,

      // Broker
      broker:           result.broker,
      brokerAccountId,  // null si es nuevo
      brokerIsNew,      // true → el cliente pregunta si crear

      // Meta
      currency:   result.currency,
      warnings:   result.warnings,
      fileName:   file.name,
      fileSizeMB: Number(fileSizeMB.toFixed(2)),
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error procesando el archivo con IA";
    console.error("[import-ai] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
