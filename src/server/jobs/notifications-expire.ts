import "server-only";
import { db } from "@/lib/db";

/**
 * Borra (soft-delete) notificaciones cuyo `expiresAt` ya pasó.
 * Las que tengan `expiresAt = null` se mantienen.
 */
export async function expireNotifications() {
  const r = await db.notification.updateMany({
    where: { expiresAt: { not: null, lt: new Date() }, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return { expired: r.count };
}
