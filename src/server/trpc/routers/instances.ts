import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, roleProcedure, publicProcedure } from "../trpc";
import { audit } from "@/lib/audit";

const adminOrBedel = () => roleProcedure("admin", "bedel");

const courseTypeEnum = z.enum(["completo", "actualizacion", "completo_y_actualizacion"]);
const modalityEnum = z.enum(["virtual", "presencial", "hibrido"]);

const createInput = z.object({
  courseId: z.string(),
  edition: z.number().int().min(1000).max(99999),
  type: courseTypeEnum,
  modality: modalityEnum,
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  teacherId: z.string().optional().nullable(),
  vacancies: z.number().int().min(0),
  hoursBeforeClose: z.number().int().min(0).default(0),
  waitlistEnabled: z.boolean().default(false),
  showVacancies: z.boolean().default(true),
});

export const instancesRouter = router({
  // Backoffice: lista paginada con filtros
  list: adminOrBedel()
    .input(
      z
        .object({
          q: z.string().optional(),
          courseId: z.string().optional(),
          teacherId: z.string().optional(),
          modality: modalityEnum.optional(),
          fromDate: z.coerce.date().optional(),
          toDate: z.coerce.date().optional(),
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
          input?.courseId ? { courseId: input.courseId } : {},
          input?.teacherId ? { teacherId: input.teacherId } : {},
          input?.modality ? { modality: input.modality } : {},
          input?.fromDate || input?.toDate
            ? { startDate: { gte: input.fromDate ?? undefined, lte: input.toDate ?? undefined } }
            : {},
          input?.q
            ? {
                OR: [
                  { course: { name: { contains: input.q } } },
                  { course: { abbr: { contains: input.q } } },
                ],
              }
            : {},
        ],
      };
      const [items, total] = await Promise.all([
        ctx.db.courseInstance.findMany({
          where,
          include: {
            course: { include: { category: true } },
            teacher: { include: { user: true } },
            _count: { select: { enrollments: true, waitlistEntries: true } },
          },
          orderBy: { startDate: "asc" },
          skip: ((input?.page ?? 1) - 1) * (input?.pageSize ?? 50),
          take: input?.pageSize ?? 50,
        }),
        ctx.db.courseInstance.count({ where }),
      ]);
      return { items, total };
    }),

  byId: adminOrBedel()
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.courseInstance.findUnique({
        where: { id: input.id },
        include: {
          course: { include: { category: true, requisites: true } },
          teacher: { include: { user: true } },
          _count: { select: { enrollments: true, waitlistEntries: true } },
        },
      }),
    ),

  create: adminOrBedel()
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      if (input.endDate < input.startDate) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Fecha de fin anterior a la de inicio" });
      }
      const exists = await ctx.db.courseInstance.findFirst({
        where: { courseId: input.courseId, edition: input.edition, deletedAt: null },
      });
      if (exists) throw new TRPCError({ code: "CONFLICT", message: "Ya existe esa edición para el curso" });

      const created = await ctx.db.courseInstance.create({
        data: {
          ...input,
          teacherId: input.teacherId ?? null,
          startTime: input.startTime ?? null,
          createdBy: ctx.session.user.id,
        },
      });
      await audit({
        userId: ctx.session.user.id,
        ip: ctx.ip,
        action: "create",
        entity: "CourseInstance",
        entityId: created.id,
        after: created,
      });
      return created;
    }),

  update: adminOrBedel()
    .input(z.object({ id: z.string() }).merge(createInput))
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.courseInstance.findUnique({ where: { id: input.id } });
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });
      const updated = await ctx.db.courseInstance.update({
        where: { id: input.id },
        data: {
          ...input,
          teacherId: input.teacherId ?? null,
          startTime: input.startTime ?? null,
        },
      });
      await audit({
        userId: ctx.session.user.id,
        ip: ctx.ip,
        action: "update",
        entity: "CourseInstance",
        entityId: input.id,
        before,
        after: updated,
      });
      return updated;
    }),

  softDelete: adminOrBedel()
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.courseInstance.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
      await audit({
        userId: ctx.session.user.id,
        ip: ctx.ip,
        action: "delete",
        entity: "CourseInstance",
        entityId: input.id,
      });
      return updated;
    }),

  restore: roleProcedure("admin")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.courseInstance.update({
        where: { id: input.id },
        data: { deletedAt: null },
      });
      await audit({
        userId: ctx.session.user.id,
        ip: ctx.ip,
        action: "restore",
        entity: "CourseInstance",
        entityId: input.id,
      });
      return updated;
    }),

  // ============================================================
  // Público (HU1, HU2)
  // ============================================================

  publicCalendar: publicProcedure
    .input(
      z
        .object({
          q: z.string().optional(),
          monthYear: z
            .object({ month: z.number().int().min(1).max(12), year: z.number().int() })
            .optional(),
          onlyAvailable: z.boolean().default(false),
          take: z.number().int().min(1).max(60).default(12),
          cursor: z.string().optional(), // id de la última instancia mostrada
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const fromDate = input?.monthYear
        ? new Date(Date.UTC(input.monthYear.year, input.monthYear.month - 1, 1))
        : now;
      const toDate = input?.monthYear
        ? new Date(Date.UTC(input.monthYear.year, input.monthYear.month, 1))
        : undefined;

      const showVacanciesSetting = await ctx.db.setting.findUnique({ where: { key: "schedule.showVacancies" } });
      const showVacancies = showVacanciesSetting?.value !== false;

      const baseWhere = {
        deletedAt: null,
        endDate: { gte: now }, // ya iniciados o futuros, solo ocultar pasados
        startDate: toDate ? { gte: fromDate, lt: toDate } : { gte: fromDate },
        ...(input?.q
          ? {
              course: {
                OR: [
                  { name: { contains: input.q } },
                  { abbr: { contains: input.q } },
                  { category: { label: { contains: input.q } } },
                ],
              },
            }
          : {}),
      };

      const items = await ctx.db.courseInstance.findMany({
        where: baseWhere,
        include: {
          course: { include: { category: true } },
          teacher: { include: { user: true } },
          _count: { select: { enrollments: { where: { status: { in: ["preinscripto", "validar_pago", "inscripto"] } } } } },
        },
        orderBy: [{ startDate: "asc" }, { id: "asc" }],
        take: (input?.take ?? 12) + 1,
        ...(input?.cursor
          ? {
              cursor: { id: input.cursor },
              skip: 1,
            }
          : {}),
      });

      const hasMore = items.length > (input?.take ?? 12);
      const sliced = hasMore ? items.slice(0, input?.take ?? 12) : items;

      const enriched = sliced
        .map((it) => {
          const taken = it._count.enrollments;
          const free = Math.max(0, it.vacancies - taken);
          const closingSoonDays = 7;
          const closeAt = new Date(it.startDate.getTime() - it.hoursBeforeClose * 3600_000);
          const daysToClose = Math.ceil((closeAt.getTime() - now.getTime()) / 86_400_000);
          const closingSoon = daysToClose >= 0 && daysToClose <= closingSoonDays;
          // Visibilidad efectiva: master switch global AND la opción
          // que el admin puede pisar por instancia.
          const showVac = showVacancies && it.showVacancies;

          const status = {
            sinVacantes: free === 0,
            pocasVacantes: free > 0 && free <= 3,
            cierraPronto: closingSoon,
          };

          return {
            id: it.id,
            edition: it.edition,
            type: it.type,
            modality: it.modality,
            startDate: it.startDate,
            endDate: it.endDate,
            startTime: it.startTime,
            showVacancies: showVac,
            vacancies: it.vacancies,
            free,
            closeAt,
            course: {
              id: it.course.id,
              abbr: it.course.abbr,
              name: it.course.name,
              imageUrl: it.course.imageUrl,
              category: it.course.category ? { label: it.course.category.label, color: it.course.category.color } : null,
            },
            teacher: it.teacher
              ? { name: `${it.teacher.user.firstName ?? ""} ${it.teacher.user.lastName ?? ""}`.trim() }
              : null,
            status,
          };
        })
        .filter((it) => (input?.onlyAvailable ? !it.status.sinVacantes : true));

      const nextCursor = hasMore ? sliced[sliced.length - 1]?.id ?? null : null;
      return { items: enriched, nextCursor };
    }),

  // Conteos para la pill X/Y del calendario público.
  // - `filtered`: cuenta con los filtros aplicados (mismo where que
  //   `publicCalendar`, sin paginar y sin el filtro client-side
  //   `onlyAvailable` que se aplica sobre datos enriquecidos).
  // - `total`: cuenta total sin filtros (solo el piso temporal:
  //   instancias no eliminadas con `endDate >= now`).
  publicCalendarCounts: publicProcedure
    .input(
      z
        .object({
          q: z.string().optional(),
          monthYear: z
            .object({ month: z.number().int().min(1).max(12), year: z.number().int() })
            .optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const fromDate = input?.monthYear
        ? new Date(Date.UTC(input.monthYear.year, input.monthYear.month - 1, 1))
        : now;
      const toDate = input?.monthYear
        ? new Date(Date.UTC(input.monthYear.year, input.monthYear.month, 1))
        : undefined;

      const filteredWhere = {
        deletedAt: null,
        endDate: { gte: now },
        startDate: toDate ? { gte: fromDate, lt: toDate } : { gte: fromDate },
        ...(input?.q
          ? {
              course: {
                OR: [
                  { name: { contains: input.q } },
                  { abbr: { contains: input.q } },
                  { category: { label: { contains: input.q } } },
                ],
              },
            }
          : {}),
      };
      const totalWhere = { deletedAt: null, endDate: { gte: now } };
      const [filtered, total] = await Promise.all([
        ctx.db.courseInstance.count({ where: filteredWhere }),
        ctx.db.courseInstance.count({ where: totalWhere }),
      ]);
      return { filtered, total };
    }),

  publicById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const inst = await ctx.db.courseInstance.findFirst({
        where: { id: input.id, deletedAt: null },
        include: {
          course: { include: { category: true, requisites: { include: { } } } },
          teacher: { include: { user: true } },
          _count: { select: { enrollments: { where: { status: { in: ["preinscripto", "validar_pago", "inscripto"] } } } } },
        },
      });
      if (!inst) throw new TRPCError({ code: "NOT_FOUND" });

      const tipos = await ctx.db.tipoDocumentacion.findMany({
        where: { id: { in: inst.course.requisites.map((r) => r.tipoDocumentacionId) } },
      });

      const taken = inst._count.enrollments;
      const free = Math.max(0, inst.vacancies - taken);
      const showVacanciesSetting = await ctx.db.setting.findUnique({ where: { key: "schedule.showVacancies" } });
      const showVacanciesGlobal = showVacanciesSetting?.value !== false;
      const closeAt = new Date(inst.startDate.getTime() - inst.hoursBeforeClose * 3600_000);

      return {
        id: inst.id,
        edition: inst.edition,
        type: inst.type,
        modality: inst.modality,
        startDate: inst.startDate,
        endDate: inst.endDate,
        startTime: inst.startTime,
        closeAt,
        vacancies: inst.vacancies,
        free,
        showVacancies: showVacanciesGlobal && inst.showVacancies,
        sinVacantes: free === 0,
        course: {
          id: inst.course.id,
          abbr: inst.course.abbr,
          name: inst.course.name,
          objectives: inst.course.objectives,
          program: inst.course.program,
          imageUrl: inst.course.imageUrl,
          category: inst.course.category?.label ?? null,
          requisitos: tipos.map((t) => ({ id: t.id, label: t.label })),
        },
        teacher: inst.teacher
          ? { name: `${inst.teacher.user.firstName ?? ""} ${inst.teacher.user.lastName ?? ""}`.trim() }
          : null,
      };
    }),
});
