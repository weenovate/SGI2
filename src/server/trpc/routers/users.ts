import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { router, roleProcedure } from "../trpc";
import { audit } from "@/lib/audit";
import { userPublicSelect } from "../selects";

const adminOnly = () => roleProcedure("admin");

const adminBackofficeRoles = ["admin", "bedel", "manager"] as const;

export const usersRouter = router({
  list: adminOnly()
    .input(
      z
        .object({
          q: z.string().optional(),
          role: z.enum(["admin", "bedel", "manager", "docente", "alumno"]).optional(),
          includeDeleted: z.boolean().default(false),
        })
        .optional(),
    )
    .query(({ ctx, input }) =>
      ctx.db.user.findMany({
        where: {
          AND: [
            input?.includeDeleted ? {} : { deletedAt: null },
            input?.role ? { role: input.role } : {},
            input?.q
              ? {
                  OR: [
                    { username: { contains: input.q } },
                    { email: { contains: input.q } },
                    { firstName: { contains: input.q } },
                    { lastName: { contains: input.q } },
                  ],
                }
              : {},
          ],
        },
        orderBy: [{ role: "asc" }, { lastName: "asc" }],
        select: userPublicSelect,
      }),
    ),

  // Crea Admin/Bedel/Manager. Para Docentes y Alumnos hay routers dedicados.
  create: adminOnly()
    .input(
      z.object({
        docTypeId: z.string().min(1),
        docNumber: z.string().min(3).max(20),
        firstName: z.string().min(2).max(80),
        lastName: z.string().min(2).max(80),
        role: z.enum(adminBackofficeRoles),
        email: z.string().email(),
        password: z.string().min(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existsByEmail = await ctx.db.user.findUnique({ where: { email: input.email } });
      if (existsByEmail) throw new TRPCError({ code: "CONFLICT", message: "Email ya en uso" });

      const username = input.docNumber.replace(/\D/g, "");
      const existsByUsername = await ctx.db.user.findUnique({ where: { username } });
      if (existsByUsername) throw new TRPCError({ code: "CONFLICT", message: "Usuario ya en uso" });

      const created = await ctx.db.user.create({
        data: {
          username,
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          role: input.role,
          status: "active",
          emailVerifiedAt: new Date(),
          passwordHash: await bcrypt.hash(input.password, 10),
        },
      });
      await audit({
        userId: ctx.session.user.id,
        ip: ctx.ip,
        action: "create",
        entity: "User",
        entityId: created.id,
        after: { email: created.email, role: created.role },
      });
      return created;
    }),

  update: adminOnly()
    .input(
      z.object({
        id: z.string(),
        firstName: z.string().min(2),
        lastName: z.string().min(2),
        email: z.string().email(),
        role: z.enum(adminBackofficeRoles),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.user.findUnique({ where: { id: input.id } });
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });
      const updated = await ctx.db.user.update({
        where: { id: input.id },
        data: { firstName: input.firstName, lastName: input.lastName, email: input.email, role: input.role },
      });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "update", entity: "User", entityId: input.id, before, after: updated });
      return updated;
    }),

  resetPassword: adminOnly()
    .input(z.object({ id: z.string(), password: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.update({
        where: { id: input.id },
        data: { passwordHash: await bcrypt.hash(input.password, 10), failedAttempts: 0, lockedUntil: null },
      });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "password.reset", entity: "User", entityId: input.id });
      return { ok: true };
    }),

  softDelete: adminOnly()
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No podés eliminar tu propio usuario" });
      }
      await ctx.db.user.update({ where: { id: input.id }, data: { deletedAt: new Date(), status: "suspended" }});
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "delete", entity: "User", entityId: input.id });
      return { ok: true };
    }),

  restore: adminOnly()
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.user.update({ where: { id: input.id }, data: { deletedAt: null, status: "active" } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "restore", entity: "User", entityId: input.id });
      return updated;
    }),
});
