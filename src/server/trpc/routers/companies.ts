import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, roleProcedure, protectedProcedure } from "../trpc";
import { audit } from "@/lib/audit";

const adminOrBedel = () => roleProcedure("admin", "bedel");

export const companiesRouter = router({
  list: adminOrBedel()
    .input(
      z
        .object({
          q: z.string().optional(),
          status: z.enum(["approved", "pending_approval", "rejected"]).optional(),
          includeDeleted: z.boolean().default(false),
        })
        .optional(),
    )
    .query(({ ctx, input }) =>
      ctx.db.empresa.findMany({
        where: {
          AND: [
            input?.includeDeleted ? {} : { deletedAt: null },
            input?.status ? { status: input.status } : {},
            input?.q
              ? { OR: [{ name: { contains: input.q } }, { cuit: { contains: input.q } }] }
              : {},
          ],
        },
        orderBy: { name: "asc" },
      }),
    ),

  // Lista pública (alumno) — solo aprobadas, sin metadata sensible.
  listForStudents: protectedProcedure.query(({ ctx }) =>
    ctx.db.empresa.findMany({
      where: { status: "approved", deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ),

  create: adminOrBedel()
    .input(z.object({ name: z.string().min(2).max(160), cuit: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const created = await ctx.db.empresa.create({
        data: { name: input.name, cuit: input.cuit ?? null, status: "approved" },
      });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "create", entity: "Empresa", entityId: created.id, after: created });
      return created;
    }),

  // Sugerida por un alumno desde la inscripción (queda pending_approval).
  suggest: protectedProcedure
    .input(z.object({ name: z.string().min(2).max(160) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.empresa.findUnique({ where: { name: input.name } });
      if (existing) return existing;
      const created = await ctx.db.empresa.create({
        data: {
          name: input.name,
          status: "pending_approval",
          suggestedByUserId: ctx.session.user.id,
        },
      });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "create", entity: "Empresa", entityId: created.id, after: created, meta: { suggested: true } });
      return created;
    }),

  approve: adminOrBedel()
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.empresa.update({ where: { id: input.id }, data: { status: "approved" } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "approve", entity: "Empresa", entityId: input.id });
      return updated;
    }),

  reject: adminOrBedel()
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.empresa.update({ where: { id: input.id }, data: { status: "rejected" } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "reject", entity: "Empresa", entityId: input.id });
      return updated;
    }),

  update: adminOrBedel()
    .input(z.object({ id: z.string(), name: z.string().min(2), cuit: z.string().nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.empresa.findUnique({ where: { id: input.id } });
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });
      const updated = await ctx.db.empresa.update({ where: { id: input.id }, data: { name: input.name, cuit: input.cuit ?? null } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "update", entity: "Empresa", entityId: input.id, before, after: updated });
      return updated;
    }),

  softDelete: adminOrBedel()
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.empresa.update({ where: { id: input.id }, data: { deletedAt: new Date() } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "delete", entity: "Empresa", entityId: input.id });
      return updated;
    }),
});
