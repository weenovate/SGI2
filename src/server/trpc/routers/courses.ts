import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, roleProcedure, publicProcedure } from "../trpc";
import { audit } from "@/lib/audit";

const adminOrBedel = () => roleProcedure("admin", "bedel");

export const coursesRouter = router({
  list: adminOrBedel()
    .input(
      z
        .object({
          q: z.string().optional(),
          includeDeleted: z.boolean().default(false),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(200).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const where = {
        AND: [
          input?.includeDeleted ? {} : { deletedAt: null },
          input?.q
            ? {
                OR: [
                  { name: { contains: input.q } },
                  { abbr: { contains: input.q } },
                ],
              }
            : {},
        ],
      };
      const [items, total] = await Promise.all([
        ctx.db.course.findMany({
          where,
          include: { category: true, _count: { select: { instances: true, requisites: true } } },
          orderBy: { name: "asc" },
          skip: ((input?.page ?? 1) - 1) * (input?.pageSize ?? 50),
          take: input?.pageSize ?? 50,
        }),
        ctx.db.course.count({ where }),
      ]);
      return { items, total };
    }),

  publicList: publicProcedure
    .input(
      z
        .object({
          q: z.string().optional(),
          month: z.number().int().min(1).max(12).optional(),
          year: z.number().int().optional(),
          onlyAvailable: z.boolean().default(false),
          take: z.number().int().min(1).max(60).default(12),
          cursor: z.string().optional(),
        })
        .optional(),
    )
    .query(({ ctx }) => {
      // Implementación completa en Sprint 2 (calendario público).
      return ctx.db.course.findMany({ where: { deletedAt: null }, take: 0 });
    }),

  byId: adminOrBedel()
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.course.findUnique({
        where: { id: input.id },
        include: { category: true, requisites: { include: { } } },
      }),
    ),

  create: adminOrBedel()
    .input(
      z.object({
        abbr: z.string().min(3).max(6),
        name: z.string().min(3).max(160),
        categoryId: z.string().nullable().optional(),
        objectives: z.string().optional(),
        workload: z.number().int().positive().nullable().optional(),
        program: z.string().optional(),
        stcwRule: z.string().max(160).nullable().optional(),
        requisiteTipoIds: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const created = await ctx.db.course.create({
        data: {
          abbr: input.abbr.toUpperCase(),
          name: input.name,
          categoryId: input.categoryId ?? null,
          objectives: input.objectives ?? null,
          workload: input.workload ?? null,
          program: input.program ?? null,
          stcwRule: input.stcwRule ?? null,
          createdBy: ctx.session.user.id,
          requisites: {
            create: input.requisiteTipoIds.map((tipoDocumentacionId) => ({ tipoDocumentacionId })),
          },
        },
      });
      await audit({
        userId: ctx.session.user.id,
        ip: ctx.ip,
        action: "create",
        entity: "Course",
        entityId: created.id,
        after: created,
      });
      return created;
    }),

  update: adminOrBedel()
    .input(
      z.object({
        id: z.string(),
        abbr: z.string().min(3).max(6),
        name: z.string().min(3).max(160),
        categoryId: z.string().nullable().optional(),
        objectives: z.string().optional(),
        workload: z.number().int().positive().nullable().optional(),
        program: z.string().optional(),
        stcwRule: z.string().max(160).nullable().optional(),
        requisiteTipoIds: z.array(z.string()).default([]),
        propagateToInstances: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.course.findUnique({ where: { id: input.id } });
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.$transaction(async (tx) => {
        const u = await tx.course.update({
          where: { id: input.id },
          data: {
            abbr: input.abbr.toUpperCase(),
            name: input.name,
            categoryId: input.categoryId ?? null,
            objectives: input.objectives ?? null,
            workload: input.workload ?? null,
            program: input.program ?? null,
            stcwRule: input.stcwRule ?? null,
          },
        });
        // Reemplazar requisitos
        await tx.courseRequisite.deleteMany({ where: { courseId: input.id } });
        if (input.requisiteTipoIds.length > 0) {
          await tx.courseRequisite.createMany({
            data: input.requisiteTipoIds.map((tipoDocumentacionId) => ({ courseId: input.id, tipoDocumentacionId })),
          });
        }
        return u;
      });

      await audit({
        userId: ctx.session.user.id,
        ip: ctx.ip,
        action: "update",
        entity: "Course",
        entityId: input.id,
        before,
        after: updated,
        meta: { propagateToInstances: input.propagateToInstances },
      });

      // HU7-3: si se modifica un curso, ofrecer replicar a instancias.
      // En Sprint 2 (cuando tengamos CourseInstance CRUD) implementamos
      // la propagación real. Por ahora dejamos meta para trazar.
      return updated;
    }),

  softDelete: adminOrBedel()
    .input(z.object({ id: z.string(), confirmCascade: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const instances = await ctx.db.courseInstance.count({ where: { courseId: input.id, deletedAt: null } });
      if (instances > 0 && !input.confirmCascade) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `El curso tiene ${instances} instancia(s) activa(s). Confirmar cascada para continuar.`,
        });
      }
      const updated = await ctx.db.$transaction(async (tx) => {
        const c = await tx.course.update({ where: { id: input.id }, data: { deletedAt: new Date() } });
        if (instances > 0) {
          await tx.courseInstance.updateMany({ where: { courseId: input.id, deletedAt: null }, data: { deletedAt: new Date() } });
          // Las inscripciones se "anulan" indirectamente vía la instancia eliminada;
          // el cambio masivo de status se hará al confirmar Sprint 4.
        }
        return c;
      });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "delete", entity: "Course", entityId: input.id, meta: { cascadedInstances: instances } });
      return updated;
    }),

  restore: roleProcedure("admin")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.course.update({ where: { id: input.id }, data: { deletedAt: null } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "restore", entity: "Course", entityId: input.id });
      return updated;
    }),
});
