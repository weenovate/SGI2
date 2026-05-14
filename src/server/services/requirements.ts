import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type RequirementCheck = {
  tipoId: string;
  label: string;
  ok: boolean;
  reason?: string; // 'missing' | 'expired' | 'rejected' | 'pending'
  documentId?: string | null;
  expiresAt?: Date | null;
};

export type RequirementsResult = {
  items: RequirementCheck[];
  allOk: boolean;
};

/**
 * Calcula el cumplimiento de requisitos del alumno para una instancia.
 * Considera la última versión vigente por tipo de documentación.
 *
 * Estados que cuentan como OK: status='aprobada' y no vencida.
 * Si no hay doc, está pendiente, rechazada o vencida → no cumple.
 */
export async function computeRequirements(opts: {
  userId: string;
  courseId: string;
}): Promise<RequirementsResult> {
  const profile = await db.studentProfile.findUnique({ where: { userId: opts.userId } });
  if (!profile) {
    return { items: [], allOk: false };
  }

  const requisites = await db.courseRequisite.findMany({
    where: { courseId: opts.courseId },
    include: { },
  });
  if (requisites.length === 0) return { items: [], allOk: true };

  const tipoIds = requisites.map((r) => r.tipoDocumentacionId);
  const [tipos, docs] = await Promise.all([
    db.tipoDocumentacion.findMany({ where: { id: { in: tipoIds } } }),
    db.document.findMany({
      where: { studentId: profile.id, deletedAt: null, tipoId: { in: tipoIds } },
      orderBy: { uploadedAt: "desc" },
    }),
  ]);
  const tiposMap = new Map(tipos.map((t) => [t.id, t]));

  const items: RequirementCheck[] = tipoIds.map((tipoId) => {
    const tipo = tiposMap.get(tipoId);
    const docList = docs.filter((d) => d.tipoId === tipoId);
    const latest = docList[0];

    if (!latest) {
      return { tipoId, label: tipo?.label ?? "Documento", ok: false, reason: "missing" };
    }
    if (latest.status === "rechazada") {
      return { tipoId, label: tipo?.label ?? "Documento", ok: false, reason: "rejected", documentId: latest.id };
    }
    if (latest.status === "pendiente") {
      return { tipoId, label: tipo?.label ?? "Documento", ok: false, reason: "pending", documentId: latest.id };
    }
    if (latest.status === "vencida") {
      return { tipoId, label: tipo?.label ?? "Documento", ok: false, reason: "expired", documentId: latest.id, expiresAt: latest.expiresAt };
    }
    if (latest.expiresAt && latest.expiresAt < new Date()) {
      return { tipoId, label: tipo?.label ?? "Documento", ok: false, reason: "expired", documentId: latest.id, expiresAt: latest.expiresAt };
    }
    return { tipoId, label: tipo?.label ?? "Documento", ok: true, documentId: latest.id, expiresAt: latest.expiresAt };
  });

  return { items, allOk: items.every((i) => i.ok) };
}

/**
 * Snapshot inmutable: por cada tipo de doc requerido, copia la doc
 * vigente del alumno con sus archivos a EnrollmentDocumentSnapshot.
 */
export async function snapshotEnrollmentDocs(
  tx: Prisma.TransactionClient,
  enrollmentId: string,
  studentProfileId: string,
  courseId: string,
) {
  const requisites = await tx.courseRequisite.findMany({ where: { courseId } });
  for (const r of requisites) {
    const doc = await tx.document.findFirst({
      where: { studentId: studentProfileId, tipoId: r.tipoDocumentacionId, deletedAt: null },
      orderBy: { uploadedAt: "desc" },
      include: { files: true },
    });
    if (!doc) continue;
    await tx.enrollmentDocumentSnapshot.create({
      data: {
        enrollmentId,
        tipoDocumentacionId: r.tipoDocumentacionId,
        documentId: doc.id,
        data: {
          status: doc.status,
          uploadedAt: doc.uploadedAt.toISOString(),
          expiresAt: doc.expiresAt?.toISOString() ?? null,
        },
        fileObjectIds: doc.files.map((f) => f.fileObjectId).join(","),
      },
    });
  }
}
