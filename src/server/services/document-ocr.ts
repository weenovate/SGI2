import "server-only";
import { ocrText, extractExpiryDate, evaluateImageQuality } from "@/lib/ocr";

/**
 * OCR para documentación del alumno (HU4-3 / HU11-2).
 *
 * - Extrae fecha de vencimiento del texto si es legible.
 * - Hace un "type match" simple buscando palabras clave del tipo de
 *   documentación esperada (DNI / pasaporte / apto médico / libreta de
 *   embarco / etc.).
 * - Devuelve un score global combinando match de tipo + calidad de imagen.
 *
 * No determina por sí solo el resultado: la validación queda en manos
 * del bedel a menos que `enrollment.autoValidateDocs` esté activo.
 */

export type DocOcr = {
  expiresAt: Date | null;
  typeMatched: boolean;
  matchedKeyword: string | null;
  quality: Awaited<ReturnType<typeof evaluateImageQuality>> | null;
  rawText: string;
  score: number; // 0-100
};

const TYPE_KEYWORDS: Record<string, RegExp[]> = {
  DNI: [/documento\s+nacional\s+de\s+identidad/i, /\bdni\b/i, /rep[uú]blica\s+argentina/i],
  PAS: [/pasaporte|passport/i],
  LE: [/libreta\s+de\s+enrolamiento/i],
  LC: [/libreta\s+c[íi]vica/i],
  LIB_EMBARCO: [/libreta\s+de\s+embarco|prefectura\s+naval/i],
  APTO_MED: [/apto\s+m[eé]dico|aptitud\s+f[íi]sica|exam[ei]nado/i],
  CERT_CURSO: [/certificado/i],
  FOTO_4X4: [], // no aplica match textual
};

export async function analyzeDocumentBuffer(opts: {
  buffer: Buffer;
  mime: string;
  expectedTipoCode: string;
}): Promise<DocOcr> {
  const isImage = opts.mime.startsWith("image/");
  const quality = isImage ? await evaluateImageQuality(opts.buffer).catch(() => null) : null;

  let rawText = "";
  if (isImage || opts.mime === "application/pdf") {
    try {
      rawText = await ocrText(opts.buffer);
    } catch (err) {
      console.error("[doc-ocr] ocr failed", err);
    }
  }

  const expiresAt = rawText ? extractExpiryDate(rawText) : null;

  const keywords = TYPE_KEYWORDS[opts.expectedTipoCode] ?? [];
  let matchedKeyword: string | null = null;
  for (const re of keywords) {
    const m = rawText.match(re);
    if (m) { matchedKeyword = m[0]; break; }
  }
  const typeMatched = keywords.length === 0 ? true : !!matchedKeyword;

  let score = 0;
  if (quality) score += Math.round(quality.score * 0.5); // hasta 50 por calidad
  if (typeMatched && keywords.length > 0) score += 30;
  if (expiresAt) score += 20;
  score = Math.min(100, score);

  return { expiresAt, typeMatched, matchedKeyword, quality, rawText, score };
}
