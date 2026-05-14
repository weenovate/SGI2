import "server-only";
import { db } from "@/lib/db";

/**
 * Marca como cerradas (estado: 'cancelado' es muy fuerte; acá no
 * tocamos las inscripciones existentes) — solo registramos un log
 * de cierre. La lógica de "ya no podés inscribirte" se enforça en el
 * endpoint enroll() comparando con startDate - hoursBeforeClose.
 *
 * Este cron se podría usar a futuro para enviar recordatorios.
 */
export async function closeWindow() {
  // Por ahora solo metricamos cuántas instancias están en su ventana de cierre.
  const now = new Date();
  const closing = await db.courseInstance.findMany({
    where: { deletedAt: null, startDate: { gte: now } },
    select: { id: true, startDate: true, hoursBeforeClose: true },
  });
  let just = 0;
  for (const i of closing) {
    const closeAt = new Date(i.startDate.getTime() - i.hoursBeforeClose * 3600_000);
    const diff = closeAt.getTime() - now.getTime();
    if (diff > 0 && diff < 60 * 60_000) just++;
  }
  return { instances: closing.length, closingWithinHour: just };
}

export async function expireOffers() {
  const r = await db.waitingListOffer.updateMany({
    where: { status: "pending", expiresAt: { lt: new Date() } },
    data: { status: "expired", decidedAt: new Date() },
  });
  return { expired: r.count };
}
