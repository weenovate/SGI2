import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveFile, StorageError } from "@/lib/storage";
import { evaluateImageQuality } from "@/lib/ocr";
import { extractPaymentDataFromBuffer } from "@/server/services/payment-ocr";
import { analyzeDocumentBuffer } from "@/server/services/document-ocr";

export const runtime = "nodejs";

const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

type UploadEntry = {
  id: string;
  relPath: string;
  mime: string;
  originalName: string;
  size: number;
  warning?: string;
  quality?: Awaited<ReturnType<typeof evaluateImageQuality>> | null;
  paymentOcr?: Awaited<ReturnType<typeof extractPaymentDataFromBuffer>>;
  documentOcr?: Awaited<ReturnType<typeof analyzeDocumentBuffer>>;
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const bucket = (url.searchParams.get("bucket") ?? "documents") as "documents" | "payments" | "branding";
  const tipoCode = url.searchParams.get("tipoCode") ?? null;
  const evaluate = url.searchParams.get("evaluate") !== "false";
  const runOcr = url.searchParams.get("ocr") !== "false";

  const formData = await req.formData();
  const files = formData.getAll("files");

  const [maxSizeRow, allowedRow, minScoreRow] = await Promise.all([
    db.setting.findUnique({ where: { key: bucket === "payments" ? "payments.maxFileSizeMb" : "documents.maxFileSizeMb" } }),
    db.setting.findUnique({ where: { key: bucket === "payments" ? "payments.allowedMimes" : "documents.allowedMimes" } }),
    db.setting.findUnique({ where: { key: "documents.minOcrScore" } }),
  ]);
  const maxBytes = ((typeof maxSizeRow?.value === "number" ? maxSizeRow.value : 15) as number) * 1024 * 1024;
  const allowedMimes = Array.isArray(allowedRow?.value) ? (allowedRow.value as string[]) : Array.from(ALLOWED);
  const minScore = typeof minScoreRow?.value === "number" ? minScoreRow.value : 0;

  const out: UploadEntry[] = [];

  for (const f of files) {
    if (!(f instanceof File)) continue;
    if (!allowedMimes.includes(f.type)) {
      return NextResponse.json({ error: `Tipo no permitido: ${f.type}` }, { status: 400 });
    }
    if (f.size > maxBytes) {
      return NextResponse.json({ error: `Archivo demasiado grande (${Math.round(f.size / 1024 / 1024)}MB)` }, { status: 400 });
    }

    const buffer = Buffer.from(await f.arrayBuffer());
    let quality: Awaited<ReturnType<typeof evaluateImageQuality>> | null = null;
    let warning: string | undefined;

    if (evaluate && f.type.startsWith("image/")) {
      try {
        quality = await evaluateImageQuality(buffer);
        if (quality.score < minScore) {
          warning = `Calidad baja (score ${quality.score}). Considerá subir una versión más nítida.`;
        }
      } catch (err) {
        console.error("[upload] quality check failed", err);
      }
    }

    let paymentOcr: Awaited<ReturnType<typeof extractPaymentDataFromBuffer>> | undefined;
    let documentOcr: Awaited<ReturnType<typeof analyzeDocumentBuffer>> | undefined;

    if (runOcr) {
      try {
        if (bucket === "payments") {
          paymentOcr = await extractPaymentDataFromBuffer(buffer);
        } else if (bucket === "documents" && tipoCode) {
          documentOcr = await analyzeDocumentBuffer({ buffer, mime: f.type, expectedTipoCode: tipoCode });
        }
      } catch (err) {
        console.error("[upload] OCR failed", err);
      }
    }

    try {
      const saved = await saveFile({ bucket, filename: f.name, mime: f.type, buffer, maxBytes });
      const fo = await db.fileObject.create({
        data: {
          bucket: saved.bucket,
          relPath: saved.relPath,
          originalName: saved.originalName,
          mime: saved.mime,
          size: saved.size,
          ownerUserId: session.user.id,
        },
      });
      out.push({
        id: fo.id,
        relPath: fo.relPath,
        mime: fo.mime,
        originalName: fo.originalName,
        size: fo.size,
        quality,
        warning,
        paymentOcr,
        documentOcr,
      });
    } catch (err) {
      if (err instanceof StorageError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  return NextResponse.json({ files: out });
}
