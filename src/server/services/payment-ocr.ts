import "server-only";
import { ocrText } from "@/lib/ocr";

/**
 * Heurísticas para extraer datos de un comprobante de pago argentino
 * (transferencia, depósito, Mercado Pago, etc.) a partir del texto OCR.
 *
 * El resultado siempre tiene `score` 0-100 (qué tan confiable es) y
 * los campos pueden venir nulos. La UI deja todo editable.
 */

export type PaymentOcr = {
  medio: string | null;
  fechaPago: Date | null;
  monto: string | null;
  numeroOperacion: string | null;
  rawText: string;
  score: number;
};

const MEDIO_KEYWORDS: Array<[RegExp, string]> = [
  [/mercado\s*pago|mercadopago|mp\b/i, "Mercado Pago"],
  [/transfer(encia)?/i, "Transferencia"],
  [/dep[oó]sito/i, "Depósito"],
  [/d[eé]bito\s*autom[aá]tico/i, "Débito automático"],
  [/tarjeta\s*(de\s*)?cr[eé]dito/i, "Tarjeta de crédito"],
  [/tarjeta\s*(de\s*)?d[eé]bito/i, "Tarjeta de débito"],
  [/efectivo|rapipago|pago\s*f[aá]cil/i, "Efectivo"],
  [/cheque/i, "Cheque"],
];

export async function extractPaymentDataFromBuffer(buffer: Buffer): Promise<PaymentOcr> {
  const text = await ocrText(buffer);
  return extractPaymentData(text);
}

export function extractPaymentData(text: string): PaymentOcr {
  let score = 0;

  // Medio de pago
  let medio: string | null = null;
  for (const [re, label] of MEDIO_KEYWORDS) {
    if (re.test(text)) { medio = label; score += 20; break; }
  }

  // Fecha (toma la primera dd/mm/yyyy o dd-mm-yyyy o dd.mm.yyyy)
  let fechaPago: Date | null = null;
  const dateRe = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g;
  for (const m of text.matchAll(dateRe)) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    const parsed = new Date(Date.UTC(y, mo - 1, d));
    if (Number.isNaN(parsed.getTime())) continue;
    fechaPago = parsed;
    score += 25;
    break;
  }

  // Monto: $ X.XXX,XX | $ X,XXX.XX | ARS 1234 | 1234,56
  let monto: string | null = null;
  const amountRe = /(?:\$|ars|pesos)\s*([\d.,]+)/i;
  const m = text.match(amountRe);
  if (m) {
    monto = normalizeAmount(m[1]!);
    score += 25;
  } else {
    const fallback = text.match(/\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})\b/);
    if (fallback) {
      monto = normalizeAmount(fallback[0]);
      score += 10;
    }
  }

  // Número de operación
  let numeroOperacion: string | null = null;
  const opRe = /(?:n[uú]mero\s+(?:de\s+)?(?:operaci[oó]n|comprobante|transacci[oó]n|referencia)|nro\.?\s*(?:op|comp|trans)|c[oó]digo\s+de\s+operaci[oó]n|id\s+(?:de\s+)?(?:operaci[oó]n|pago))[:\s#]*([A-Z0-9-]{6,40})/i;
  const op = text.match(opRe);
  if (op) {
    numeroOperacion = op[1]!;
    score += 25;
  } else {
    // Tomar la cadena alfanumérica más larga ≥10 chars (heurística)
    const all = text.match(/\b[A-Z0-9-]{10,40}\b/gi);
    if (all && all[0]) {
      numeroOperacion = all[0];
      score += 5;
    }
  }

  return { medio, fechaPago, monto, numeroOperacion, rawText: text, score: Math.min(100, score) };
}

function normalizeAmount(raw: string): string {
  // "1.234,56" → "1234.56"  /  "1,234.56" → "1234.56"
  const s = raw.replace(/\s/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    return s.replace(/\./g, "").replace(",", ".");
  }
  return s.replace(/,/g, "");
}
