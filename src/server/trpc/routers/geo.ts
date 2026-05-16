import { z } from "zod";
import { router, publicProcedure } from "../trpc";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

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

  localidadById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.localidad.findUnique({
        where: { id: input.id },
        include: { provincia: true },
      }),
    ),

  // Devuelve coincidencias del dataset Correo Argentino para un CP dado y,
  // cuando es posible, las resuelve a la Localidad de GeoRef equivalente
  // por (provinciaId, name normalizado).
  findByPostalCode: publicProcedure
    .input(z.object({ code: z.string().min(3).max(8) }))
    .query(async ({ ctx, input }) => {
      const code = input.code.trim();
      const rows = await ctx.db.postalCode.findMany({
        where: { code },
        orderBy: { localidadName: "asc" },
      });
      if (rows.length === 0) return [];

      const provIds = Array.from(new Set(rows.map((r) => r.provinciaId)));
      const provs = await ctx.db.provincia.findMany({ where: { id: { in: provIds } } });
      const provById = new Map(provs.map((p) => [p.id, p]));

      // Para cada provincia involucrada, leemos sus localidades GeoRef
      // y armamos un index por nombre normalizado para resolver el matching.
      const georefLocs = await ctx.db.localidad.findMany({
        where: { provinciaId: { in: provIds } },
        select: { id: true, provinciaId: true, name: true },
      });
      const indexByKey = new Map<string, { id: string; name: string }>();
      for (const l of georefLocs) {
        indexByKey.set(`${l.provinciaId}|${normalize(l.name)}`, { id: l.id, name: l.name });
      }

      return rows.map((r) => {
        const provincia = provById.get(r.provinciaId);
        const match = indexByKey.get(`${r.provinciaId}|${normalize(r.localidadName)}`);
        return {
          code: r.code,
          provinciaId: r.provinciaId,
          provinciaName: provincia?.name ?? r.provinciaId,
          localidadName: r.localidadName,
          georefLocalidadId: match?.id ?? null,
          georefLocalidadName: match?.name ?? null,
        };
      });
    }),
});
