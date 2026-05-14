import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, roleProcedure } from "../trpc";
import { audit } from "@/lib/audit";
import { notifyRole, notifyUser } from "@/server/services/notifications";

const adminOrBedel = () => roleProcedure("admin", "bedel");

function audienceContains(audience: unknown, role: string, userId: string): boolean {
  if (!audience || typeof audience !== "object") return false;
  const a = audience as { all?: boolean; roles?: string[]; userIds?: string[] };
  if (a.all) return true;
  if (a.roles?.includes(role)) return true;
  if (a.userIds?.includes(userId)) return true;
  return false;
}

export const notificationsRouter = router({
  myList: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;
      // Filtramos en SQL por rol/usuario usando JSON path queries no portables en MySQL;
      // hacemos un fetch generoso y filtramos en memoria. Para volúmenes chicos del MVP alcanza.
      const items = await ctx.db.notification.findMany({
        where: {
          deletedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
        },
        include: { reads: { where: { userId } } },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 50,
      });
      return items
        .filter((n) => audienceContains(n.audience, role, userId))
        .map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          level: n.level,
          createdAt: n.createdAt,
          expiresAt: n.expiresAt,
          read: n.reads.length > 0 ? n.reads[0]!.readAt : null,
        }));
    }),

  myUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const role = ctx.session.user.role;
    const userId = ctx.session.user.id;
    const all = await ctx.db.notification.findMany({
      where: {
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      include: { reads: { where: { userId } } },
    });
    return all.filter((n) => audienceContains(n.audience, role, userId) && n.reads.length === 0).length;
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.notificationRead.upsert({
        where: { notificationId_userId: { notificationId: input.id, userId: ctx.session.user.id } },
        update: { readAt: new Date() },
        create: { notificationId: input.id, userId: ctx.session.user.id },
      });
      return { ok: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const role = ctx.session.user.role;
    const userId = ctx.session.user.id;
    const all = await ctx.db.notification.findMany({
      where: { deletedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] },
      include: { reads: { where: { userId } } },
    });
    const unread = all.filter((n) => audienceContains(n.audience, role, userId) && n.reads.length === 0);
    for (const n of unread) {
      await ctx.db.notificationRead.create({ data: { notificationId: n.id, userId } });
    }
    return { ok: true, count: unread.length };
  }),

  // ---- Backoffice (HU13-2): bedel/admin crean notificaciones ----
  create: adminOrBedel()
    .input(
      z.object({
        title: z.string().min(2).max(160),
        body: z.string().min(2),
        level: z.enum(["info", "important", "critical"]).default("info"),
        audience: z.object({
          all: z.boolean().optional(),
          roles: z.array(z.enum(["admin", "bedel", "manager", "docente", "alumno"])).optional(),
          userIds: z.array(z.string()).optional(),
        }),
        expiresInDays: z.number().int().min(1).max(365).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000) : null;
      const created = await ctx.db.notification.create({
        data: {
          title: input.title,
          body: input.body,
          level: input.level,
          audience: input.audience as Prisma.InputJsonValue,
          expiresAt,
          createdById: ctx.session.user.id,
        },
      });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "create", entity: "Notification", entityId: created.id, after: created });
      return created;
    }),

  listBackoffice: adminOrBedel()
    .input(z.object({ page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const [items, total] = await Promise.all([
        ctx.db.notification.findMany({
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: input?.pageSize ?? 50,
          skip: ((input?.page ?? 1) - 1) * (input?.pageSize ?? 50),
        }),
        ctx.db.notification.count({ where: { deletedAt: null } }),
      ]);
      return { items, total };
    }),

  remove: adminOrBedel()
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.notification.update({ where: { id: input.id }, data: { deletedAt: new Date() } });
      await audit({ userId: ctx.session.user.id, ip: ctx.ip, action: "delete", entity: "Notification", entityId: input.id });
      return { ok: true };
    }),

  // Internal helpers: not exposed; we re-export here for testing only
  _internal: router({
    notifyUser: roleProcedure("admin").input(z.object({ userId: z.string(), title: z.string(), body: z.string() })).mutation(({ input }) =>
      notifyUser(input.userId, { title: input.title, body: input.body }),
    ),
    notifyRole: roleProcedure("admin").input(z.object({ role: z.enum(["admin", "bedel", "manager", "docente", "alumno"]), title: z.string(), body: z.string() })).mutation(({ input }) =>
      notifyRole(input.role, { title: input.title, body: input.body }),
    ),
  }),
});
