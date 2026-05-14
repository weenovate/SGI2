import { z } from "zod";
import { router, roleProcedure } from "../trpc";
import { audit } from "@/lib/audit";
import { TRPCError } from "@trpc/server";

const adminOnly = () => roleProcedure("admin");

export const settingsRouter = router({
  // Cualquier usuario logueado puede leer la config (algunos flags afectan UI).
  list: roleProcedure("admin", "bedel", "manager", "docente", "alumno")
    .input(z.object({ category: z.string().optional() }).optional())
    .query(({ ctx, input }) =>
      ctx.db.setting.findMany({
        where: input?.category ? { category: input.category } : {},
        orderBy: [{ category: "asc" }, { key: "asc" }],
      }),
    ),

  get: roleProcedure("admin", "bedel", "manager", "docente", "alumno")
    .input(z.object({ key: z.string() }))
    .query(({ ctx, input }) => ctx.db.setting.findUnique({ where: { key: input.key } })),

  upsert: adminOnly()
    .input(z.object({ key: z.string(), value: z.unknown() }))
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.setting.findUnique({ where: { key: input.key } });
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: `Setting ${input.key} no existe` });

      // Validación tipada según el campo `type`
      const value = coerceValue(before.type, input.value);

      const updated = await ctx.db.setting.update({
        where: { key: input.key },
        data: { value: value as object, updatedBy: ctx.session.user.id },
      });
      await audit({
        userId: ctx.session.user.id,
        ip: ctx.ip,
        action: "update",
        entity: "Setting",
        entityId: input.key,
        before: before.value,
        after: updated.value,
      });
      return updated;
    }),

  // Permite cambiar varios al mismo tiempo (cuando se guarda una pestaña entera)
  upsertMany: adminOnly()
    .input(z.array(z.object({ key: z.string(), value: z.unknown() })))
    .mutation(async ({ ctx, input }) => {
      const results = [];
      for (const item of input) {
        const before = await ctx.db.setting.findUnique({ where: { key: item.key } });
        if (!before) continue;
        const value = coerceValue(before.type, item.value);
        const u = await ctx.db.setting.update({
          where: { key: item.key },
          data: { value: value as object, updatedBy: ctx.session.user.id },
        });
        results.push(u);
        await audit({
          userId: ctx.session.user.id,
          ip: ctx.ip,
          action: "update",
          entity: "Setting",
          entityId: item.key,
          before: before.value,
          after: u.value,
        });
      }
      return results;
    }),
});

function coerceValue(type: string, value: unknown) {
  switch (type) {
    case "integer":
      return Number(value);
    case "boolean":
      return Boolean(value);
    case "string":
    case "richtext":
    case "time":
    case "select":
      return String(value ?? "");
    case "multiselect":
      return Array.isArray(value) ? value : [];
    default:
      return value;
  }
}
