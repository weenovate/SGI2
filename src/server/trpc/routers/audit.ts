import { z } from "zod";
import { router, roleProcedure } from "../trpc";

const adminOnly = () => roleProcedure("admin");

export const auditRouter = router({
  list: adminOnly()
    .input(
      z
        .object({
          q: z.string().optional(),
          userId: z.string().optional(),
          ip: z.string().optional(),
          action: z.string().optional(),
          entity: z.string().optional(),
          from: z.coerce.date().optional(),
          to: z.coerce.date().optional(),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(200).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const where = {
        AND: [
          input?.userId ? { userId: input.userId } : {},
          input?.ip ? { ip: input.ip } : {},
          input?.action ? { action: input.action } : {},
          input?.entity ? { entity: input.entity } : {},
          input?.from || input?.to
            ? { createdAt: { gte: input.from ?? undefined, lte: input.to ?? undefined } }
            : {},
          input?.q
            ? {
                OR: [
                  { entityId: { contains: input.q } },
                  { entity: { contains: input.q } },
                  { action: { contains: input.q } },
                ],
              }
            : {},
        ],
      };

      const [items, total] = await Promise.all([
        ctx.db.auditLog.findMany({
          where,
          include: { user: { select: { username: true, email: true, role: true } } },
          orderBy: { createdAt: "desc" },
          skip: ((input?.page ?? 1) - 1) * (input?.pageSize ?? 50),
          take: input?.pageSize ?? 50,
        }),
        ctx.db.auditLog.count({ where }),
      ]);
      return { items, total };
    }),
});
