import { router, publicProcedure } from "./trpc";
import {
  titulacionesRouter,
  sindicatosRouter,
  categoriasRouter,
  tiposDocumentacionRouter,
  estadosDocRouter,
  motivosRouter,
  tiposDocIdRouter,
} from "./routers/catalogs";
import { coursesRouter } from "./routers/courses";
import { instancesRouter } from "./routers/instances";
import { teachersRouter } from "./routers/teachers";
import { usersRouter } from "./routers/users";
import { companiesRouter } from "./routers/companies";
import { settingsRouter } from "./routers/settings";
import { auditRouter } from "./routers/audit";
import { geoRouter } from "./routers/geo";

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true, ts: new Date().toISOString() })),

  // Catálogos
  titulaciones: titulacionesRouter,
  sindicatos: sindicatosRouter,
  categorias: categoriasRouter,
  tiposDocumentacion: tiposDocumentacionRouter,
  estadosDocumentacion: estadosDocRouter,
  motivos: motivosRouter,
  tiposDocId: tiposDocIdRouter,

  // Dominio
  courses: coursesRouter,
  instances: instancesRouter,
  teachers: teachersRouter,
  users: usersRouter,
  companies: companiesRouter,
  settings: settingsRouter,
  audit: auditRouter,
  geo: geoRouter,
});

export type AppRouter = typeof appRouter;
