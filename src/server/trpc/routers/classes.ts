import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, roleProcedure } from "../trpc";
import { audit } from "@/lib/audit";
import { userPublicSelect } from "../selects";

const teacherOrAdminBedel = () => roleProcedure("docente", "admin", "bedel");

async function ensureInstanceAccess(
  ctx: { db: typeof import("@/lib/db").db; session: { user: { id: string; role: string } } },
  instanceId: string,
) {
  if (ctx.session.user.role === "docente") {
    const profile = await ctx.db.teacherProfile.findUniqueOrThrow({ where: { userId: ctx.session.user.id } });
    const inst = await ctx.db.courseInstance.findUnique({ where: { id: instanceId } });
    if (!inst || inst.teacherId !== profile.id) throw new TRPCError({ code: "FORBIDDEN" });
  }
}

export const classesRouter = router({
  // Clases programadas de una instancia
  list: teacherOrAdminBedel()
    .input(z.object({ instanceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureInstanceAccess(ctx, input.instanceId);
      return ctx.db.classSession.findMany({
        where: { instanceId: input.instanceId },
        include: { attendances: true },
        orderBy: { date: "asc" },
      });
    }),

  create: teacherOrAdminBedel()
    .input(
      z.object({
        instanceId: z.string(),
        date: z.coerce.date(),
        topic: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureInstanceAccess(ctx, input.instanceId);
      const created = await ctx.db.classSession.create({
        data: { instanceId: input.instanceId, date: input.date, topic: input.topic ?? null },
      });
      await audit({
        userId: ctx.session.user.id,
        ip: ctx.ip,
        action: "create",
        entity: "ClassSession",
        entityId: created.id,
        after: created,
      });
      return created;
    }),

  remove: teacherOrAdminBedel()
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const cls = await ctx.db.classSession.findUniqueOrThrow({ where: { id: input.id } });
      await ensureInstanceAccess(ctx, cls.instanceId);
      await ctx.db.classSession.delete({ where: { id: input.id } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "delete", entity: "ClassSession", entityId: input.id });
      return { ok: true };
    }),

  // Asistencia: marca el estado de un alumno para una clase
  setAttendance: teacherOrAdminBedel()
    .input(
      z.object({
        classSessionId: z.string(),
        enrollmentId: z.string(),
        status: z.enum(["presente", "ausente", "justificado", "tarde"]),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cls = await ctx.db.classSession.findUniqueOrThrow({ where: { id: input.classSessionId } });
      await ensureInstanceAccess(ctx, cls.instanceId);
      const enrollment = await ctx.db.enrollment.findUniqueOrThrow({ where: { id: input.enrollmentId } });
      if (enrollment.instanceId !== cls.instanceId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "La inscripción no pertenece a esa instancia" });
      }
      const att = await ctx.db.attendance.upsert({
        where: { classSessionId_enrollmentId: { classSessionId: cls.id, enrollmentId: enrollment.id } },
        update: { status: input.status, notes: input.notes ?? null, recordedAt: new Date(), recordedBy: ctx.session.user.id },
        create: {
          classSessionId: cls.id,
          enrollmentId: enrollment.id,
          status: input.status,
          notes: input.notes ?? null,
          recordedBy: ctx.session.user.id,
        },
      });
      return att;
    }),

  // Resumen de asistencia por alumno de la instancia (para HU asistencia)
  summary: teacherOrAdminBedel()
    .input(z.object({ instanceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureInstanceAccess(ctx, input.instanceId);
      const sessions = await ctx.db.classSession.findMany({ where: { instanceId: input.instanceId } });
      const enrollments = await ctx.db.enrollment.findMany({
        where: { instanceId: input.instanceId, deletedAt: null, status: "inscripto" },
        include: { student: { select: userPublicSelect } },
      });
      const totalSessions = sessions.length;
      const attendances = await ctx.db.attendance.findMany({
        where: { classSessionId: { in: sessions.map((s) => s.id) } },
      });
      const minPercentRow = await ctx.db.setting.findUnique({ where: { key: "attendance.minPercent" } });
      const minPercent = typeof minPercentRow?.value === "number" ? minPercentRow.value : 75;
      const rows = enrollments.map((e) => {
        const own = attendances.filter((a) => a.enrollmentId === e.id);
        const presentCount = own.filter((a) => a.status === "presente" || a.status === "justificado").length;
        const percent = totalSessions === 0 ? null : Math.round((presentCount * 100) / totalSessions);
        return {
          enrollmentId: e.id,
          studentName: `${e.student.lastName ?? ""}, ${e.student.firstName ?? ""}`.trim(),
          presentCount,
          totalSessions,
          percent,
          meetsMinimum: percent == null ? null : percent >= minPercent,
        };
      });
      return { rows, minPercent };
    }),
});
