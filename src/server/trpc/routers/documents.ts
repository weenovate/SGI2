import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, roleProcedure, protectedProcedure } from "../trpc";
import { audit } from "@/lib/audit";
import { deleteFile } from "@/lib/storage";

const adminOrBedel = () => roleProcedure("admin", "bedel");
const onlyAlumno = () => roleProcedure("alumno");

export const documentsRouter = router({
  // --- Vista alumno (HU4) ---
  myList: onlyAlumno().query(async ({ ctx }) => {
    const profile = await ctx.db.studentProfile.findUnique({
      where: { userId: ctx.session.user.id },
      include: {
        documents: {
          where: { deletedAt: null },
          include: { tipo: true, files: { include: { fileObject: true } } },
          orderBy: { uploadedAt: "desc" },
        },
      },
    });
    return profile?.documents ?? [];
  }),

  // Asocia archivos previamente subidos (vía /api/upload) a un nuevo documento.
  myCreate: onlyAlumno()
    .input(
      z.object({
        tipoId: z.string(),
        expiresAt: z.coerce.date().nullable().optional(),
        fileObjectIds: z.array(z.string()).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.db.studentProfile.findUniqueOrThrow({ where: { userId: ctx.session.user.id } });
      const tipo = await ctx.db.tipoDocumentacion.findUnique({ where: { id: input.tipoId } });
      if (!tipo) throw new TRPCError({ code: "BAD_REQUEST", message: "Tipo inválido" });

      // Validar que los archivos sean del propio usuario
      const files = await ctx.db.fileObject.findMany({
        where: { id: { in: input.fileObjectIds }, ownerUserId: ctx.session.user.id },
      });
      if (files.length !== input.fileObjectIds.length) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Archivos inválidos" });
      }

      const created = await ctx.db.document.create({
        data: {
          studentId: profile.id,
          tipoId: tipo.id,
          status: "pendiente",
          expiresAt: tipo.hasExpiry ? input.expiresAt ?? null : null,
          uploadedById: ctx.session.user.id,
          files: {
            create: input.fileObjectIds.map((fileObjectId, i) => ({ fileObjectId, position: i })),
          },
        },
      });

      // Si es Foto 4x4 y se aprueba, después actualizamos el avatar del user.
      // Por ahora solo dejamos referencia para hidratar al aprobar.
      if (tipo.isProfilePhoto) {
        await ctx.db.studentProfile.update({
          where: { id: profile.id },
          data: { fotoDocumentId: created.id },
        });
      }

      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "create", entity: "Document", entityId: created.id, after: { tipo: tipo.code, files: input.fileObjectIds.length } });
      return created;
    }),

  // El alumno puede reemplazar archivos (cuando estaba rechazado, vencido,
  // o quiere actualizar). Genera una nueva versión y vuelve a "pendiente".
  myReplaceFiles: onlyAlumno()
    .input(
      z.object({
        documentId: z.string(),
        expiresAt: z.coerce.date().nullable().optional(),
        fileObjectIds: z.array(z.string()).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.db.document.findFirst({
        where: { id: input.documentId, deletedAt: null, student: { userId: ctx.session.user.id } },
        include: { files: { include: { fileObject: true } }, tipo: true },
      });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });

      // Snapshot a DocumentVersion como "reemplazada"
      await ctx.db.documentVersion.create({
        data: {
          documentId: doc.id,
          status: "reemplazada",
          data: { tipo: doc.tipo.code, status: doc.status, expiresAt: doc.expiresAt?.toISOString() ?? null },
          fileObjectIds: doc.files.map((f) => f.fileObjectId).join(","),
        },
      });

      // Reemplazar archivos asociados (no borrar físicamente; quedan en DocumentVersion)
      await ctx.db.documentFile.deleteMany({ where: { documentId: doc.id } });
      const newFiles = await ctx.db.fileObject.findMany({
        where: { id: { in: input.fileObjectIds }, ownerUserId: ctx.session.user.id },
      });
      if (newFiles.length !== input.fileObjectIds.length) throw new TRPCError({ code: "FORBIDDEN" });
      for (let i = 0; i < input.fileObjectIds.length; i++) {
        await ctx.db.documentFile.create({ data: { documentId: doc.id, fileObjectId: input.fileObjectIds[i]!, position: i } });
      }

      const updated = await ctx.db.document.update({
        where: { id: doc.id },
        data: {
          status: "pendiente",
          expiresAt: doc.tipo.hasExpiry ? input.expiresAt ?? null : null,
          expiringSoon: false,
          rejectionMotivoId: null,
          rejectionNotes: null,
          reviewedById: null,
          reviewedAt: null,
          uploadedAt: new Date(),
          uploadedById: ctx.session.user.id,
        },
      });

      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "update", entity: "Document", entityId: doc.id, before: doc, after: updated, meta: { replaced: true } });
      return updated;
    }),

  myDelete: onlyAlumno()
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.db.document.findFirst({
        where: { id: input.id, student: { userId: ctx.session.user.id }, deletedAt: null },
      });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.document.update({ where: { id: doc.id }, data: { deletedAt: new Date() } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "delete", entity: "Document", entityId: doc.id });
      return { ok: true };
    }),

  // --- Backoffice (HU11) ---
  list: adminOrBedel()
    .input(
      z
        .object({
          status: z.enum(["pendiente", "aprobada", "rechazada", "vencida"]).optional(),
          studentId: z.string().optional(),
          tipoId: z.string().optional(),
          q: z.string().optional(),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(200).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const where = {
        deletedAt: null,
        ...(input?.status ? { status: input.status } : {}),
        ...(input?.studentId ? { studentId: input.studentId } : {}),
        ...(input?.tipoId ? { tipoId: input.tipoId } : {}),
        ...(input?.q
          ? {
              OR: [
                { student: { user: { firstName: { contains: input.q } } } },
                { student: { user: { lastName: { contains: input.q } } } },
                { student: { user: { email: { contains: input.q } } } },
                { student: { docNumber: { contains: input.q } } },
              ],
            }
          : {}),
      };
      const [items, total] = await Promise.all([
        ctx.db.document.findMany({
          where,
          include: {
            tipo: true,
            student: { include: { user: true } },
            files: { include: { fileObject: true } },
          },
          orderBy: { uploadedAt: "desc" },
          skip: ((input?.page ?? 1) - 1) * (input?.pageSize ?? 50),
          take: input?.pageSize ?? 50,
        }),
        ctx.db.document.count({ where }),
      ]);
      return { items, total };
    }),

  approve: adminOrBedel()
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.document.findUniqueOrThrow({
        where: { id: input.id },
        include: { tipo: true, student: true },
      });
      const updated = await ctx.db.document.update({
        where: { id: input.id },
        data: { status: "aprobada", reviewedById: ctx.session.user.id, reviewedAt: new Date(), rejectionMotivoId: null, rejectionNotes: null },
      });

      // Si es Foto 4x4 → setear como avatar
      if (before.tipo.isProfilePhoto) {
        const firstFile = await ctx.db.documentFile.findFirst({
          where: { documentId: before.id },
          orderBy: { position: "asc" },
          include: { fileObject: true },
        });
        if (firstFile) {
          await ctx.db.user.update({
            where: { id: before.student.userId },
            data: { image: firstFile.fileObject.relPath },
          });
        }
      }

      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "approve", entity: "Document", entityId: input.id, before, after: updated });
      return updated;
    }),

  reject: adminOrBedel()
    .input(
      z.object({
        id: z.string(),
        motivoId: z.string(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.document.findUniqueOrThrow({ where: { id: input.id } });
      const updated = await ctx.db.document.update({
        where: { id: input.id },
        data: {
          status: "rechazada",
          rejectionMotivoId: input.motivoId,
          rejectionNotes: input.notes ?? null,
          reviewedById: ctx.session.user.id,
          reviewedAt: new Date(),
        },
      });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "reject", entity: "Document", entityId: input.id, before, after: updated });
      return updated;
    }),

  // Acceso a las versiones históricas (Admin)
  versions: roleProcedure("admin")
    .input(z.object({ documentId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.documentVersion.findMany({
        where: { documentId: input.documentId },
        orderBy: { archivedAt: "desc" },
      }),
    ),

  // Hard-delete de un archivo individual (admin only) — no rompe versiones
  hardDeleteFile: roleProcedure("admin")
    .input(z.object({ fileObjectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const file = await ctx.db.fileObject.findUniqueOrThrow({ where: { id: input.fileObjectId } });
      await deleteFile(file.relPath).catch(() => undefined);
      await ctx.db.documentFile.deleteMany({ where: { fileObjectId: file.id } });
      await ctx.db.fileObject.delete({ where: { id: file.id } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "delete", entity: "FileObject", entityId: file.id });
      return { ok: true };
    }),
});
