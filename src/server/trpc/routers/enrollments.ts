import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, roleProcedure, protectedProcedure } from "../trpc";
import { audit } from "@/lib/audit";
import { sendEmail, renderBaseTemplate } from "@/lib/email";
import { env } from "@/lib/env";
import { computeRequirements, snapshotEnrollmentDocs } from "@/server/services/requirements";
import { generateEnrollmentCode } from "@/server/services/enrollment-code";
import { notifyEnrollmentCreated, notifyEnrollmentStatusChanged } from "@/server/services/notifications";
import { userPublicSelect } from "../selects";

const adminOrBedel = () => roleProcedure("admin", "bedel");
const onlyAlumno = () => roleProcedure("alumno");

export const enrollmentsRouter = router({
  // ---- Vista alumno ----

  // HU2-3 al cargar el detalle del curso
  checkRequirements: protectedProcedure
    .input(z.object({ courseId: z.string() }))
    .query(({ ctx, input }) => computeRequirements({ userId: ctx.session.user.id, courseId: input.courseId })),

  myList: onlyAlumno().query(({ ctx }) =>
    ctx.db.enrollment.findMany({
      where: { studentId: ctx.session.user.id, deletedAt: null },
      include: {
        instance: { include: { course: true, teacher: { include: { user: { select: userPublicSelect } } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ),

  // HU2-4 / HU2-5
  enroll: onlyAlumno()
    .input(
      z.object({
        instanceId: z.string(),
        payer: z.enum(["particular", "empresa"]),
        empresaId: z.string().optional().nullable(),
        empresaSuggestion: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Reglas globales del panel de configuracion
      const [
        allowMissingDocs,
        autoValidate,
        maxPerStudent,
        maxPerCourse,
        allowMultipleEditions,
      ] = await Promise.all([
        readSetting<boolean>(ctx.db, "enrollment.allowMissingDocs", false),
        readSetting<boolean>(ctx.db, "enrollment.autoValidateDocs", false),
        readSetting<number>(ctx.db, "schedule.maxEnrollmentsPerStudent", 0),
        readSetting<number>(ctx.db, "schedule.maxEnrollmentsPerCourse", 1),
        readSetting<boolean>(ctx.db, "schedule.allowMultipleEditions", false),
      ]);

      // Lecturas y validaciones que NO requieren lock (precheck rápido para
      // dar feedback temprano al usuario sin abrir transacción innecesaria).
      const inst = await ctx.db.courseInstance.findFirstOrThrow({
        where: { id: input.instanceId, deletedAt: null },
        include: { course: true },
      });
      const closeAt = new Date(inst.startDate.getTime() - inst.hoursBeforeClose * 3600_000);
      if (closeAt <= new Date()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "La inscripción ya está cerrada." });
      }

      // Requisitos de documentación (lectura, no compite por escritura).
      const req = await computeRequirements({ userId: ctx.session.user.id, courseId: inst.courseId });
      let observed = false;
      if (!req.allOk) {
        if (!allowMissingDocs) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "No cumplís con todos los requisitos de documentación.",
          });
        }
        observed = true;
      }

      const profile = await ctx.db.studentProfile.findUniqueOrThrow({ where: { userId: ctx.session.user.id } });

      // Empresa: si se sugiere una nueva, créala como pending_approval. Fuera
      // de la transacción de la inscripción porque la empresa sugerida puede
      // existir aunque la inscripción falle (la aprobación es independiente).
      let empresaId = input.empresaId ?? null;
      let empresaSuggestion = input.empresaSuggestion ?? null;
      if (input.payer === "empresa" && !empresaId && empresaSuggestion) {
        const sug = await ctx.db.empresa.create({
          data: { name: empresaSuggestion, status: "pending_approval", suggestedByUserId: ctx.session.user.id },
        });
        empresaId = sug.id;
        empresaSuggestion = null;
      }

      // Transacción crítica: lock pesimista sobre la fila de CourseInstance
      // para serializar el conteo de vacantes y los chequeos de unicidad por
      // alumno. Sin esto, dos enrolls simultáneos pueden overbookear.
      const result = await ctx.db.$transaction(async (tx) => {
        // SELECT ... FOR UPDATE sobre la instancia bloquea otras tx que
        // intenten enrolar al mismo curso hasta que esta commiteé.
        await tx.$queryRaw`SELECT id FROM CourseInstance WHERE id = ${inst.id} FOR UPDATE`;

        // Re-chequeos DENTRO de la sección crítica para evitar race conditions.
        if (maxPerStudent > 0) {
          const count = await tx.enrollment.count({
            where: { studentId: ctx.session.user.id, status: "preinscripto", deletedAt: null },
          });
          if (count >= maxPerStudent) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Tenés ${count} preinscripciones (máx ${maxPerStudent}).` });
          }
        }

        const sameInstance = await tx.enrollment.count({
          where: { studentId: ctx.session.user.id, instanceId: input.instanceId, status: { notIn: ["rechazado", "cancelado"] }, deletedAt: null },
        });
        if (maxPerCourse > 0 && sameInstance >= maxPerCourse) {
          throw new TRPCError({ code: "CONFLICT", message: "Ya estás inscripto a esta instancia." });
        }

        if (!allowMultipleEditions) {
          const sameCourse = await tx.enrollment.count({
            where: {
              studentId: ctx.session.user.id,
              status: { notIn: ["rechazado", "cancelado"] },
              deletedAt: null,
              instance: { courseId: inst.courseId },
            },
          });
          if (sameCourse > 0) {
            throw new TRPCError({ code: "CONFLICT", message: "Ya estás inscripto a otra edición de este curso." });
          }
        }

        const taken = await tx.enrollment.count({
          where: { instanceId: inst.id, status: { in: ["preinscripto", "validar_pago", "inscripto"] }, deletedAt: null },
        });
        if (inst.vacancies - taken <= 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: inst.waitlistEnabled
              ? "Sin vacantes — usá la opción de lista de espera."
              : "Sin vacantes.",
          });
        }

        const code = await generateEnrollmentCode(tx, inst.id);
        const enrollment = await tx.enrollment.create({
          data: {
            code,
            studentId: ctx.session.user.id,
            instanceId: inst.id,
            status: "preinscripto",
            payer: input.payer,
            empresaId,
            empresaSuggestion,
            observed,
          },
        });
        // Snapshot inmutable de la doc vigente al inscribirse
        await snapshotEnrollmentDocs(tx, enrollment.id, profile.id, inst.courseId);

        // Validación automática si está activa y la doc está OK
        if (autoValidate && req.allOk) {
          await tx.enrollment.update({
            where: { id: enrollment.id },
            data: { status: input.payer === "empresa" ? "inscripto" : "validar_pago" },
          });
        }

        return enrollment;
      });

      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "create", entity: "Enrollment", entityId: result.id, after: result });
      await notifyEnrollmentCreated(result.id).catch((err) => console.error("[enroll.notify]", err));
      return result;
    }),

  // HU3-2: cancelar
  cancel: onlyAlumno()
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const enrollment = await ctx.db.enrollment.findFirst({
        where: { id: input.id, studentId: ctx.session.user.id, deletedAt: null },
        include: { instance: true },
      });
      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND" });

      const cancelable = await readSetting<string[]>(ctx.db, "enrollment.cancelableStatuses", ["preinscripto", "validar_pago"]);
      if (!cancelable.includes(enrollment.status)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `No se puede cancelar en estado "${enrollment.status}".` });
      }
      const minHours = await readSetting<number>(ctx.db, "enrollment.cancelMinHoursBeforeStart", 24);
      const hoursToStart = (enrollment.instance.startDate.getTime() - Date.now()) / 3600_000;
      if (hoursToStart < minHours) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `No se puede cancelar a menos de ${minHours} hs del inicio.` });
      }

      await ctx.db.enrollment.update({ where: { id: input.id }, data: { status: "cancelado" } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "update", entity: "Enrollment", entityId: input.id, before: enrollment, after: { status: "cancelado" } });
      return { ok: true };
    }),

  // HU3-5: lista de espera
  enterWaitlist: onlyAlumno()
    .input(z.object({ instanceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const inst = await ctx.db.courseInstance.findFirstOrThrow({ where: { id: input.instanceId, deletedAt: null } });
      if (!inst.waitlistEnabled) throw new TRPCError({ code: "FORBIDDEN", message: "Lista de espera no habilitada." });

      const exists = await ctx.db.waitingListEntry.findUnique({
        where: { instanceId_studentId: { instanceId: inst.id, studentId: ctx.session.user.id } },
      });
      if (exists && !exists.removedAt) return exists;

      const last = await ctx.db.waitingListEntry.findFirst({
        where: { instanceId: inst.id, removedAt: null },
        orderBy: { position: "desc" },
      });
      const position = (last?.position ?? 0) + 1;

      const created = await ctx.db.waitingListEntry.upsert({
        where: { instanceId_studentId: { instanceId: inst.id, studentId: ctx.session.user.id } },
        update: { position, removedAt: null, createdAt: new Date() },
        create: { instanceId: inst.id, studentId: ctx.session.user.id, position },
      });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "create", entity: "WaitingListEntry", entityId: created.id });
      return created;
    }),

  leaveWaitlist: onlyAlumno()
    .input(z.object({ instanceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.waitingListEntry.update({
        where: { instanceId_studentId: { instanceId: input.instanceId, studentId: ctx.session.user.id } },
        data: { removedAt: new Date() },
      });
      return { ok: true };
    }),

  // ---- Backoffice (HU12) ----

  list: adminOrBedel()
    .input(
      z
        .object({
          q: z.string().optional(),
          status: z.enum(["preinscripto", "validar_pago", "inscripto", "rechazado", "cancelado", "lista_espera"]).optional(),
          instanceId: z.string().optional(),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(200).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const where = {
        deletedAt: null,
        ...(input?.status ? { status: input.status } : {}),
        ...(input?.instanceId ? { instanceId: input.instanceId } : {}),
        ...(input?.q
          ? {
              OR: [
                { code: { contains: input.q } },
                { student: { firstName: { contains: input.q } } },
                { student: { lastName: { contains: input.q } } },
                { student: { email: { contains: input.q } } },
                { student: { username: { contains: input.q } } },
              ],
            }
          : {}),
      };
      const [items, total] = await Promise.all([
        ctx.db.enrollment.findMany({
          where,
          include: {
            instance: { include: { course: true } },
            student: { select: { ...userPublicSelect, studentProfile: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: ((input?.page ?? 1) - 1) * (input?.pageSize ?? 50),
          take: input?.pageSize ?? 50,
        }),
        ctx.db.enrollment.count({ where }),
      ]);
      return { items, total };
    }),

  byId: adminOrBedel()
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const e = await ctx.db.enrollment.findUnique({
        where: { id: input.id },
        include: {
          instance: { include: { course: true, teacher: { include: { user: { select: userPublicSelect } } } } },
          student: { select: { ...userPublicSelect, studentProfile: true } },
          snapshots: true,
          payments: { include: { fileObject: true } },
        },
      });
      if (!e) return null;

      // Resolvemos los TipoDocumentacion y FileObject referenciados desde
      // los snapshots para poder mostrar miniaturas + metadatos.
      const tipoIds = Array.from(new Set(e.snapshots.map((s) => s.tipoDocumentacionId)));
      const allFileIds = Array.from(
        new Set(
          e.snapshots.flatMap((s) =>
            s.fileObjectIds
              .split(",")
              .map((id) => id.trim())
              .filter(Boolean),
          ),
        ),
      );
      const [tipos, fileObjects] = await Promise.all([
        tipoIds.length
          ? ctx.db.tipoDocumentacion.findMany({ where: { id: { in: tipoIds } } })
          : Promise.resolve([]),
        allFileIds.length
          ? ctx.db.fileObject.findMany({
              where: { id: { in: allFileIds } },
              select: { id: true, relPath: true, originalName: true, mime: true, size: true },
            })
          : Promise.resolve([]),
      ]);
      const tipoById = new Map(tipos.map((t) => [t.id, t]));
      const fileById = new Map(fileObjects.map((f) => [f.id, f]));

      const snapshots = e.snapshots.map((s) => ({
        ...s,
        tipo: tipoById.get(s.tipoDocumentacionId) ?? null,
        files: s.fileObjectIds
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
          .map((id) => fileById.get(id))
          .filter((f): f is NonNullable<typeof f> => Boolean(f)),
      }));

      return { ...e, snapshots };
    }),

  approve: adminOrBedel()
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.enrollment.findUniqueOrThrow({ where: { id: input.id } });
      let nextStatus: typeof before.status = before.status;
      if (before.status === "preinscripto") {
        nextStatus = before.payer === "empresa" ? "inscripto" : "validar_pago";
      } else if (before.status === "validar_pago") {
        nextStatus = "inscripto";
      } else {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `No se puede aprobar en estado "${before.status}".` });
      }
      const updated = await ctx.db.enrollment.update({ where: { id: input.id }, data: { status: nextStatus } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "approve", entity: "Enrollment", entityId: input.id, before, after: updated });
      await notifyEnrollmentStatusChanged(input.id, nextStatus).catch((err) => console.error("[approve.notify]", err));
      return updated;
    }),

  reject: adminOrBedel()
    .input(z.object({ id: z.string(), motivoId: z.string(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.enrollment.findUniqueOrThrow({ where: { id: input.id } });
      const updated = await ctx.db.enrollment.update({
        where: { id: input.id },
        data: { status: "rechazado", rechazoMotivoId: input.motivoId, notes: input.notes ?? null },
      });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "reject", entity: "Enrollment", entityId: input.id, before, after: updated });
      await notifyEnrollmentStatusChanged(input.id, "rechazado").catch((err) => console.error("[reject.notify]", err));
      return updated;
    }),

  // ---- Lista de espera (HU3-5, HU9-2) ----

  waitlistForInstance: adminOrBedel()
    .input(z.object({ instanceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const entries = await ctx.db.waitingListEntry.findMany({
        where: { instanceId: input.instanceId, removedAt: null },
        include: { offers: true },
        orderBy: { position: "asc" },
      });
      // WaitingListEntry.studentId no tiene @relation, así que hacemos un
      // join manual para mostrar nombre/email/dni en lugar del id crudo.
      const studentIds = entries.map((e) => e.studentId);
      const users = studentIds.length > 0
        ? await ctx.db.user.findMany({
            where: { id: { in: studentIds } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              username: true,
              studentProfile: { select: { docNumber: true } },
            },
          })
        : [];
      const usersById = new Map(users.map((u) => [u.id, u]));
      return entries.map((e) => ({ ...e, student: usersById.get(e.studentId) ?? null }));
    }),

  reorderWaitlist: adminOrBedel()
    .input(z.object({ instanceId: z.string(), order: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(async (tx) => {
        for (let i = 0; i < input.order.length; i++) {
          await tx.waitingListEntry.update({ where: { id: input.order[i]! }, data: { position: i + 1 } });
        }
      });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "update", entity: "WaitingList", entityId: input.instanceId, meta: { order: input.order } });
      return { ok: true };
    }),

  offerVacancy: adminOrBedel()
    .input(z.object({ entryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.waitingListEntry.findUniqueOrThrow({
        where: { id: input.entryId },
        include: { instance: { include: { course: true } } },
      });
      if (entry.removedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Entrada removida" });

      const window = await readSetting<number>(ctx.db, "waitlist.offerWindowHours", 48);
      const offer = await ctx.db.waitingListOffer.create({
        data: {
          entryId: entry.id,
          status: "pending",
          expiresAt: new Date(Date.now() + window * 3600_000),
          createdBy: ctx.session.user.id,
        },
      });

      const student = await ctx.db.user.findUnique({ where: { id: entry.studentId } });
      if (student?.email) {
        const url = `${env.APP_URL}/lista-espera/${offer.id}/aceptar`;
        await sendEmail({
          to: student.email,
          subject: `Tenés vacante en ${entry.instance.course.abbr} ${entry.instance.edition}`,
          html: renderBaseTemplate({
            title: "Vacante disponible",
            bodyHtml: `<p>Se liberó una vacante para ${entry.instance.course.name} (${entry.instance.course.abbr} ${entry.instance.edition}).</p>
              <p>Tenés ${window} hs para confirmar:</p>
              <p><a href="${url}">${url}</a></p>`,
          }),
        }).catch((e) => console.error("[waitlist.offer] email", e));
      }

      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "create", entity: "WaitingListOffer", entityId: offer.id, after: offer });
      return offer;
    }),

  acceptOffer: protectedProcedure
    .input(z.object({ offerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const offer = await ctx.db.waitingListOffer.findUniqueOrThrow({
        where: { id: input.offerId },
        include: { entry: { include: { instance: { include: { course: true } } } } },
      });
      if (offer.entry.studentId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (offer.status !== "pending") throw new TRPCError({ code: "PRECONDITION_FAILED" });
      if (offer.expiresAt < new Date()) {
        await ctx.db.waitingListOffer.update({ where: { id: offer.id }, data: { status: "expired" } });
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Oferta expirada" });
      }

      const profile = await ctx.db.studentProfile.findUniqueOrThrow({ where: { userId: ctx.session.user.id } });

      const result = await ctx.db.$transaction(async (tx) => {
        const code = await generateEnrollmentCode(tx, offer.entry.instanceId);
        const enrollment = await tx.enrollment.create({
          data: {
            code,
            studentId: ctx.session.user.id,
            instanceId: offer.entry.instanceId,
            status: "preinscripto",
            payer: "particular",
          },
        });
        await snapshotEnrollmentDocs(tx, enrollment.id, profile.id, offer.entry.instance.courseId);
        await tx.waitingListOffer.update({ where: { id: offer.id }, data: { status: "accepted", decidedAt: new Date() } });
        await tx.waitingListEntry.update({ where: { id: offer.entryId }, data: { removedAt: new Date() } });
        return enrollment;
      });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "create", entity: "Enrollment", entityId: result.id, meta: { fromWaitlist: true } });
      return result;
    }),

  rejectOffer: protectedProcedure
    .input(z.object({ offerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const offer = await ctx.db.waitingListOffer.findUniqueOrThrow({ where: { id: input.offerId }, include: { entry: true } });
      if (offer.entry.studentId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await ctx.db.waitingListOffer.update({ where: { id: offer.id }, data: { status: "rejected", decidedAt: new Date() } });
      return { ok: true };
    }),
});

async function readSetting<T>(db: { setting: { findUnique: (args: { where: { key: string } }) => Promise<{ value: unknown } | null> } }, key: string, fallback: T): Promise<T> {
  const row = await db.setting.findUnique({ where: { key } });
  if (row && row.value !== null && row.value !== undefined) return row.value as T;
  return fallback;
}
