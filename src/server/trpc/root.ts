import { router, publicProcedure } from "./trpc";
import { z } from "zod";

/**
 * Router raíz. En sprints siguientes se irán anidando los routers de
 * dominio (cursos, docentes, alumnos, inscripciones, etc.).
 */
export const appRouter = router({
  health: publicProcedure.query(() => ({
    ok: true,
    ts: new Date().toISOString(),
  })),
  echo: publicProcedure.input(z.object({ msg: z.string() })).query(({ input }) => input),
});

export type AppRouter = typeof appRouter;
