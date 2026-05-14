import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, roleProcedure } from "../trpc";
import { audit } from "@/lib/audit";

const adminOrBedel = () => roleProcedure("admin", "bedel");
const adminOnly = () => roleProcedure("admin");

const idIn = z.object({ id: z.string().min(1) });

// ---------------------------------------------------------------
// Titulaciones
// ---------------------------------------------------------------
export const titulacionesRouter = router({
  list: adminOrBedel()
    .input(z.object({ includeDeleted: z.boolean().default(false) }).optional())
    .query(({ ctx, input }) =>
      ctx.db.titulacion.findMany({
        where: input?.includeDeleted ? {} : { deletedAt: null },
        orderBy: { label: "asc" },
      }),
    ),

  create: adminOrBedel()
    .input(z.object({ label: z.string().min(2).max(120) }))
    .mutation(async ({ ctx, input }) => {
      const created = await ctx.db.titulacion.create({ data: input });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "create", entity: "Titulacion", entityId: created.id, after: created });
      return created;
    }),

  update: adminOrBedel()
    .input(idIn.extend({ label: z.string().min(2).max(120), active: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.titulacion.findUnique({ where: { id: input.id } });
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });
      const updated = await ctx.db.titulacion.update({ where: { id: input.id }, data: { label: input.label, active: input.active ?? before.active } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "update", entity: "Titulacion", entityId: input.id, before, after: updated });
      return updated;
    }),

  softDelete: adminOrBedel()
    .input(idIn)
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.titulacion.findUnique({ where: { id: input.id } });
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });
      const updated = await ctx.db.titulacion.update({ where: { id: input.id }, data: { deletedAt: new Date() } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "delete", entity: "Titulacion", entityId: input.id, before });
      return updated;
    }),

  restore: adminOnly()
    .input(idIn)
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.titulacion.update({ where: { id: input.id }, data: { deletedAt: null } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "restore", entity: "Titulacion", entityId: input.id, after: updated });
      return updated;
    }),
});

// ---------------------------------------------------------------
// Sindicatos
// ---------------------------------------------------------------
export const sindicatosRouter = router({
  list: adminOrBedel()
    .input(z.object({ includeDeleted: z.boolean().default(false) }).optional())
    .query(({ ctx, input }) =>
      ctx.db.sindicato.findMany({
        where: input?.includeDeleted ? {} : { deletedAt: null },
        orderBy: { sigla: "asc" },
      }),
    ),

  create: adminOrBedel()
    .input(z.object({ sigla: z.string().min(2).max(20), label: z.string().min(2).max(160) }))
    .mutation(async ({ ctx, input }) => {
      const created = await ctx.db.sindicato.create({ data: input });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "create", entity: "Sindicato", entityId: created.id, after: created });
      return created;
    }),

  update: adminOrBedel()
    .input(idIn.extend({ sigla: z.string().min(2).max(20), label: z.string().min(2).max(160), active: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.sindicato.findUnique({ where: { id: input.id } });
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });
      const updated = await ctx.db.sindicato.update({ where: { id: input.id }, data: { sigla: input.sigla, label: input.label, active: input.active ?? before.active } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "update", entity: "Sindicato", entityId: input.id, before, after: updated });
      return updated;
    }),

  softDelete: adminOrBedel()
    .input(idIn)
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.sindicato.update({ where: { id: input.id }, data: { deletedAt: new Date() } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "delete", entity: "Sindicato", entityId: input.id });
      return updated;
    }),

  restore: adminOnly()
    .input(idIn)
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.sindicato.update({ where: { id: input.id }, data: { deletedAt: null } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "restore", entity: "Sindicato", entityId: input.id });
      return updated;
    }),
});

// ---------------------------------------------------------------
// Categorías de Curso
// ---------------------------------------------------------------
export const categoriasRouter = router({
  list: adminOrBedel()
    .input(z.object({ includeDeleted: z.boolean().default(false) }).optional())
    .query(({ ctx, input }) =>
      ctx.db.categoriaCurso.findMany({
        where: input?.includeDeleted ? {} : { deletedAt: null },
        orderBy: { label: "asc" },
      }),
    ),

  create: adminOrBedel()
    .input(z.object({ label: z.string().min(2).max(80), color: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const created = await ctx.db.categoriaCurso.create({ data: input });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "create", entity: "CategoriaCurso", entityId: created.id, after: created });
      return created;
    }),

  update: adminOrBedel()
    .input(idIn.extend({ label: z.string().min(2).max(80), color: z.string().nullable().optional(), active: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.categoriaCurso.update({ where: { id: input.id }, data: { label: input.label, color: input.color ?? null, active: input.active } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "update", entity: "CategoriaCurso", entityId: input.id, after: updated });
      return updated;
    }),

  softDelete: adminOrBedel()
    .input(idIn)
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.categoriaCurso.update({ where: { id: input.id }, data: { deletedAt: new Date() } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "delete", entity: "CategoriaCurso", entityId: input.id });
      return updated;
    }),

  restore: adminOnly()
    .input(idIn)
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.categoriaCurso.update({ where: { id: input.id }, data: { deletedAt: null } });
      return updated;
    }),
});

// ---------------------------------------------------------------
// Tipos de Documentación
// ---------------------------------------------------------------
export const tiposDocumentacionRouter = router({
  list: adminOrBedel()
    .input(z.object({ includeDeleted: z.boolean().default(false) }).optional())
    .query(({ ctx, input }) =>
      ctx.db.tipoDocumentacion.findMany({
        where: input?.includeDeleted ? {} : { deletedAt: null },
        orderBy: { label: "asc" },
      }),
    ),

  create: adminOrBedel()
    .input(z.object({ code: z.string().min(2).max(40), label: z.string().min(2).max(120), hasExpiry: z.boolean().default(true), isProfilePhoto: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const created = await ctx.db.tipoDocumentacion.create({ data: input });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "create", entity: "TipoDocumentacion", entityId: created.id, after: created });
      return created;
    }),

  update: adminOrBedel()
    .input(idIn.extend({ code: z.string().min(2).max(40), label: z.string().min(2).max(120), hasExpiry: z.boolean(), isProfilePhoto: z.boolean(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.tipoDocumentacion.update({ where: { id: input.id }, data: input });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "update", entity: "TipoDocumentacion", entityId: input.id, after: updated });
      return updated;
    }),

  softDelete: adminOrBedel()
    .input(idIn)
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.tipoDocumentacion.update({ where: { id: input.id }, data: { deletedAt: new Date() } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "delete", entity: "TipoDocumentacion", entityId: input.id });
      return updated;
    }),

  restore: adminOnly().input(idIn).mutation(({ ctx, input }) =>
    ctx.db.tipoDocumentacion.update({ where: { id: input.id }, data: { deletedAt: null } }),
  ),
});

// ---------------------------------------------------------------
// Estados de Documentación
// ---------------------------------------------------------------
export const estadosDocRouter = router({
  list: adminOrBedel().query(({ ctx }) => ctx.db.estadoDocumentacion.findMany({ where: { deletedAt: null } })),
  create: adminOnly()
    .input(z.object({ code: z.string().min(2).max(40), label: z.string().min(2).max(120), color: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.estadoDocumentacion.create({ data: input })),
  update: adminOnly()
    .input(idIn.extend({ label: z.string(), color: z.string(), active: z.boolean() }))
    .mutation(({ ctx, input }) => ctx.db.estadoDocumentacion.update({ where: { id: input.id }, data: { label: input.label, color: input.color, active: input.active } })),
});

// ---------------------------------------------------------------
// Motivos de rechazo (doc + inscripción)
// ---------------------------------------------------------------
export const motivosRouter = router({
  doc: router({
    list: adminOrBedel().query(({ ctx }) => ctx.db.motivoRechazoDocumentacion.findMany({ where: { deletedAt: null }, orderBy: { label: "asc" } })),
    create: adminOnly().input(z.object({ label: z.string().min(2).max(200) })).mutation(({ ctx, input }) => ctx.db.motivoRechazoDocumentacion.create({ data: input })),
    update: adminOnly().input(idIn.extend({ label: z.string().min(2), active: z.boolean() })).mutation(({ ctx, input }) => ctx.db.motivoRechazoDocumentacion.update({ where: { id: input.id }, data: { label: input.label, active: input.active } })),
    softDelete: adminOnly().input(idIn).mutation(({ ctx, input }) => ctx.db.motivoRechazoDocumentacion.update({ where: { id: input.id }, data: { deletedAt: new Date() } })),
  }),
  inscripcion: router({
    list: adminOrBedel().query(({ ctx }) => ctx.db.motivoRechazoInscripcion.findMany({ where: { deletedAt: null }, orderBy: { label: "asc" } })),
    create: adminOnly().input(z.object({ label: z.string().min(2).max(200) })).mutation(({ ctx, input }) => ctx.db.motivoRechazoInscripcion.create({ data: input })),
    update: adminOnly().input(idIn.extend({ label: z.string().min(2), active: z.boolean() })).mutation(({ ctx, input }) => ctx.db.motivoRechazoInscripcion.update({ where: { id: input.id }, data: { label: input.label, active: input.active } })),
    softDelete: adminOnly().input(idIn).mutation(({ ctx, input }) => ctx.db.motivoRechazoInscripcion.update({ where: { id: input.id }, data: { deletedAt: new Date() } })),
  }),
});

// ---------------------------------------------------------------
// Tipos de Documento de Identidad
// ---------------------------------------------------------------
export const tiposDocIdRouter = router({
  list: adminOrBedel().query(({ ctx }) => ctx.db.tipoDocumentoIdentidad.findMany({ where: { deletedAt: null }, orderBy: { code: "asc" } })),
  create: adminOnly()
    .input(z.object({ code: z.string().min(2).max(20), label: z.string().min(2).max(80) }))
    .mutation(({ ctx, input }) => ctx.db.tipoDocumentoIdentidad.create({ data: input })),
  update: adminOnly()
    .input(idIn.extend({ code: z.string().min(2).max(20), label: z.string().min(2).max(80), active: z.boolean() }))
    .mutation(({ ctx, input }) => ctx.db.tipoDocumentoIdentidad.update({ where: { id: input.id }, data: input })),
  softDelete: adminOnly().input(idIn).mutation(({ ctx, input }) => ctx.db.tipoDocumentoIdentidad.update({ where: { id: input.id }, data: { deletedAt: new Date() } })),
});
