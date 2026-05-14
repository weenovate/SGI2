import "server-only";
import sharp from "sharp";
import { env } from "./env";

/**
 * Wrapper de Tesseract + heurísticas de calidad de imagen.
 * El worker se carga lazy para no impactar el cold-start del server.
 */

let workerPromise: Promise<unknown> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const w = await createWorker(env.TESSERACT_LANG, undefined, {
        cachePath: env.TESSDATA_DIR,
      });
      return w;
    })();
  }
  return workerPromise as Promise<Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>>;
}

export type ImageQuality = {
  width: number;
  height: number;
  brightness: number; // 0-255 promedio
  sharpness: number; // varianza de Laplaciano (proxy)
  isLowResolution: boolean;
  isTooDark: boolean;
  isTooBright: boolean;
  isBlurry: boolean;
  score: number; // 0-100
};

export async function evaluateImageQuality(buffer: Buffer): Promise<ImageQuality> {
  const img = sharp(buffer);
  const meta = await img.metadata();
  const { data, info } = await img
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i]!;
  const brightness = sum / data.length;

  // Proxy de nitidez: varianza de la diferencia con el vecino derecho
  let varianceSum = 0;
  let count = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width - 1; x++) {
      const i = y * info.width + x;
      const diff = data[i]! - data[i + 1]!;
      varianceSum += diff * diff;
      count++;
    }
  }
  const sharpness = varianceSum / count;

  const width = meta.width ?? info.width;
  const height = meta.height ?? info.height;
  const isLowResolution = width < 800 || height < 600;
  const isTooDark = brightness < 60;
  const isTooBright = brightness > 220;
  const isBlurry = sharpness < 80;

  let score = 100;
  if (isLowResolution) score -= 25;
  if (isTooDark) score -= 25;
  if (isTooBright) score -= 15;
  if (isBlurry) score -= 35;
  score = Math.max(0, Math.min(100, score));

  return { width, height, brightness, sharpness, isLowResolution, isTooDark, isTooBright, isBlurry, score };
}

export async function ocrText(buffer: Buffer): Promise<string> {
  const w = (await getWorker()) as unknown as {
    recognize: (b: Buffer) => Promise<{ data: { text?: string } }>;
  };
  const { data } = await w.recognize(buffer);
  return (data?.text ?? "").trim();
}

/**
 * Heurística simple para extraer una fecha de vencimiento de un texto.
 * Acepta dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy.
 */
export function extractExpiryDate(text: string): Date | null {
  const re = /(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/g;
  let best: Date | null = null;
  for (const m of text.matchAll(re)) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    const date = new Date(Date.UTC(y, mo - 1, d));
    if (Number.isNaN(date.getTime())) continue;
    if (!best || date > best) best = date;
  }
  return best;
}
