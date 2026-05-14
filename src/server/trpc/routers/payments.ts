import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, roleProcedure, protectedProcedure } from "../trpc";
import { audit } from "@/lib/audit";
import { notifyPaymentDecision } from "@/server/services/notifications";

const adminOrBedel = () => roleProcedure("admin", "bedel");
const onlyAlumno = () => roleProcedure("alumno");

export const paymentsRouter = router({
  // Alumno: lista sus pagos por inscripción
  myList: onlyAlumno()
    .input(z.object({ enrollmentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const enrollment = await ctx.db.enrollment.findFirst({
        where: { id: input.enrollmentId, studentId: ctx.session.user.id },
      });
      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.payment.findMany({
        where: { enrollmentId: enrollment.id, deletedAt: null },
        include: { fileObject: true },
        orderBy: { uploadedAt: "desc" },
      });
    }),

  // Alumno: registra un pago. El archivo ya subió a /api/upload?bucket=payments
  // El OCR pre-poblado viene del cliente (que llamó al endpoint que devuelve los datos).
  myCreate: onlyAlumno()
    .input(
      z.object({
        enrollmentId: z.string(),
        fileObjectId: z.string(),
        medio: z.string().optional().nullable(),
        fechaPago: z.coerce.date().optional().nullable(),
        monto: z.string().optional().nullable(),
        numeroOperacion: z.string().optional().nullable(),
        ocrText: z.string().optional().nullable(),
        ocrScore: z.number().int().min(0).max(100).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const enrollment = await ctx.db.enrollment.findFirst({
        where: { id: input.enrollmentId, studentId: ctx.session.user.id, deletedAt: null },
      });
      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND" });
      if (enrollment.status !== "validar_pago") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "La inscripción no está en estado 'Validar pago'.",
        });
      }

      const file = await ctx.db.fileObject.findUnique({ where: { id: input.fileObjectId } });
      if (!file || file.ownerUserId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const created = await ctx.db.payment.create({
        data: {
          enrollmentId: enrollment.id,
          fileObjectId: file.id,
          medio: input.medio ?? null,
          fechaPago: input.fechaPago ?? null,
          monto: input.monto ? input.monto : null,
          numeroOperacion: input.numeroOperacion ?? null,
          ocrText: input.ocrText ?? null,
          ocrScore: input.ocrScore ?? null,
        },
      });
      await audit({
        userId: ctx.session.user.id,
        ip: ctx.ip,
        action: "create",
        entity: "Payment",
        entityId: created.id,
        after: { enrollmentId: enrollment.id, ocrScore: input.ocrScore },
      });
      return created;
    }),

  // Backoffice
  list: adminOrBedel()
    .input(z.object({ enrollmentId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.payment.findMany({
        where: { enrollmentId: input.enrollmentId, deletedAt: null },
        include: { fileObject: true },
        orderBy: { uploadedAt: "desc" },
      }),
    ),

  approve: adminOrBedel()
    .input(
      z.object({
        id: z.string(),
        medio: z.string().optional().nullable(),
        fechaPago: z.coerce.date().optional().nullable(),
        monto: z.string().optional().nullable(),
        numeroOperacion: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.payment.findUniqueOrThrow({ where: { id: input.id }, include: { enrollment: true } });
      const updated = await ctx.db.payment.update({
        where: { id: input.id },
        data: {
          approved: true,
          rejectedReason: null,
          reviewedById: ctx.session.user.id,
          reviewedAt: new Date(),
          medio: input.medio ?? before.medio,
          fechaPago: input.fechaPago ?? before.fechaPago,
          monto: input.monto ?? (before.monto ? before.monto.toString() : null),
          numeroOperacion: input.numeroOperacion ?? before.numeroOperacion,
        },
      });

      // Si la inscripcion estaba en validar_pago → pasarla a inscripto.
      if (before.enrollment.status === "validar_pago") {
        await ctx.db.enrollment.update({
          where: { id: before.enrollmentId },
          data: { status: "inscripto" },
        });
      }

      await audit({
        userId: ctx.session.user.id, ip: ctx.ip,
        action: "approve", entity: "Payment", entityId: input.id,
        before, after: updated,
      });
      await notifyPaymentDecision(input.id, "approved").catch((err) => console.error("[pay.approve.notify]", err));
      return updated;
    }),

  reject: adminOrBedel()
    .input(z.object({ id: z.string(), reason: z.string().min(2) }))
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.payment.findUniqueOrThrow({ where: { id: input.id } });
      const updated = await ctx.db.payment.update({
        where: { id: input.id },
        data: {
          approved: false,
          rejectedReason: input.reason,
          reviewedById: ctx.session.user.id,
          reviewedAt: new Date(),
        },
      });
      await audit({
        userId: ctx.session.user.id, ip: ctx.ip,
        action: "reject", entity: "Payment", entityId: input.id,
        before, after: updated,
      });
      await notifyPaymentDecision(input.id, "rejected").catch((err) => console.error("[pay.reject.notify]", err));
      return updated;
    }),

  // Endpoint público: marca una inscripción como "Solicitar pago" (alumno usa este).
  // De hecho el alumno no necesita esto; el bedel mueve a "validar_pago".
  // Helper que devuelve estado actual + flag de “puede subir”.
  inscripcionState: protectedProcedure
    .input(z.object({ enrollmentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const e = await ctx.db.enrollment.findFirstOrThrow({
        where: { id: input.enrollmentId, studentId: ctx.session.user.id, deletedAt: null },
      });
      const settings = await ctx.db.setting.findMany({
        where: { key: { in: ["payments.bankInfo", "payments.instructions"] } },
      });
      const bankInfo = settings.find((s) => s.key === "payments.bankInfo")?.value ?? null;
      const instructions = settings.find((s) => s.key === "payments.instructions")?.value ?? null;
      return {
        canUpload: e.status === "validar_pago",
        status: e.status,
        bankInfo,
        instructions,
      };
    }),
});
