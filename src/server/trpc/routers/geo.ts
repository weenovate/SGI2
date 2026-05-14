import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export const geoRouter = router({
  paises: publicProcedure.query(({ ctx }) => ctx.db.pais.findMany({ orderBy: { name: "asc" } })),

  provincias: publicProcedure
    .input(z.object({ paisId: z.string().default("ARG") }).optional())
    .query(({ ctx, input }) =>
      ctx.db.provincia.findMany({ where: { paisId: input?.paisId ?? "ARG" }, orderBy: { name: "asc" } }),
    ),

  localidades: publicProcedure
    .input(z.object({ provinciaId: z.string(), q: z.string().optional() }))
    .query(({ ctx, input }) =>
      ctx.db.localidad.findMany({
        where: {
          provinciaId: input.provinciaId,
          ...(input.q ? { name: { contains: input.q } } : {}),
        },
        orderBy: { name: "asc" },
        take: 200,
      }),
    ),
});
