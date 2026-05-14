import "server-only";
import { db } from "@/lib/db";

/**
 * Documentos con vencimiento dentro de N días → flag expiringSoon = true.
 * No cambia el estado (sigue "aprobada") — el tag es visual.
 */
export async function markExpiringSoon() {
  const setting = await db.setting.findUnique({ where: { key: "documents.expiringSoonDays" } });
  const days = typeof setting?.value === "number" ? setting.value : 30;
  const limit = new Date(Date.now() + days * 86_400_000);

  const updated = await db.document.updateMany({
    where: {
      deletedAt: null,
      status: "aprobada",
      expiringSoon: false,
      expiresAt: { not: null, gte: new Date(), lte: limit },
    },
    data: { expiringSoon: true },
  });
  return { updated: updated.count };
}

/**
 * Documentos vencidos → estado "vencida", limpia tag.
 */
export async function markExpired() {
  const updated = await db.document.updateMany({
    where: {
      deletedAt: null,
      status: { in: ["aprobada", "pendiente"] },
      expiresAt: { not: null, lt: new Date() },
    },
    data: { status: "vencida", expiringSoon: false },
  });
  return { updated: updated.count };
}
