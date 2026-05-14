import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, roleProcedure } from "../trpc";
import { audit } from "@/lib/audit";
import { notifyUser } from "@/server/services/notifications";

const teacherOrAdminBedel = () => roleProcedure("docente", "admin", "bedel");

async function ensureEnrollmentAccess(
  ctx: { db: typeof import("@/lib/db").db; session: { user: { id: string; role: string } } },
  enrollmentId: string,
) {
  if (ctx.session.user.role === "docente") {
    const profile = await ctx.db.teacherProfile.findUniqueOrThrow({ where: { userId: ctx.session.user.id } });
    const e = await ctx.db.enrollment.findUniqueOrThrow({
      where: { id: enrollmentId },
      include: { instance: true },
    });
    if (e.instance.teacherId !== profile.id) throw new TRPCError({ code: "FORBIDDEN" });
  }
}

export const gradesRouter = router({
  byEnrollment: teacherOrAdminBedel()
    .input(z.object({ enrollmentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureEnrollmentAccess(ctx, input.enrollmentId);
      return ctx.db.grade.findUnique({ where: { enrollmentId: input.enrollmentId } });
    }),

  upsert: teacherOrAdminBedel()
    .input(
      z.object({
        enrollmentId: z.string(),
        score: z.number().min(0).max(10).nullable().optional(),
        approved: z.boolean().nullable().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureEnrollmentAccess(ctx, input.enrollmentId);
      const before = await ctx.db.grade.findUnique({ where: { enrollmentId: input.enrollmentId } });

      const data = {
        score: input.score ?? null,
        approved: input.approved ?? null,
        notes: input.notes ?? null,
        recordedAt: new Date(),
        recordedBy: ctx.session.user.id,
      };

      const grade = await ctx.db.grade.upsert({
        where: { enrollmentId: input.enrollmentId },
        update: data,
        create: { enrollmentId: input.enrollmentId, ...data },
      });

      await audit({
        userId: ctx.session.user.id,
        ip: ctx.ip,
        action: before ? "update" : "create",
        entity: "Grade",
        entityId: grade.id,
        before,
        after: grade,
      });

      // Notificar al alumno
      const enrollment = await ctx.db.enrollment.findUniqueOrThrow({
        where: { id: input.enrollmentId },
        include: { instance: { include: { course: true } } },
      });
      const title = grade.approved === true
        ? "Calificación: aprobado"
        : grade.approved === false
          ? "Calificación: desaprobado"
          : "Calificación cargada";
      const body = `${enrollment.instance.course.name} (${enrollment.code})${grade.score != null ? ` — Nota: ${grade.score}` : ""}`;
      await notifyUser(enrollment.studentId, {
        title,
        body,
        level: grade.approved === false ? "important" : "info",
        expiresInDays: 30,
        email: {
          subject: `${title} | SGI - FuENN`,
        },
      }).catch((err) => console.error("[grades.upsert.notify]", err));

      return grade;
    }),
});
