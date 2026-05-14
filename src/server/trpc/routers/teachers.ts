import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { router, roleProcedure } from "../trpc";
import { audit } from "@/lib/audit";
import { sendEmail, renderBaseTemplate } from "@/lib/email";
import { env } from "@/lib/env";

const adminOrBedel = () => roleProcedure("admin", "bedel");
const onlyDocente = () => roleProcedure("docente");

function generatePassword(len = 12) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  let out = "";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += alphabet[arr[i]! % alphabet.length];
  return out;
}

function normalizeCuit(cuit: string) {
  return cuit.replace(/[^\d]/g, "");
}

export const teachersRouter = router({
  // ---- Vista docente ----
  me: onlyDocente().query(async ({ ctx }) => {
    return ctx.db.teacherProfile.findUnique({
      where: { userId: ctx.session.user.id },
      include: { user: true },
    });
  }),

  myInstances: onlyDocente()
    .input(
      z
        .object({
          includePast: z.boolean().default(false),
          q: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const profile = await ctx.db.teacherProfile.findUniqueOrThrow({ where: { userId: ctx.session.user.id } });
      return ctx.db.courseInstance.findMany({
        where: {
          teacherId: profile.id,
          deletedAt: null,
          ...(input?.includePast ? {} : { endDate: { gte: new Date() } }),
          ...(input?.q
            ? {
                OR: [
                  { course: { name: { contains: input.q } } },
                  { course: { abbr: { contains: input.q } } },
                ],
              }
            : {}),
        },
        include: {
          course: { include: { category: true } },
          _count: { select: { enrollments: { where: { status: "inscripto" } } } },
        },
        orderBy: { startDate: "asc" },
      });
    }),

  alumnosForInstance: roleProcedure("docente", "admin", "bedel")
    .input(z.object({ instanceId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Si es docente, validar que la instancia sea propia
      if (ctx.session.user.role === "docente") {
        const profile = await ctx.db.teacherProfile.findUniqueOrThrow({ where: { userId: ctx.session.user.id } });
        const inst = await ctx.db.courseInstance.findUnique({ where: { id: input.instanceId } });
        if (!inst || inst.teacherId !== profile.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      return ctx.db.enrollment.findMany({
        where: {
          instanceId: input.instanceId,
          status: "inscripto",
          deletedAt: null,
        },
        include: {
          student: { include: { studentProfile: true } },
          grade: true,
        },
        orderBy: { student: { lastName: "asc" } },
      });
    }),

  list: adminOrBedel()
    .input(z.object({ q: z.string().optional(), includeDeleted: z.boolean().default(false) }).optional())
    .query(({ ctx, input }) =>
      ctx.db.teacherProfile.findMany({
        where: {
          AND: [
            input?.q
              ? {
                  OR: [
                    { user: { firstName: { contains: input.q } } },
                    { user: { lastName: { contains: input.q } } },
                    { cuit: { contains: input.q } },
                  ],
                }
              : {},
            input?.includeDeleted ? {} : { user: { deletedAt: null } },
          ],
        },
        include: { user: true },
        orderBy: { user: { lastName: "asc" } },
      }),
    ),

  byId: adminOrBedel()
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.teacherProfile.findUnique({ where: { id: input.id }, include: { user: true } }),
    ),

  create: adminOrBedel()
    .input(
      z.object({
        cuit: z.string().min(11).max(13),
        firstName: z.string().min(2).max(80),
        lastName: z.string().min(2).max(80),
        birthDate: z.coerce.date().nullable().optional(),
        titulacionId: z.string().nullable().optional(),
        email: z.string().email(),
        phone: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cuit = normalizeCuit(input.cuit);
      if (cuit.length !== 11) throw new TRPCError({ code: "BAD_REQUEST", message: "CUIT inválido" });

      const exists = await ctx.db.teacherProfile.findUnique({ where: { cuit } });
      if (exists) throw new TRPCError({ code: "CONFLICT", message: "Ya existe un docente con ese CUIT" });

      const tempPass = generatePassword();
      const passwordHash = await bcrypt.hash(tempPass, 10);

      const created = await ctx.db.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            username: cuit,
            email: input.email,
            passwordHash,
            role: "docente",
            status: "pending",
            firstName: input.firstName,
            lastName: input.lastName,
          },
        });
        const t = await tx.teacherProfile.create({
          data: {
            userId: u.id,
            cuit,
            birthDate: input.birthDate ?? null,
            titulacionId: input.titulacionId ?? null,
            phone: input.phone ?? null,
          },
        });
        return { user: u, teacher: t };
      });

      // HU8: enviar credenciales y enlace de validación.
      // El token de validación se generará en Sprint 3 al armar el flujo
      // completo de verificación. Por ahora un link al login.
      await sendEmail({
        to: input.email,
        subject: "Tus credenciales de acceso a SGI - FuENN",
        html: renderBaseTemplate({
          title: "Bienvenido a SGI - FuENN",
          bodyHtml: `<p>Hola ${input.firstName},</p>
            <p>Se creó tu usuario de docente. Tus credenciales son:</p>
            <ul>
              <li><strong>Usuario:</strong> ${cuit}</li>
              <li><strong>Contraseña temporal:</strong> ${tempPass}</li>
            </ul>
            <p>Ingresá en <a href="${env.APP_URL}/login">${env.APP_URL}/login</a> y cambiá tu contraseña.</p>`,
        }),
      }).catch((err) => console.error("[teachers.create] sendEmail failed", err));

      await audit({
        userId: ctx.session.user.id,
        ip: ctx.ip,
        action: "create",
        entity: "TeacherProfile",
        entityId: created.teacher.id,
        after: { cuit, email: input.email, name: `${input.firstName} ${input.lastName}` },
      });
      return created.teacher;
    }),

  update: adminOrBedel()
    .input(
      z.object({
        id: z.string(),
        firstName: z.string().min(2).max(80),
        lastName: z.string().min(2).max(80),
        email: z.string().email(),
        phone: z.string().optional(),
        titulacionId: z.string().nullable().optional(),
        birthDate: z.coerce.date().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.teacherProfile.findUnique({ where: { id: input.id }, include: { user: true } });
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: before.userId },
          data: { firstName: input.firstName, lastName: input.lastName, email: input.email },
        });
        return tx.teacherProfile.update({
          where: { id: input.id },
          data: {
            phone: input.phone ?? null,
            titulacionId: input.titulacionId ?? null,
            birthDate: input.birthDate ?? null,
          },
          include: { user: true },
        });
      });

      await audit({
        userId: ctx.session.user.id,
        ip: ctx.ip,
        action: "update",
        entity: "TeacherProfile",
        entityId: input.id,
        before,
        after: updated,
      });
      return updated;
    }),

  resetPassword: adminOrBedel()
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const t = await ctx.db.teacherProfile.findUnique({ where: { id: input.id }, include: { user: true } });
      if (!t) throw new TRPCError({ code: "NOT_FOUND" });
      const tempPass = generatePassword();
      await ctx.db.user.update({
        where: { id: t.userId },
        data: { passwordHash: await bcrypt.hash(tempPass, 10), failedAttempts: 0, lockedUntil: null },
      });
      await sendEmail({
        to: t.user.email,
        subject: "SGI - Reseteo de contraseña",
        html: renderBaseTemplate({
          title: "Reseteo de contraseña",
          bodyHtml: `<p>Tu nueva contraseña temporal: <strong>${tempPass}</strong></p>
            <p>Ingresá en <a href="${env.APP_URL}/login">${env.APP_URL}/login</a> y cambiala.</p>`,
        }),
      }).catch((err) => console.error("[teachers.resetPassword] sendEmail failed", err));

      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "password.reset", entity: "User", entityId: t.userId });
      return { ok: true };
    }),

  softDelete: adminOrBedel()
    .input(z.object({ id: z.string(), transferToTeacherId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const t = await ctx.db.teacherProfile.findUnique({ where: { id: input.id } });
      if (!t) throw new TRPCError({ code: "NOT_FOUND" });

      const activeInstances = await ctx.db.courseInstance.count({
        where: { teacherId: input.id, deletedAt: null, endDate: { gte: new Date() } },
      });

      if (activeInstances > 0 && !input.transferToTeacherId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `El docente tiene ${activeInstances} instancias activas. Indicar transferToTeacherId.`,
        });
      }

      await ctx.db.$transaction(async (tx) => {
        if (activeInstances > 0 && input.transferToTeacherId) {
          await tx.courseInstance.updateMany({
            where: { teacherId: input.id, deletedAt: null, endDate: { gte: new Date() } },
            data: { teacherId: input.transferToTeacherId },
          });
        }
        await tx.user.update({ where: { id: t.userId }, data: { deletedAt: new Date(), status: "suspended" } });
      });

      await audit({
        userId: ctx.session.user.id,
        ip: ctx.ip,
        action: "delete",
        entity: "TeacherProfile",
        entityId: input.id,
        meta: { transferTo: input.transferToTeacherId, transferred: activeInstances },
      });
      return { ok: true };
    }),
});
