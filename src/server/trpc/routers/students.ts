import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { router, roleProcedure, protectedProcedure } from "../trpc";
import { audit } from "@/lib/audit";
import { sendEmail, renderBaseTemplate } from "@/lib/email";
import { env } from "@/lib/env";
import { issueToken, consumeToken } from "@/lib/tokens";

const adminOrBedel = () => roleProcedure("admin", "bedel");
const onlyAlumno = () => roleProcedure("alumno");

const profileFields = z.object({
  firstName: z.string().min(2).max(80),
  lastName: z.string().min(2).max(80),
  birthDate: z.coerce.date().nullable().optional(),
  nationality: z.string().nullable().optional(),
  titulacionId: z.string().nullable().optional(),
  empresaId: z.string().nullable().optional(),
  sindicatoId: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  countryId: z.string().nullable().optional(),
  provinciaId: z.string().nullable().optional(),
  localidadId: z.string().nullable().optional(),
  street: z.string().nullable().optional(),
  streetNumber: z.string().nullable().optional(),
  floor: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
});

export const studentsRouter = router({
  // ---- Vista alumno ----
  me: onlyAlumno().query(async ({ ctx }) => {
    const user = await ctx.db.user.findUniqueOrThrow({
      where: { id: ctx.session.user.id },
      include: { studentProfile: true },
    });
    return user;
  }),

  updateProfile: onlyAlumno()
    .input(profileFields)
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.studentProfile.findUnique({ where: { userId: ctx.session.user.id } });
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: { firstName: input.firstName, lastName: input.lastName },
      });
      const updated = await ctx.db.studentProfile.update({
        where: { userId: ctx.session.user.id },
        data: {
          birthDate: input.birthDate ?? null,
          nationality: input.nationality ?? null,
          titulacionId: input.titulacionId ?? null,
          empresaId: input.empresaId ?? null,
          sindicatoId: input.sindicatoId ?? null,
          phone: input.phone ?? null,
          countryId: input.countryId ?? null,
          provinciaId: input.provinciaId ?? null,
          localidadId: input.localidadId ?? null,
          street: input.street ?? null,
          streetNumber: input.streetNumber ?? null,
          floor: input.floor ?? null,
          unit: input.unit ?? null,
        },
      });

      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "update", entity: "StudentProfile", entityId: updated.id, before, after: updated });
      return updated;
    }),

  // HU5-2: cambio de email con verificación en la cuenta nueva.
  requestEmailChange: protectedProcedure
    .input(z.object({ newEmail: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUniqueOrThrow({ where: { id: ctx.session.user.id } });
      if (!user.passwordHash || !(await bcrypt.compare(input.password, user.passwordHash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Contraseña incorrecta" });
      }
      const exists = await ctx.db.user.findUnique({ where: { email: input.newEmail } });
      if (exists && exists.id !== user.id) throw new TRPCError({ code: "CONFLICT", message: "Email ya en uso" });

      const token = await issueToken({
        purpose: "change-email",
        identifier: `${user.id}:${input.newEmail}`,
        ttlHours: 24,
      });
      const url = `${env.APP_URL}/confirmar-email?token=${token}`;
      await sendEmail({
        to: input.newEmail,
        subject: "Confirmá tu nuevo email | SGI",
        html: renderBaseTemplate({
          title: "Confirmá tu nuevo email",
          bodyHtml: `<p>Para completar el cambio, confirmá esta dirección:</p>
            <p><a href="${url}">${url}</a></p>`,
        }),
      }).catch((err) => console.error("[email-change] sendEmail", err));
      return { ok: true };
    }),

  confirmEmailChange: protectedProcedure
    .input(z.object({ token: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      const r = await consumeToken({ purpose: "change-email", token: input.token });
      if (!r) throw new TRPCError({ code: "BAD_REQUEST", message: "Token inválido o expirado" });
      const [userId, newEmail] = r.identifier.split(":");
      if (!userId || !newEmail) throw new TRPCError({ code: "BAD_REQUEST" });
      if (userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const before = await ctx.db.user.findUniqueOrThrow({ where: { id: userId } });
      await ctx.db.user.update({ where: { id: userId }, data: { email: newEmail, emailVerifiedAt: new Date() } });
      await audit({ userId, ip: ctx.ip, action: "email.change", entity: "User", entityId: userId, before: { email: before.email }, after: { email: newEmail } });
      return { ok: true };
    }),

  changePassword: protectedProcedure
    .input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUniqueOrThrow({ where: { id: ctx.session.user.id } });
      if (!user.passwordHash || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Contraseña actual incorrecta" });
      }
      await ctx.db.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(input.newPassword, 10) },
      });
      await audit({ userId: user.id, ip: ctx.ip, action: "password.change", entity: "User", entityId: user.id });
      return { ok: true };
    }),

  // ---- Backoffice (HU10) ----
  list: adminOrBedel()
    .input(z.object({ q: z.string().optional(), includeDeleted: z.boolean().default(false) }).optional())
    .query(({ ctx, input }) =>
      ctx.db.user.findMany({
        where: {
          role: "alumno",
          ...(input?.includeDeleted ? {} : { deletedAt: null }),
          ...(input?.q
            ? {
                OR: [
                  { username: { contains: input.q } },
                  { email: { contains: input.q } },
                  { firstName: { contains: input.q } },
                  { lastName: { contains: input.q } },
                ],
              }
            : {}),
        },
        include: { studentProfile: true },
        orderBy: { lastName: "asc" },
      }),
    ),

  // Crear alumno desde backoffice (HU10-2): envía credenciales por email
  create: adminOrBedel()
    .input(
      z.object({
        docTypeId: z.string(),
        docNumber: z.string().regex(/^\d+$/),
        firstName: z.string().min(2),
        lastName: z.string().min(2),
        email: z.string().email(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const username = input.docNumber;
      const exists = await ctx.db.user.findFirst({ where: { OR: [{ username }, { email: input.email }] } });
      if (exists) throw new TRPCError({ code: "CONFLICT", message: "Email o documento ya en uso" });

      const tempPass = generatePassword();
      const created = await ctx.db.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            username,
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
            role: "alumno",
            status: "pending",
            passwordHash: await bcrypt.hash(tempPass, 10),
          },
        });
        await tx.studentProfile.create({
          data: { userId: u.id, docTypeId: input.docTypeId, docNumber: input.docNumber },
        });
        return u;
      });

      const token = await issueToken({ purpose: "verify-email", identifier: created.id, ttlHours: 24 });
      const verifyUrl = `${env.APP_URL}/verificar-email?token=${token}`;
      await sendEmail({
        to: input.email,
        subject: "Tus credenciales de acceso a SGI",
        html: renderBaseTemplate({
          title: "Bienvenido a SGI - FuENN",
          bodyHtml: `<p>Hola ${input.firstName},</p>
            <p>Se creó tu cuenta de alumno. Tus credenciales temporales:</p>
            <ul>
              <li><strong>Usuario:</strong> ${username}</li>
              <li><strong>Contraseña temporal:</strong> ${tempPass}</li>
            </ul>
            <p>Validá tu email haciendo click en este enlace:</p>
            <p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
        }),
      }).catch((err) => console.error("[students.create] sendEmail", err));

      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "create", entity: "User", entityId: created.id, after: { email: created.email, role: "alumno" } });
      return created;
    }),

  resetPassword: adminOrBedel()
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({ where: { id: input.id } });
      if (!user || user.role !== "alumno") throw new TRPCError({ code: "NOT_FOUND" });
      const tempPass = generatePassword();
      await ctx.db.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(tempPass, 10), failedAttempts: 0, lockedUntil: null },
      });
      await sendEmail({
        to: user.email,
        subject: "Reseteo de contraseña | SGI",
        html: renderBaseTemplate({
          title: "Reseteo de contraseña",
          bodyHtml: `<p>Tu nueva contraseña temporal: <strong>${tempPass}</strong></p>`,
        }),
      }).catch((err) => console.error("[students.resetPassword] sendEmail", err));
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "password.reset", entity: "User", entityId: user.id });
      return { ok: true };
    }),

  softDelete: adminOrBedel()
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.update({ where: { id: input.id }, data: { deletedAt: new Date(), status: "suspended" } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "delete", entity: "User", entityId: input.id });
      return { ok: true };
    }),

  restore: roleProcedure("admin")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.update({ where: { id: input.id }, data: { deletedAt: null, status: "active" } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "restore", entity: "User", entityId: input.id });
      return { ok: true };
    }),
});

function generatePassword(len = 12) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  let out = "";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += alphabet[arr[i]! % alphabet.length];
  return out;
}
