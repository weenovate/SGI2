import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { router, publicProcedure } from "../trpc";
import { audit } from "@/lib/audit";
import { issueToken, consumeToken } from "@/lib/tokens";
import { sendEmail, renderBaseTemplate } from "@/lib/email";
import { env } from "@/lib/env";

export const registrationRouter = router({
  // HU - Registro abierto solo para rol Alumno.
  registerStudent: publicProcedure
    .input(
      z.object({
        docTypeId: z.string().min(1),
        docNumber: z.string().regex(/^\d+$/, "Solo dígitos").min(6).max(20),
        firstName: z.string().min(2).max(80),
        lastName: z.string().min(2).max(80),
        email: z.string().email(),
        password: z.string().min(8),
        birthDate: z.coerce.date(),
        acceptTerms: z.literal(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Edad mínima desde settings
      const minAgeRow = await ctx.db.setting.findUnique({ where: { key: "profile.minAge" } });
      const minAge = typeof minAgeRow?.value === "number" ? minAgeRow.value : 18;
      const ageMs = Date.now() - input.birthDate.getTime();
      const ageYears = ageMs / (365.25 * 86_400_000);
      if (ageYears < minAge) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Edad mínima: ${minAge} años.` });
      }

      const existsByEmail = await ctx.db.user.findUnique({ where: { email: input.email } });
      if (existsByEmail) throw new TRPCError({ code: "CONFLICT", message: "Email ya registrado" });

      const username = input.docNumber;
      const existsByUsername = await ctx.db.user.findUnique({ where: { username } });
      if (existsByUsername) throw new TRPCError({ code: "CONFLICT", message: "Ya existe una cuenta con ese DNI" });

      const created = await ctx.db.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            username,
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
            role: "alumno",
            status: "pending",
            passwordHash: await bcrypt.hash(input.password, 10),
          },
        });
        await tx.studentProfile.create({
          data: {
            userId: u.id,
            docTypeId: input.docTypeId,
            docNumber: input.docNumber,
            birthDate: input.birthDate,
          },
        });
        return u;
      });

      const ttlRow = await ctx.db.setting.findUnique({ where: { key: "security.emailVerificationHours" } });
      const ttl = typeof ttlRow?.value === "number" ? ttlRow.value : 24;
      const token = await issueToken({ purpose: "verify-email", identifier: created.id, ttlHours: ttl });

      const verifyUrl = `${env.APP_URL}/verificar-email?token=${token}`;
      await sendEmail({
        to: input.email,
        subject: "Verificá tu email | SGI - FuENN",
        html: renderBaseTemplate({
          title: "Confirmá tu cuenta",
          bodyHtml: `<p>Hola ${input.firstName},</p>
            <p>Para activar tu cuenta hacé click en el siguiente enlace (válido por ${ttl} hs):</p>
            <p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
        }),
      }).catch((err) => console.error("[register] sendEmail", err));

      await audit({ ip: ctx.ip, action: "create", entity: "User", entityId: created.id, after: { email: input.email, role: "alumno" }, meta: { source: "self_registration" } });

      return { ok: true, requiresEmailVerification: true };
    }),

  verifyEmail: publicProcedure
    .input(z.object({ token: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      const r = await consumeToken({ purpose: "verify-email", token: input.token });
      if (!r) throw new TRPCError({ code: "BAD_REQUEST", message: "Token inválido o expirado" });

      const user = await ctx.db.user.update({
        where: { id: r.identifier },
        data: { emailVerifiedAt: new Date(), status: "active" },
      });
      await audit({ userId: user.id, ip: ctx.ip, action: "update", entity: "User", entityId: user.id, after: { emailVerifiedAt: user.emailVerifiedAt } });
      return { ok: true, email: user.email };
    }),

  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({ where: { email: input.email } });
      // Por seguridad, devolvemos ok aunque el email no exista
      if (user) {
        const ttlRow = await ctx.db.setting.findUnique({ where: { key: "security.passwordResetHours" } });
        const ttl = typeof ttlRow?.value === "number" ? ttlRow.value : 1;
        const token = await issueToken({ purpose: "reset-password", identifier: user.id, ttlHours: ttl });
        const url = `${env.APP_URL}/reset-password?token=${token}`;
        await sendEmail({
          to: user.email,
          subject: "Reseteo de contraseña | SGI - FuENN",
          html: renderBaseTemplate({
            title: "Reseteá tu contraseña",
            bodyHtml: `<p>Recibimos tu pedido para resetear la contraseña.</p>
              <p>Hacé click acá (válido por ${ttl} hora/s):</p>
              <p><a href="${url}">${url}</a></p>
              <p>Si no fuiste vos, ignorá este mensaje.</p>`,
          }),
        }).catch((err) => console.error("[reset] sendEmail", err));
      }
      return { ok: true };
    }),

  confirmPasswordReset: publicProcedure
    .input(z.object({ token: z.string().min(8), password: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      const r = await consumeToken({ purpose: "reset-password", token: input.token });
      if (!r) throw new TRPCError({ code: "BAD_REQUEST", message: "Token inválido o expirado" });
      const passwordHash = await bcrypt.hash(input.password, 10);
      await ctx.db.user.update({
        where: { id: r.identifier },
        data: { passwordHash, failedAttempts: 0, lockedUntil: null },
      });
      await audit({ userId: r.identifier, ip: ctx.ip, action: "password.reset", entity: "User", entityId: r.identifier });
      return { ok: true };
    }),
});
