import { z } from "zod";
import { router, roleProcedure } from "../trpc";

const adminOrBedelManager = () => roleProcedure("admin", "bedel", "manager");
const onlyAlumno = () => roleProcedure("alumno");

export const dashboardsRouter = router({
  // HU6
  alumno: onlyAlumno().query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const profile = await ctx.db.studentProfile.findUnique({ where: { userId } });

    const now = new Date();
    const in30d = new Date(now.getTime() + 30 * 86_400_000);

    const [nuevosCursos, ultimasInscripciones, ultimasDocs, docsPorVencer, listasEspera] = await Promise.all([
      ctx.db.courseInstance.findMany({
        where: { deletedAt: null, startDate: { gte: now } },
        include: { course: true },
        orderBy: { startDate: "asc" },
        take: 5,
      }),
      ctx.db.enrollment.findMany({
        where: { studentId: userId, deletedAt: null },
        include: { instance: { include: { course: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      profile ? ctx.db.document.findMany({
        where: { studentId: profile.id, deletedAt: null },
        include: { tipo: true },
        orderBy: { uploadedAt: "desc" },
        take: 5,
      }) : Promise.resolve([]),
      profile ? ctx.db.document.findMany({
        where: {
          studentId: profile.id,
          deletedAt: null,
          status: "aprobada",
          expiresAt: { not: null, gte: now, lte: in30d },
        },
        include: { tipo: true },
        orderBy: { expiresAt: "asc" },
      }) : Promise.resolve([]),
      ctx.db.waitingListEntry.findMany({
        where: { studentId: userId, removedAt: null },
        include: { instance: { include: { course: true } }, offers: { where: { status: "pending" } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return { nuevosCursos, ultimasInscripciones, ultimasDocs, docsPorVencer, listasEspera };
  }),

  // HU13 (admin/bedel) + lectura para manager
  backoffice: adminOrBedelManager().query(async ({ ctx }) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      pendientesInscripcion,
      pendientesPago,
      pendientesDocs,
      empresasPend,
      inscriptosMes,
      cursosActivos,
      vacantesLibres,
      enrollmentsLast6Months,
    ] = await Promise.all([
      ctx.db.enrollment.count({ where: { status: "preinscripto", deletedAt: null } }),
      ctx.db.enrollment.count({ where: { status: "validar_pago", deletedAt: null } }),
      ctx.db.document.count({ where: { status: "pendiente", deletedAt: null } }),
      ctx.db.empresa.count({ where: { status: "pending_approval", deletedAt: null } }),
      ctx.db.enrollment.count({
        where: { status: "inscripto", deletedAt: null, updatedAt: { gte: startOfMonth } },
      }),
      ctx.db.courseInstance.count({ where: { deletedAt: null, endDate: { gte: now } } }),
      computeVacantesLibres(ctx.db, now),
      enrollmentsByMonth(ctx.db, 6),
    ]);

    return {
      pendientesInscripcion,
      pendientesPago,
      pendientesDocs,
      empresasPend,
      inscriptosMes,
      cursosActivos,
      vacantesLibres,
      enrollmentsLast6Months,
    };
  }),
});

async function computeVacantesLibres(db: typeof import("@/lib/db").db, now: Date): Promise<number> {
  const instances = await db.courseInstance.findMany({
    where: { deletedAt: null, endDate: { gte: now } },
    select: {
      vacancies: true,
      _count: { select: { enrollments: { where: { status: { in: ["preinscripto", "validar_pago", "inscripto"] } } } } },
    },
  });
  return instances.reduce((acc, i) => acc + Math.max(0, i.vacancies - i._count.enrollments), 0);
}

async function enrollmentsByMonth(db: typeof import("@/lib/db").db, monthsBack: number) {
  const now = new Date();
  const buckets: Array<{ key: string; label: string; from: Date; to: Date }> = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    buckets.push({
      key: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`,
      label: from.toLocaleDateString("es-AR", { month: "short", year: "2-digit" }),
      from, to,
    });
  }
  const results: Array<{ key: string; label: string; total: number; inscriptos: number }> = [];
  for (const b of buckets) {
    const [total, inscriptos] = await Promise.all([
      db.enrollment.count({ where: { createdAt: { gte: b.from, lt: b.to }, deletedAt: null } }),
      db.enrollment.count({ where: { createdAt: { gte: b.from, lt: b.to }, deletedAt: null, status: "inscripto" } }),
    ]);
    results.push({ key: b.key, label: b.label, total, inscriptos });
  }
  return results;
}
