import "server-only";
import type { Prisma } from "@prisma/client";

/**
 * Genera el código `I-LCI5626-018` para una nueva inscripción.
 * El número autoincremental es por instancia (no global).
 *
 * Debe llamarse dentro de una transacción para evitar carreras.
 */
export async function generateEnrollmentCode(
  tx: Prisma.TransactionClient,
  instanceId: string,
): Promise<string> {
  const inst = await tx.courseInstance.findUniqueOrThrow({
    where: { id: instanceId },
    include: { course: true },
  });
  const count = await tx.enrollment.count({ where: { instanceId } });
  const seq = String(count + 1).padStart(3, "0");
  return `I-${inst.course.abbr}${inst.edition}-${seq}`;
}
